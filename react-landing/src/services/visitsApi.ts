import { ApiError, API_BASE_URL, authedRequest as authedRequestBase } from './authApi';
import type { ApplicationProjectId } from '../data/applicationProjects';

export interface VisitRecord {
  id: string;
  broker_id: string | null;
  customer_name: string;
  customer_contact: string;
  /** Only set for website self-service requests - lets a signed-in customer's
   *  visits be matched back to them via GET /visits/mine. */
  customer_email?: string | null;
  /** Which township this visit is for - required on every visit, channel-partner
   *  or self-service, so the admin Site Visits table can filter/group by project. */
  project: ApplicationProjectId;
  date: string;
  time: string;
  notes: string | null;
  status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
  /** How the visit entered the system - drives the admin table's SOURCE column. */
  source: 'website' | 'broker';
  created_date: string;
}

export interface CreateVisitInput {
  customer_name: string;
  customer_contact?: string;
  project: ApplicationProjectId;
  date: string;
  time: string;
  notes?: string;
}

export type PreferredVisitWindow = 'today' | 'tomorrow' | 'weekend';

export interface SiteVisitRequestInput {
  customer_name: string;
  customer_contact: string;
  customer_email?: string;
  project: ApplicationProjectId;
  preferred_window: PreferredVisitWindow;
  notes?: string;
}

function messageForVisitsError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
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
  if (status === 405) return 'That visits action is not available yet. Please ask the backend team to enable the endpoint.';
  if (status === 429) return 'Too many requests. Please wait a minute and try again.';
  if (status === 400) {
    if (detail === 'invalid_date') return 'Choose a valid visit date.';
    if (detail === 'invalid_time') return 'Choose a valid visit time.';
    if (detail === 'invalid_project') return 'Choose which project you would like to visit.';
  }
  if (status === 422) return 'Please check the visit details.';
  return 'Something went wrong with site visits. Please try again.';
}

function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return authedRequestBase<T>(path, token, messageForVisitsError, init);
}

/** The drawer's callback-request form runs on the public landing page, often
 *  before a visitor has signed in - unlike every other visits call, this one
 *  carries no bearer token. */
async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, null, messageForVisitsError(0, null));
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

/** A signed-in customer's own visits (both self-requested from the drawer and
 *  any a broker scheduled for them), matched server-side by their account
 *  email - unlike listVisits(), which is broker-only. */
export function listMyVisits(token: string): Promise<VisitRecord[]> {
  return authedRequest<VisitRecord[]>('/visits/mine', token);
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

/** Customer self-service callback request from the "Plan your visit" drawer -
 *  no sign-in required, so it lands as an unassigned, unscheduled lead
 *  (status "requested", source "website") for sales to confirm a slot for. */
export function requestSiteVisit(input: SiteVisitRequestInput): Promise<VisitRecord> {
  return publicRequest<VisitRecord>('/visits/request', input);
}

export function cancelVisit(token: string, visitId: string): Promise<VisitRecord> {
  return authedRequest<VisitRecord>(`/visits/${encodeURIComponent(visitId)}`, token, { method: 'DELETE' });
}

/** Mark a scheduled visit as completed once the meeting has happened, recording
 *  the broker's outcome notes. */
export function completeVisit(token: string, visitId: string, notes: string): Promise<VisitRecord> {
  return authedRequest<VisitRecord>(`/visits/${encodeURIComponent(visitId)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed', notes }),
  });
}
