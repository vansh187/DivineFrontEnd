import { ApiError, API_BASE_URL } from './authApi';

export interface VisitRecord {
  id: string;
  broker_id: string;
  customer_name: string;
  customer_contact: string;
  date: string;
  time: string;
  notes: string;
  status: 'scheduled' | 'cancelled';
  created_date: string;
}

export interface CreateVisitInput {
  customer_name: string;
  customer_contact?: string;
  date: string;
  time: string;
  notes?: string;
}

function messageForVisitsError(status: number, detail: unknown): string {
  if (status === 401) {
    return detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 403) {
    return detail === 'visits_broker_only'
      ? 'Only brokers can schedule site visits.'
      : 'You can only manage your own visits.';
  }
  if (status === 404) return 'That visit could not be found.';
  if (status === 400) {
    if (detail === 'invalid_date') return 'Choose a valid visit date.';
    if (detail === 'invalid_time') return 'Choose a valid visit time.';
  }
  if (status === 422) return 'Please check the visit details.';
  return 'Something went wrong with site visits. Please try again.';
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
    throw new ApiError(res.status, detail, messageForVisitsError(res.status, detail));
  }

  return data as T;
}

export function listVisits(token: string): Promise<VisitRecord[]> {
  return authedRequest<VisitRecord[]>('/visits', token);
}

export function createVisit(token: string, input: CreateVisitInput): Promise<VisitRecord> {
  return authedRequest<VisitRecord>('/visits', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function cancelVisit(token: string, visitId: string): Promise<VisitRecord> {
  return authedRequest<VisitRecord>(`/visits/${visitId}`, token, { method: 'DELETE' });
}
