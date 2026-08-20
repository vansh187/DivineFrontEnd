import { useCallback, useEffect, useReducer, useRef } from 'react';
import * as chatApi from '../services/chatApi';
import { ApiError } from '../services/authApi';
import { useIsMobile } from './useIsMobile';

export type AgentMessageVariant =
  | { kind: 'text'; text: string }
  | { kind: 'contact_card'; phone: string; phoneHref: string };

export type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'agent'; variant: AgentMessageVariant };

interface ChatState {
  isOpen: boolean;
  sessionId: string | null;
  isInitializingSession: boolean;
  sessionInitFailed: boolean;
  messages: ChatMessage[];
  isSending: boolean;
  interimStatusLine: string | null;
  consentShown: boolean;
  callbackFlowActive: boolean;
  micState: 'idle' | 'recording' | 'transcribing';
}

type ChatAction =
  | { type: 'OPEN_WIDGET' }
  | { type: 'CLOSE_WIDGET' }
  | { type: 'SESSION_INIT_START' }
  | { type: 'SESSION_READY'; sessionId: string }
  | { type: 'SESSION_INIT_FAILED' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'SEND_START'; localMessage?: ChatMessage; intentIsCallback?: boolean }
  | { type: 'SEND_SUCCESS'; reply: string; callbackConfirmed: boolean }
  | { type: 'SEND_FAILURE'; message: string; localMessage?: ChatMessage }
  | { type: 'SET_INTERIM_STATUS'; text: string | null }
  | { type: 'DISMISS_CONSENT' }
  | { type: 'APPEND_AGENT_MESSAGE'; variant: AgentMessageVariant }
  | { type: 'APPEND_USER_MESSAGE'; text: string }
  | { type: 'MIC_STATE_CHANGED'; micState: ChatState['micState'] };

const SESSION_STORAGE_KEY = 'dvi_chat_session_id';
const CONSENT_STORAGE_KEY = 'dvi_chat_consent_shown';

function readSessionStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private-browsing / storage-disabled — conversation still works, just won't survive reload */
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const initialState: ChatState = {
  isOpen: false,
  sessionId: null,
  isInitializingSession: false,
  sessionInitFailed: false,
  messages: [],
  isSending: false,
  interimStatusLine: null,
  consentShown: readSessionStorage(CONSENT_STORAGE_KEY) === '1',
  callbackFlowActive: false,
  micState: 'idle',
};

function reducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'OPEN_WIDGET':
      return { ...state, isOpen: true };
    case 'CLOSE_WIDGET':
      return { ...state, isOpen: false };
    case 'SESSION_INIT_START':
      return { ...state, isInitializingSession: true, sessionInitFailed: false };
    case 'SESSION_READY':
      return { ...state, sessionId: action.sessionId, isInitializingSession: false, sessionInitFailed: false };
    case 'SESSION_INIT_FAILED':
      return { ...state, isInitializingSession: false, sessionInitFailed: true };
    case 'SESSION_EXPIRED':
      return { ...state, sessionId: null };
    case 'SEND_START':
      return {
        ...state,
        isSending: true,
        interimStatusLine: null,
        callbackFlowActive: action.intentIsCallback ? true : state.callbackFlowActive,
        messages: action.localMessage ? [...state.messages, action.localMessage] : state.messages,
      };
    case 'SEND_SUCCESS': {
      const agentMessage: ChatMessage = {
        id: makeId(),
        role: 'agent',
        variant: { kind: 'text', text: action.reply },
      };
      return {
        ...state,
        isSending: false,
        interimStatusLine: null,
        messages: [...state.messages, agentMessage],
        callbackFlowActive: action.callbackConfirmed ? false : state.callbackFlowActive,
      };
    }
    case 'SEND_FAILURE':
      return {
        ...state,
        isSending: false,
        interimStatusLine: null,
        // A failed request_callback attempt must not leave QuickActionBar
        // permanently disabled — only a confirmed callback keeps it locked.
        callbackFlowActive: false,
        messages: [
          ...state.messages,
          ...(action.localMessage ? [action.localMessage] : []),
          { id: makeId(), role: 'agent', variant: { kind: 'text', text: action.message } },
        ],
      };
    case 'SET_INTERIM_STATUS':
      return { ...state, interimStatusLine: action.text };
    case 'DISMISS_CONSENT':
      writeSessionStorage(CONSENT_STORAGE_KEY, '1');
      return { ...state, consentShown: true };
    case 'APPEND_AGENT_MESSAGE':
      return { ...state, messages: [...state.messages, { id: makeId(), role: 'agent', variant: action.variant }] };
    case 'APPEND_USER_MESSAGE':
      return { ...state, messages: [...state.messages, { id: makeId(), role: 'user', text: action.text }] };
    case 'MIC_STATE_CHANGED':
      return { ...state, micState: action.micState };
    default:
      return state;
  }
}

