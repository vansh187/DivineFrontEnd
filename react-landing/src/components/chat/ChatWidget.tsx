import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSession } from '../../hooks/useChatSession';
import type { AgentMessageVariant } from '../../hooks/useChatSession';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../services/authApi';
import type { Role } from '../../services/authApi';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChatLauncher } from './ChatLauncher';
import { ChatTeaser } from './ChatTeaser';
import { ChatWindow } from './ChatWindow';

const TEASER_STORAGE_KEY = 'dvi_chat_teaser_dismissed';
const TEASER_DELAY_MS = 1800;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const AFFIRMATIVE_LOGIN_PATTERN = /^(yes|yeah|yep|ya|sure|ok|okay|login|log in|sign in|signin)$/i;
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
  let email: string | null = null;
  let password: string | null = null;

  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const emailMatch = message.text.match(EMAIL_PATTERN);
    if (emailMatch) email = emailMatch[0];

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

  return email && password ? { email, password } : null;
}

export function ChatWidget() {
  const session = useChatSession();
  const { login } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [entered, setEntered] = useState(false);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const greetedRef = useRef(false);
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

  useEffect(() => {
    if (!session.isOpen || greetedRef.current || session.messages.length > 0 || !session.sessionId) return;
    greetedRef.current = true;
    session.appendAgentMessage({
      kind: 'text',
      text: "Hi! I'm the Divine Vision concierge — ask me anything about our townships, or tap Request Callback / Call Now if you'd rather talk to our team directly.",
    });
    // Only re-evaluate when these specific fields change — `session` itself
    // is a new object on every dispatch (every keystroke, mic-state change,
    // etc.), which would otherwise re-run this effect far more than needed.
  }, [session.isOpen, session.sessionId, session.messages.length, session.appendAgentMessage]);

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

  const withPendingGeo = (extra: { message?: string; audio?: Blob }) => {
    const coords = geoCoordsRef.current;
    geoCoordsRef.current = null;
    return coords ? { ...extra, lat: coords.lat, long: coords.long } : extra;
  };

  const handleSendText = (text: string) => {
    const lastMessage = session.messages[session.messages.length - 1];
    if (
      lastMessage?.role === 'agent' &&
      isLoginConfirmationPrompt(lastMessage.variant) &&
      AFFIRMATIVE_LOGIN_PATTERN.test(text.trim())
    ) {
      session.appendUserMessage(text);
      const credentials = inferChatSignupCredentials(session.messages);
      const role = inferChatRole(session.messages);
      if (!credentials) {
        session.appendAgentMessage({
          kind: 'text',
          text: 'I need the email and password you used for signup to log you in. Please type them again, or use the sign-in button.',
        });
        return;
      }

      void login(role, credentials)
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
      session.appendUserMessage(text);
      const email = session.messages
        .map((message) => (message.role === 'user' ? message.text.match(EMAIL_PATTERN)?.[0] : null))
        .filter(Boolean)
        .at(-1);
      const role = inferChatRole(session.messages);
      if (!email) {
        session.appendAgentMessage({ kind: 'text', text: 'Please enter your email first, then I can log you in.' });
        return;
      }

      void login(role, { email, password: text })
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

    void session.send(withPendingGeo({ message: text }));
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
