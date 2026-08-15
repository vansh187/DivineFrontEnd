import { ApiError, API_BASE_URL } from './authApi';

export interface GeneratedDocument {
  id: string;
  owner_id: string;
  owner_role: string;
  document_type: string;
  status: string;
  created_date: string;
  signed_url: string;
  signed_url_expires_in: number;
}

export interface GenerateDocumentInput {
  document_type: string;
  form_data: Record<string, string | number>;
}

function messageForDocumentsError(status: number, detail: unknown): string {
  if (status === 401) {
    return detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 403) return 'You can only access your own documents.';
  if (status === 404) return 'That document could not be found.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (typeof detail === 'string' && detail.startsWith('storage_')) {
    return 'Something went wrong generating your document. Please try again.';
  }
  if (status === 422) return 'Please check the details you entered.';
  return 'Something went wrong. Please try again.';
}

async function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, null, 'Could not reach the server. Check your connection and try again.');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForDocumentsError(res.status, detail));
  }

  return data as T;
}

export function generateDocument(token: string, input: GenerateDocumentInput): Promise<GeneratedDocument> {
  return authedRequest<GeneratedDocument>('/documents/generate', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getDocument(token: string, documentId: string): Promise<GeneratedDocument> {
  return authedRequest<GeneratedDocument>(`/documents/${documentId}`, token);
}