function parseUtmParams(url: URL) {
  return {
    utm_source: url.searchParams.get('utm_source'),
    utm_medium: url.searchParams.get('utm_medium'),
    utm_campaign: url.searchParams.get('utm_campaign'),
  };
}

/** Owns all AI Concierge widget state. Session/consent persist per-tab via
 * sessionStorage; message history does not survive a reload (server retains
 * conversational memory under the same session_id even though the UI resets). */
export function useChatSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { deviceClass } = useIsMobile();
  const initStarted = useRef(false);
  const initInFlight = useRef(false);
  const retriedSinceOpenRef = useRef(false);

  const runInit = useCallback(() => {
    if (initInFlight.current) return;

    const existing = readSessionStorage(SESSION_STORAGE_KEY);
    if (existing) {
      dispatch({ type: 'SESSION_READY', sessionId: existing });
      return;
    }

    initInFlight.current = true;
    dispatch({ type: 'SESSION_INIT_START' });
    const url = new URL(window.location.href);
    chatApi
      .initSession({
        referrer: document.referrer || null,
        ...parseUtmParams(url),
        device_type: deviceClass,
      })
      .then((res) => {
        writeSessionStorage(SESSION_STORAGE_KEY, res.sessionId);
        dispatch({ type: 'SESSION_READY', sessionId: res.sessionId });
      })
      .catch(() => dispatch({ type: 'SESSION_INIT_FAILED' }))
      .finally(() => {
        initInFlight.current = false;
      });
  }, [deviceClass]);

  // Silent capture on mount (fires even if the visitor never opens the widget).
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    runInit();
  }, [runInit]);

  // If session-init failed (e.g. backend unreachable at page load), retry
  // ONCE per open — not on every render the failure produces, which would
  // otherwise loop indefinitely (each failed attempt re-sets
  // sessionInitFailed=true, which would immediately re-trigger this same
  // effect) and hammer the backend.
  useEffect(() => {
    if (!state.isOpen) {
      retriedSinceOpenRef.current = false;
      return;
    }
    if (state.sessionInitFailed && !state.isInitializingSession && !retriedSinceOpenRef.current) {
      retriedSinceOpenRef.current = true;
      runInit();
    }
  }, [state.isOpen, state.sessionInitFailed, state.isInitializingSession, runInit]);

  const open = useCallback(() => dispatch({ type: 'OPEN_WIDGET' }), []);
  const close = useCallback(() => dispatch({ type: 'CLOSE_WIDGET' }), []);
  const dismissConsent = useCallback(() => dispatch({ type: 'DISMISS_CONSENT' }), []);
  const appendAgentMessage = useCallback((variant: AgentMessageVariant) => dispatch({ type: 'APPEND_AGENT_MESSAGE', variant }), []);
  const appendUserMessage = useCallback((text: string) => dispatch({ type: 'APPEND_USER_MESSAGE', text }), []);
  const setMicState = useCallback((micState: ChatState['micState']) => dispatch({ type: 'MIC_STATE_CHANGED', micState }), []);

  const send = useCallback(
    async (input: { message?: string; audio?: Blob; lat?: number; long?: number; intent?: 'request_callback' }) => {
      const sessionId = state.sessionId;

      const localMessage: ChatMessage | undefined = input.message
        ? { id: makeId(), role: 'user', text: input.message }
        : input.audio
          ? { id: makeId(), role: 'user', text: '🎤 Voice message' }
          : undefined;

      if (!sessionId) {
        // Never swallow a message the visitor already typed/spoke — surface a
        // normal agent-style line instead of letting it vanish silently.
        dispatch({
          type: 'SEND_FAILURE',
          localMessage,
          message: "I'm having trouble connecting right now — please try again in a moment.",
        });
        return;
      }

      dispatch({ type: 'SEND_START', localMessage, intentIsCallback: input.intent === 'request_callback' });

      try {
        const reply = await chatApi.sendChatMessage({
          sessionId,
          text: input.message,
          audio: input.audio,
          lat: input.lat,
          long: input.long,
          intent: input.intent,
        });
        dispatch({ type: 'SEND_SUCCESS', reply: reply.reply, callbackConfirmed: reply.callbackConfirmed !== null });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404 && err.detail === 'session_not_found') {
          // Stale session on the backend — clear it and reconnect immediately
          // so the visitor's next message (or a retry of this one) works.
          try {
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
          } catch {
            /* private-browsing / storage-disabled */
          }
          dispatch({ type: 'SESSION_EXPIRED' });
          runInit();
          dispatch({ type: 'SEND_FAILURE', message: 'Your chat session expired — reconnecting, please send that again in a moment.' });
          return;
        }
        const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        dispatch({ type: 'SEND_FAILURE', message });
      }
    },
    [state.sessionId, runInit],
  );

  // Not memoized: `state` is a new object on every dispatch anyway, so a
  // useMemo keyed on it would never actually skip recomputation.
  return {
    ...state,
    open,
    close,
    dismissConsent,
    send,
    appendAgentMessage,
    appendUserMessage,
    setMicState,
  };
}
