import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSession } from '../../hooks/useChatSession';
import type { AgentMessageVariant, ChatButton } from '../../hooks/useChatSession';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, API_BASE_URL } from '../../services/authApi';
import type { Role } from '../../services/authApi';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChatLauncher } from './ChatLauncher';
import { ChatTeaser } from './ChatTeaser';
import { ChatWindow } from './ChatWindow';

const TEASER_STORAGE_KEY = 'dvi_chat_teaser_dismissed';
const TEASER_DELAY_MS = 1800;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const AFFIRMATIVE_LOGIN_PATTERN = /^(yes|yeah|yep|ya|sure|ok|okay|login|log in|sign in|signin)$/i;
const LOGOUT_PATTERN = /^(logout|log out|sign out|signout)$/i;
const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

function readTeaserDismissed(): boolean {
  try {
    return sessionStorage.getItem(TEASER_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeTeaserDismissed() {
  try {
    sessionStorage.setItem(TEASER_STORAGE_KEY, '1');
  } catch {
    /* private-browsing / storage-disabled — teaser just won't persist its dismissal */
  }
}

function isLoginConfirmationPrompt(variant: AgentMessageVariant): boolean {
  return variant.kind === 'text' && /account has been created/i.test(variant.text) && /login now/i.test(variant.text);
}

function isPasswordLoginPrompt(variant: AgentMessageVariant): boolean {
  return variant.kind === 'text' && /enter your password/i.test(variant.text) && !/at least/i.test(variant.text);
}

function inferChatRole(messages: ReturnType<typeof useChatSession>['messages']): Role {
  const allText = messages
    .map((message) => (message.role === 'user' ? message.text : message.variant.kind === 'text' ? message.variant.text : ''))
    .join(' ')
    .toLowerCase();
  if (/\bbroker\b/.test(allText)) return 'broker';
  return 'customer';
}

function inferChatSignupCredentials(messages: ReturnType<typeof useChatSession>['messages']) {
  let username: string | null = null;
  let password: string | null = null;

  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const usernameMatch = message.text.match(EMAIL_PATTERN);
    if (usernameMatch) username = usernameMatch[0];

    const previousAgent = [...messages.slice(0, index)].reverse().find((candidate) => candidate.role === 'agent');
    if (
      previousAgent?.role === 'agent' &&
      previousAgent.variant.kind === 'text' &&
      /password/i.test(previousAgent.variant.text) &&
      message.text.length >= 8
    ) {
      password = message.text;
    }
  });

  return username && password ? { username, password } : null;
}

function toAuthLoginInput(credentials: { username: string; password: string }) {
  // The backend login field is named `username`. useAuth.login accepts `email`
  // and authApi.login maps it to the backend username payload.
  return { email: credentials.username, password: credentials.password };
}

export function ChatWidget() {
  const session = useChatSession();
  const { login, logout, signup } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [entered, setEntered] = useState(false);
  const [teaserVisible, setTeaserVisible] = useState(false);
  // Tracks the real backend greeting specifically — separate from
  // session.messages, because a *failed* greeting attempt still appends a
  // "something went wrong" message, which must not be mistaken for a
  // successful greeting (that would permanently block ever retrying it).
  const greetingSentRef = useRef(false);
  const greetingInFlightRef = useRef(false);
  const greetingRetriedSinceOpenRef = useRef(false);
  const geoCoordsRef = useRef<{ lat: number; long: number } | null>(null);
  const geoRequestedRef = useRef(false);

  // Shows once per tab session, after a short delay so it doesn't slap the
  // visitor with a callout the instant the page paints. Dismissed for good
  // (this tab) either by the close button or by opening the chat.
  useEffect(() => {
    if (readTeaserDismissed()) return;
    const timer = window.setTimeout(() => setTeaserVisible(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissTeaser = () => {
    writeTeaserDismissed();
    setTeaserVisible(false);
  };

  const handleOpen = () => {
    dismissTeaser();
    session.open();
  };

  useEffect(() => {
    if (!session.isOpen) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [session.isOpen]);

  // The greeting isn't returned by session/init — it comes back from the
  // normal message endpoint. Fire one empty-text message right after the
  // session is ready so the backend's greeting (name prompt, main menu,
  // whatever the chatbot flow currently opens with) appears before the
  // visitor types anything, instead of a hardcoded local string.
  useEffect(() => {
    if (!session.isOpen) {
      // Let the next open retry a greeting that never actually succeeded.
      greetingRetriedSinceOpenRef.current = false;
      return;
    }
    if (greetingSentRef.current || greetingInFlightRef.current || greetingRetriedSinceOpenRef.current) return;
    if (!session.sessionId) return;
    greetingRetriedSinceOpenRef.current = true;
    greetingInFlightRef.current = true;
    void session.send({ message: '' }).then((ok) => {
      greetingInFlightRef.current = false;
      if (ok) greetingSentRef.current = true;
    });
    // Only re-evaluate when these specific fields change — `session` itself
    // is a new object on every dispatch (every keystroke, mic-state change,
    // etc.), which would otherwise re-run this effect far more than needed.
  }, [session.isOpen, session.sessionId, session.send]);

  // Ask for location proactively, once, as soon as the visitor opens the
  // chat — rather than waiting for the AI to phrase a reply a specific way
  // (which rarely happened in practice, so the browser's permission prompt
  // was effectively never shown). This is the same "silent capture" timing
  // as session/init, just gated on opening the widget instead of firing for
  // every page load. Coordinates ride along with the visitor's next message
  // (see withPendingGeo below) so they reach the backend/lead alongside real
  // conversational activity rather than as an isolated, contextless call.
  useEffect(() => {
    if (!session.isOpen || geoRequestedRef.current) return;
    if (!('geolocation' in navigator)) return;
    geoRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        geoCoordsRef.current = { lat: position.coords.latitude, long: position.coords.longitude };
      },
      () => {
        // Denied or unavailable — continue silently, no error message.
      },
      { timeout: 8000 },
    );
  }, [session.isOpen]);

  const withPendingGeo = (extra: { message?: string; displayText?: string; audio?: Blob }) => {
    const coords = geoCoordsRef.current;
    geoCoordsRef.current = null;
    return coords ? { ...extra, lat: coords.lat, long: coords.long } : extra;
  };

  const loginAfterChatSignup = async (role: Role, credentials: { username: string; password: string }) => {
    try {
      await login(role, toAuthLoginInput(credentials));
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
      await signup(role, { email: credentials.username, password: credentials.password });
      await login(role, toAuthLoginInput(credentials));
    }
  };

  // `displayText` lets a tapped button's label stand in for what the visitor
  // "said" (the bubble) while `text` — the button's value — is still what
  // gets pattern-matched below and sent to the backend. Free-typed input
  // just passes the same string for both.
  const handleSendText = (text: string, displayText: string = text) => {
    if (LOGOUT_PATTERN.test(text.trim())) {
      session.appendUserMessage(displayText);
      logout();
      session.appendAgentMessage({ kind: 'text', text: 'You are logged out now.' });
      session.close();
      navigate('/', { replace: true });
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      return;
    }

    const lastMessage = session.messages[session.messages.length - 1];
    if (
      lastMessage?.role === 'agent' &&
      isLoginConfirmationPrompt(lastMessage.variant) &&
      AFFIRMATIVE_LOGIN_PATTERN.test(text.trim())
    ) {
      session.appendUserMessage(displayText);
      const credentials = inferChatSignupCredentials(session.messages);
      const role = inferChatRole(session.messages);
      if (!credentials) {
        session.appendAgentMessage({
          kind: 'text',
          text: 'I need the email and password you used for signup to log you in. Please type them again, or use the sign-in button.',
        });
        return;
      }

      void loginAfterChatSignup(role, credentials)
        .then(() => {
          navigate(roleHome[role]);
          session.appendAgentMessage({
            kind: 'text',
            text: `You are logged in as ${role}.`,
          });
        })
        .catch((err) => {
          session.appendAgentMessage({
            kind: 'text',
            text: err instanceof ApiError ? err.message : 'I could not log you in. Please check your email and password and try again.',
          });
        });
      return;
    }

    if (lastMessage?.role === 'agent' && isPasswordLoginPrompt(lastMessage.variant)) {
      session.appendUserMessage(displayText);
      const username = session.messages
        .map((message) => (message.role === 'user' ? message.text.match(EMAIL_PATTERN)?.[0] : null))
        .filter(Boolean)
        .at(-1);
      const role = inferChatRole(session.messages);
      if (!username) {
        session.appendAgentMessage({ kind: 'text', text: 'Please enter your email first, then I can log you in.' });
        return;
      }

      void login(role, toAuthLoginInput({ username, password: text }))
        .then(() => {
          navigate(roleHome[role]);
          session.appendAgentMessage({ kind: 'text', text: `You are logged in as ${role}.` });
        })
        .catch((err) => {
          session.appendAgentMessage({
            kind: 'text',
            text: err instanceof ApiError ? err.message : 'I could not log you in. Please check your email and password and try again.',
          });
        });
      return;
    }

    void session.send(withPendingGeo({ message: text, displayText }));
  };

  const handleSendAudio = (audio: Blob) => {
    // Wait for the send to settle before leaving 'transcribing' — resetting
    // immediately would overwrite the state MicButton just set and hide the
    // transcribing indicator before the backend has actually responded.
    void session.send(withPendingGeo({ audio })).finally(() => session.setMicState('idle'));
  };

  const handleRequestCallback = () => {
    void session.send({ intent: 'request_callback' });
  };

  // Generic handler for every tapped chat button, regardless of its `action`
  // (chatbot_menu, chatbot_auth, select_booking_project, or any future one)
  // — render the label, POST the value as the next message's text. Routed
  // through handleSendText (not straight to session.send) so a button whose
  // value happens to match the logout/login-confirmation/password patterns
  // triggers the same real auth calls a typed equivalent would, instead of
  // just being echoed into the chat as plain text.
  const handleButtonTap = (button: ChatButton) => {
    if (button.url) {
      // Backend buttons (e.g. loan report downloads) may return a path relative
      // to the API host — resolve it there instead of the frontend's own origin,
      // otherwise it 404s against the SPA router.
      const absoluteUrl = /^https?:\/\//i.test(button.url) ? button.url : `${API_BASE_URL}${button.url}`;
      window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
    }
    handleSendText(button.value, button.label);
  };

  const handleDesktopContactCard = (variant: AgentMessageVariant) => {
    session.appendAgentMessage(variant);
  };

  const micDeniedHintShown = useRef(false);
  const handleMicPermissionDenied = () => {
    if (micDeniedHintShown.current) return;
    micDeniedHintShown.current = true;
    session.appendAgentMessage({ kind: 'text', text: "Voice isn't available right now — you can type instead." });
  };

  return (
    <div className="fixed bottom-3 right-3 z-40 flex max-w-[calc(100dvw-24px)] flex-col items-end gap-3 sm:bottom-6 sm:right-6 sm:max-w-none">
      {session.isOpen && (
        <div
          className={
            reducedMotion
              ? ''
              : `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.97] opacity-0'
                }`
          }
        >
          <ChatWindow
            messages={session.messages}
            isSending={session.isSending}
            interimStatusLine={session.interimStatusLine}
            consentShown={session.consentShown}
            callbackFlowActive={session.callbackFlowActive}
            micState={session.micState}
            onClose={session.close}
            onDismissConsent={session.dismissConsent}
            onRequestCallback={handleRequestCallback}
            onDesktopContactCard={handleDesktopContactCard}
            onSendText={handleSendText}
            onSendAudio={handleSendAudio}
            onButtonTap={handleButtonTap}
            onMicStateChange={session.setMicState}
            onMicPermissionDenied={handleMicPermissionDenied}
          />
        </div>
      )}

      {!session.isOpen && teaserVisible && <ChatTeaser onOpen={handleOpen} onDismiss={dismissTeaser} />}

      {!session.isOpen && <ChatLauncher onOpen={handleOpen} />}
    </div>
  );
}
