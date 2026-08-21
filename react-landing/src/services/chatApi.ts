import { ApiError, API_BASE_URL } from './authApi';
import type { DeviceClass } from '../hooks/useIsMobile';

export interface SessionInitRequest {
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  device_type?: DeviceClass;
}

export interface SessionInitResponse {
  sessionId: string;
  leadId: string;
}

export interface CallbackConfirmed {
  name: string;
  phone: string;
  preferredTime: string;
}

export interface ChatButton {
  label: string;
  value: string;
  action: string;
  url?: string | null;
}

export interface ChatReply {
  reply: string;
  buttons: ChatButton[] | null;
  callbackConfirmed: CallbackConfirmed | null;
  guardrailPassed: boolean | null;
  llmProvider: string | null;
}

export interface SendChatMessageInput {
  sessionId: string;
  text?: string;
  audio?: Blob;
  lat?: number;
  long?: number;
  intent?: 'request_callback';
}

type RawSessionInitResponse = Partial<{ session_id: string; lead_id: string }>;

type RawChatReply = Partial<{
  reply: string;
  buttons: ChatButton[] | null;
  callback_confirmed: Partial<{ name: string; phone: string; preferred_time: string }> | null;
  guardrail_passed: boolean | null;
  llm_provider: string | null;
}>;

/** The backend's own sketch for encoding a recorded clip (see chatbot API
 * reference, "Recording voice input") — base64 over JSON, not multipart. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function messageForChatError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the concierge. Check your connection and try again.';
  if (status === 404 && detail === 'session_not_found') return 'Your chat session expired — reconnecting…';
  if (status === 422 && detail === 'stt_failed') return "I couldn't quite hear that — mind typing it instead?";
  if (status === 400 && detail === 'invalid_audio_encoding') return "That voice message didn't come through — mind typing instead?";
  if (status === 500) return 'Something went wrong on our end. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, null, messageForChatError(0, null));
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForChatError(res.status, detail));
  }

  return (data ?? {}) as T;
}

export async function initSession(input: SessionInitRequest): Promise<SessionInitResponse> {
  const raw = await postJson<RawSessionInitResponse>('/chatbot/session/init', input);
  return { sessionId: raw.session_id ?? '', leadId: raw.lead_id ?? '' };
}

export async function sendChatMessage(input: SendChatMessageInput): Promise<ChatReply> {
  const body: Record<string, unknown> = {
    session_id: input.sessionId,
    intent: input.intent,
    precise_lat: input.lat,
    precise_long: input.long,
  };
  if (input.audio) {
    body.audio_b64 = await blobToBase64(input.audio);
  } else {
    // Always send `text` explicitly (even as ""), rather than omitting the
    // field when empty — the backend's greeting/menu flow triggers off an
    // empty-text message and needs the field present, not absent.
    body.text = input.text ?? '';
  }

  const raw = await postJson<RawChatReply>('/chatbot/message', body);
  return {
    reply: raw.reply ?? '',
    buttons: raw.buttons ?? null,
    callbackConfirmed: raw.callback_confirmed
      ? {
          name: raw.callback_confirmed.name ?? '',
          phone: raw.callback_confirmed.phone ?? '',
          preferredTime: raw.callback_confirmed.preferred_time ?? '',
        }
      : null,
    guardrailPassed: raw.guardrail_passed ?? null,
    llmProvider: raw.llm_provider ?? null,
  };
}
