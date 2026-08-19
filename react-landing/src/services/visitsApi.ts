import { authedRequest as authedRequestBase } from './authApi';

export interface VisitRecord {
  id: string;
  broker_id: string;
  customer_name: string;
  customer_contact: string;
  date: string;
  time: string;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
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
  if (status === 405) return 'Visit history is not available yet. Please ask the backend team to enable GET /visits/history.';
  if (status === 400) {
    if (detail === 'invalid_date') return 'Choose a valid visit date.';
    if (detail === 'invalid_time') return 'Choose a valid visit time.';
  }
  if (status === 422) return 'Please check the visit details.';
  return 'Something went wrong with site visits. Please try again.';
}

function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return authedRequestBase<T>(path, token, messageForVisitsError, init);
}

export function listVisits(token: string): Promise<VisitRecord[]> {
  return authedRequest<VisitRecord[]>('/visits', token);
}

export function listVisitHistory(token: string): Promise<VisitRecord[]> {
  return authedRequest<VisitRecord[]>('/visits/history', token);
}

export function createVisit(token: string, input: CreateVisitInput): Promise<VisitRecord> {
  return authedRequest<VisitRecord>('/visits', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function cancelVisit(token: string, visitId: string): Promise<VisitRecord> {
  return authedRequest<VisitRecord>(`/visits/${encodeURIComponent(visitId)}`, token, { method: 'DELETE' });
}
