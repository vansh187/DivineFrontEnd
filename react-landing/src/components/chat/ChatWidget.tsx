import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatSession } from '../../hooks/useChatSession';
import type { AgentMessageVariant, ChatButton, PlotListItem } from '../../hooks/useChatSession';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, API_BASE_URL } from '../../services/authApi';
import type { Role } from '../../services/authApi';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { extractReportDownloadUrl, resolveReportUrl, triggerReportDownload } from '../../utils/chatReport';
import { ChatLauncher } from './ChatLauncher';
import { ChatTeaser } from './ChatTeaser';
import { ChatWindow } from './ChatWindow';

const TEASER_STORAGE_KEY = 'dvi_chat_teaser_dismissed';
const TEASER_DELAY_MS = 1800;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const AFFIRMATIVE_LOGIN_PATTERN = /^(yes|yeah|yep|ya|sure|ok|okay|login|log in|sign in|signin)$/i;
const LOGOUT_PATTERN = /^(logout|log out|sign out|signout)$/i;
// "restart chat", "refresh the conversation", "start over", "new chat", etc. —
// wipes the session and re-greets with the welcome message + starter prompts.
const RESTART_PATTERN =
  /^\s*(?:please\s+)?(?:(?:restart|reset|refresh|start\s+over|start\s+fresh|fresh\s+start|start\s+again|begin\s+again)(?:\s+(?:the\s+)?(?:chat|conversation|chatbot|session|bot))?|(?:clear|new|end)\s+(?:the\s+)?(?:chat|conversation|chatbot|session))\s*[.!?]*\s*$/i;
const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

// Public SPA routes a chat button may link to without an explicit
// `action: "navigate"`. These get client-side routing so a static host doesn't
// 404 on them. Auth-gated dashboard routes (/customer, /broker) are deliberately
// excluded — those always want a full page load, which the backend now sends as
// an `action: "navigate"` button handled separately.
const INTERNAL_ROUTE_PREFIXES = ['/book-plot', '/residences', '/our-story'];

/** pathname(+search) of a chat-button url, absolute same-origin or relative;
 * '' when it can't be resolved to a local path. */
function urlPath(rawUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return '';
    }
  }
  return rawUrl.startsWith('/') ? rawUrl : '';
}

/** Routes that RoleRoute guards — a logged-out visitor can't land on these. */
function isAuthGatedPath(path: string): boolean {
  return /^\/(customer|broker)(\/|$|\?)/.test(path);
}

// Stored in pendingChatNavRef when the visitor showed a "browse / book plots"
// intent but the button carried no usable target — resolved to the role's plots
// view once we know which role they logged in as. Not a real path (no leading /).
const PLOTS_INTENT = 'plots';

/** A button that means "show me plots to book" regardless of its action/url —
 * covers the backend's `book_plots` value and any "browse/book plots" wording. */
function isBrowsePlotsButton(button: ChatButton): boolean {
  return /(^|_)book_?plots?($|_)/i.test(button.value) || /brows\w*\s+(?:&|and)?\s*book|book.*plot|brows\w*.*plot/i.test(`${button.label} ${button.value}`);
}

/** Where to land after a chat-driven login, given where the visitor was headed
 * when we detoured them through the login flow (e.g. tapped "Browse & Book
 * Plots" while signed out). */
function postLoginDestination(role: Role, pending: string | null): string {
  if (!pending) return roleHome[role];
  if (pending === PLOTS_INTENT) return `${roleHome[role]}/plots`;
  if (pending === roleHome[role] || pending.startsWith(`${roleHome[role]}/`)) return pending;
  // Headed somewhere role-specific that isn't this role's area — send them to
  // this role's plots view if that's what they were after, else their home.
  if (/\/plots(\/|$|\?)/.test(pending)) return `${roleHome[role]}/plots`;
  return roleHome[role];
}

/**
 * If `rawUrl` refers to a page inside this site's own SPA, return its
 * path (+search +hash) for `navigate()`. Returns null for anything that should
 * stay a real link/window.open (API resources, external sites).
 */
function toInternalAppPath(rawUrl: string): string | null {
  let path = rawUrl;
  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.origin !== window.location.origin) return null;
      path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return null;
    }
  } else if (!path.startsWith('/')) {
    return null;
  }
  const pathname = path.split(/[?#]/)[0];
  if (pathname === '/' || INTERNAL_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return path;
  }
  return null;
}

const WELCOME_MESSAGE =
  "Hi, I'm Divine Assistant. I can help with plot availability, pricing and payment plans, " +
  'home-loan guidance, RERA and approval details, or booking a site visit. What would you like to know?';

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
  const { login, logout, signup, session: authSession } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [entered, setEntered] = useState(false);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [plotIntelligenceOpen, setPlotIntelligenceOpen] = useState(false);
  // Tracks the real backend greeting specifically — separate from
  // session.messages, because a *failed* greeting attempt still appends a
  // "something went wrong" message, which must not be mistaken for a
  // successful greeting (that would permanently block ever retrying it).
  const greetingSentRef = useRef(false);
  const greetingInFlightRef = useRef(false);
  const greetingRetriedSinceOpenRef = useRef(false);
  const geoCoordsRef = useRef<{ lat: number; long: number } | null>(null);
  const geoRequestedRef = useRef(false);
  // Report URLs already auto-downloaded, so re-renders don't re-fire the download.
  const downloadedReportsRef = useRef<Set<string>>(new Set());

  // A real login/logout through the website's own auth (the modal, or a direct link
  // into a role-gated page with an already-stored session) makes any in-progress chat
  // auth flow stale - e.g. the visitor started logging in via chat, abandoned it, then
  // signed in through the modal instead, leaving the chat session waiting on a password
  // it will never get. Reopening the chat on any page after that must show a fresh
  // greeting, not resume that abandoned flow. Skips the very first render (mount) so a
  // returning visitor's already-authenticated page load doesn't force an unnecessary
  // reset before the widget has even initialized once.
  const authTokenRef = useRef<string | null | undefined>(undefined);
  // Set right before a login()/logout() call that originated from the chat's own auth
  // flow (see handleSendText below) - that path already manages its own messages/state
  // correctly and clears auth_state server-side on success, so the token-change effect
  // below must skip its reset for exactly that one transition instead of wiping out the
  // "You are logged in as..." confirmation it's about to append.
  const chatInitiatedAuthChangeRef = useRef(false);
  // Set when a logged-out visitor taps a chat button headed for an auth-gated
  // page (e.g. "Browse & Book Plots" → /customer/plots). We can't navigate there
  // yet, so we remember it and resume once the in-chat login succeeds.
  const pendingChatNavRef = useRef<string | null>(null);
  useEffect(() => {
    const currentToken = authSession?.token ?? null;
    if (authTokenRef.current === undefined) {
      authTokenRef.current = currentToken;
      return;
    }
    if (authTokenRef.current === currentToken) return;
    authTokenRef.current = currentToken;
    if (chatInitiatedAuthChangeRef.current) {
      chatInitiatedAuthChangeRef.current = false;
      return;
    }
    greetingSentRef.current = false;
    greetingInFlightRef.current = false;
    greetingRetriedSinceOpenRef.current = false;
    session.resetSession();
    // Only re-run when the token itself changes - `session` (and its resetSession
    // function identity) is new on every dispatch, which would otherwise fire this
    // effect constantly instead of only on an actual login/logout.
  }, [authSession?.token]);

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
    // Always show a proper welcome straight away so the visitor never faces an
    // empty thread (or a backend "didn't catch that" fallback) on open. The
    // backend greeting still fires below and — when it returns a real menu —
    // is appended after this line; a fallback reply is swallowed (see
    // treatAsGreeting in useChatSession).
    if (session.messages.length === 0) {
      session.appendAgentMessage({ kind: 'text', text: WELCOME_MESSAGE });
    }
    void session.send({ message: '', treatAsGreeting: true, greetingPlaceholder: WELCOME_MESSAGE }).then((ok) => {
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

  // When the concierge returns a loan-eligibility report link (e.g. after
  // "Download Report"), fetch the PDF straight away instead of leaving a raw
  // URL in the bubble. The message still renders a "Download report (PDF)"
  // button (see Markdown) as a manual fallback if the browser blocks this.
  useEffect(() => {
    const last = session.messages[session.messages.length - 1];
    if (!last || last.role !== 'agent' || last.variant.kind !== 'text') return;
    const rawUrl = extractReportDownloadUrl(last.variant.text);
    if (!rawUrl) return;
    const absoluteUrl = resolveReportUrl(rawUrl);
    if (downloadedReportsRef.current.has(absoluteUrl)) return;
    downloadedReportsRef.current.add(absoluteUrl);
    triggerReportDownload(absoluteUrl);
  }, [session.messages]);

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
      chatInitiatedAuthChangeRef.current = true;
      pendingChatNavRef.current = null;
      logout();
      greetingSentRef.current = false;
      greetingInFlightRef.current = false;
      greetingRetriedSinceOpenRef.current = false;
      session.resetSession();
      session.close();
      navigate('/', { replace: true });
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      return;
    }

    if (RESTART_PATTERN.test(text)) {
      // Full fresh start: drop the server session + any in-progress flow, clear
      // the thread, and let the greeting effect below re-run — it re-appends the
      // welcome message, and StarterPrompts reappears once the thread has no
      // user messages again.
      pendingChatNavRef.current = null;
      greetingSentRef.current = false;
      greetingInFlightRef.current = false;
      greetingRetriedSinceOpenRef.current = false;
      session.resetSession();
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

      chatInitiatedAuthChangeRef.current = true;
      void loginAfterChatSignup(role, credentials)
        .then(() => {
          const dest = postLoginDestination(role, pendingChatNavRef.current);
          pendingChatNavRef.current = null;
          navigate(dest);
          session.appendAgentMessage({
            kind: 'text',
            text: `You are logged in as ${role}.`,
          });
        })
        .catch((err) => {
          chatInitiatedAuthChangeRef.current = false;
          pendingChatNavRef.current = null;
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

      chatInitiatedAuthChangeRef.current = true;
      void login(role, toAuthLoginInput({ username, password: text }))
        .then(() => {
          const dest = postLoginDestination(role, pendingChatNavRef.current);
          pendingChatNavRef.current = null;
          navigate(dest);
          session.appendAgentMessage({ kind: 'text', text: `You are logged in as ${role}.` });
        })
        .catch((err) => {
          chatInitiatedAuthChangeRef.current = false;
          pendingChatNavRef.current = null;
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
    if (button.action === 'plot_intelligence') {
      session.appendUserMessage(button.label);
      setPlotIntelligenceOpen(true);
      return;
    }

    // "Browse & Book Plots" tapped while signed out: whatever the backend does
    // next (a login menu, or an action:navigate we can't follow yet), remember
    // that the visitor wants the plots view so the login handlers can land them
    // there — on /customer/plots or /broker/plots — instead of the dashboard.
    if (!authSession && isBrowsePlotsButton(button)) {
      const path = button.url ? urlPath(button.url) : '';
      pendingChatNavRef.current = path && isAuthGatedPath(path) ? path : PLOTS_INTENT;
    }

    // Backend-driven full-page navigation (e.g. "Browse & Book Plots" →
    // /customer/plots?...). Always same-tab via location.assign — chat links
    // never open a new tab, so `target: "_blank"` is intentionally ignored.
    if (button.action === 'navigate' && button.url) {
      const path = urlPath(button.url);
      if (!authSession && path && isAuthGatedPath(path)) {
        // Signed out and headed for a role-gated page — remember the target and
        // let the backend run its login prompt; resume in the login handlers.
        pendingChatNavRef.current = path;
        handleSendText(button.value, button.label);
        return;
      }
      window.location.assign(button.url);
      return;
    }

    if (button.url) {
      const internalPath = toInternalAppPath(button.url);
      if (internalPath) {
        // A link into the site's own SPA (e.g. "Browse & Book Plots" → /book-plot).
        // Route it through the client router so it doesn't hard-navigate to a
        // path the static host has no file for and land on the 404 page.
        session.close();
        navigate(internalPath);
      } else {
        // Backend buttons (e.g. loan report downloads) may return a path relative
        // to the API host — resolve it there instead of the frontend's own origin,
        // otherwise it 404s against the SPA router.
        const absoluteUrl = /^https?:\/\//i.test(button.url) ? button.url : `${API_BASE_URL}${button.url}`;
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
      }
    }
    handleSendText(button.value, button.label);
  };

  const handlePlotSelect = (plot: PlotListItem) => {
    // structured_result 'plot_list' rows: same-tab navigation to the plot's
    // booking URL, per the chatbot contract (never window.open / _blank).
    const path = urlPath(plot.book_url);
    if (!authSession && path && isAuthGatedPath(path)) {
      pendingChatNavRef.current = path;
      handleSendText('book_plots', 'Book a plot');
      return;
    }
    window.location.assign(plot.book_url);
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
            plotIntelligenceOpen={plotIntelligenceOpen}
            sessionId={session.sessionId}
            leadId={session.leadId}
            onClose={session.close}
            onClosePlotIntelligence={() => setPlotIntelligenceOpen(false)}
            onDismissConsent={session.dismissConsent}
            onRequestCallback={handleRequestCallback}
            onDesktopContactCard={handleDesktopContactCard}
            onSendText={handleSendText}
            onSendAudio={handleSendAudio}
            onButtonTap={handleButtonTap}
            onPlotSelect={handlePlotSelect}
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
