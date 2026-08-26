import { ApiError, API_BASE_URL, authedRequest as authedRequestBase } from './authApi';

export interface InventoryUnit {
  id: string;
  project_name: string;
  city: string | null;
  locality: string | null;
  block: string | null;
  unit_number: string | null;
  unit_type: string | null;
  width_mtr: number | null;
  length_mtr: number | null;
  area_sqmt: number | null;
  area_sqyd: number | null;
  status: string | null;
  estimated_price: number | null;
  /** Only present while status === 'reserved' - the 3-day exclusive-hold window a
   * channel partner gets after reserving this unit (see /inventory/:id/reserve). */
  reserved_at?: string | null;
  reserved_until?: string | null;
}

export interface InventorySearchFilters {
  project_name?: string;
  city?: string;
  unit_type?: string;
  status?: string;
  min_area_sqyd?: number;
  max_area_sqyd?: number;
  min_budget?: number;
  max_budget?: number;
  limit?: number;
  offset?: number;
  session_id?: string;
  lead_id?: string;
}

export interface InventorySearchResponse {
  count: number;
  units: InventoryUnit[];
}

export interface InventoryNlSearchResponse extends InventorySearchResponse {
  parsed_filters: Partial<InventorySearchFilters>;
}

export interface InventoryRecommendationsResponse {
  best_fit: InventoryUnit[];
  similar_alternatives: Record<string, InventoryUnit[]>;
}

function messageForInventoryError(status: number): string {
  if (status === 0) return 'Could not reach inventory right now. Check your connection and try again.';
  if (status === 400) return 'Please adjust your search and try again.';
  return 'Inventory search is unavailable right now. Please try again shortly.';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(0, null, messageForInventoryError(0));
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForInventoryError(res.status));
  }

  return (data ?? {}) as T;
}

function withQuery(path: string, params: object) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if ((typeof value === 'string' || typeof value === 'number') && value !== '') query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export function searchInventory(filters: InventorySearchFilters): Promise<InventorySearchResponse> {
  return requestJson<InventorySearchResponse>(withQuery('/inventory/search', filters));
}

export function searchInventoryNaturalLanguage(input: {
  query: string;
  session_id?: string;
  lead_id?: string;
}): Promise<InventoryNlSearchResponse> {
  return requestJson<InventoryNlSearchResponse>('/inventory/search/nl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function recordInventoryView(
  inventoryId: string,
  input: { lead_id?: string; session_id?: string },
): Promise<{ recorded: boolean }> {
  return requestJson<{ recorded: boolean }>(`/inventory/${encodeURIComponent(inventoryId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getInventoryRecommendations(input: {
  lead_id?: string;
  session_id?: string;
  limit?: number;
}): Promise<InventoryRecommendationsResponse> {
  return requestJson<InventoryRecommendationsResponse>(
    withQuery('/inventory/recommendations', {
      lead_id: input.lead_id,
      session_id: input.session_id,
      limit: input.limit ?? 10,
    }),
  );
}

export interface ReservedUnitsResponse {
  count: number;
  reservations: InventoryUnit[];
}

function messageForReservationError(status: number, detail: unknown): string {
  if (status === 401) {
    if (detail === 'token_expired') return 'Your session has expired. Please sign in again.';
    return 'Please sign in again to continue.';
  }
  if (status === 403) return 'Only channel partners can reserve inventory.';
  if (status === 409) {
    if (detail === 'unit_not_available') return 'This plot was just reserved by another channel partner.';
    if (detail === 'not_reserved_by_you') return 'This plot is not reserved by you.';
  }
  return 'Something went wrong with this reservation. Please try again.';
}

function authedInventoryRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return authedRequestBase<T>(path, token, messageForReservationError, init);
}

/** Locks a plot exclusively for the calling channel partner for 3 days - it drops out
 * of everyone else's /inventory/search results until released, sold, or expired. */
export function reserveInventoryUnit(token: string, unitId: string): Promise<InventoryUnit> {
  return authedInventoryRequest<InventoryUnit>(`/inventory/${encodeURIComponent(unitId)}/reserve`, token, { method: 'POST' });
}

/** Releases a unit this broker reserved early, putting it back in the available pool. */
export function releaseInventoryUnit(token: string, unitId: string): Promise<InventoryUnit> {
  return authedInventoryRequest<InventoryUnit>(`/inventory/${encodeURIComponent(unitId)}/release`, token, { method: 'POST' });
}

/** Marks a reserved unit as sold, closing out the reservation permanently. */
export function markInventoryUnitSold(token: string, unitId: string): Promise<InventoryUnit> {
  return authedInventoryRequest<InventoryUnit>(`/inventory/${encodeURIComponent(unitId)}/mark-sold`, token, { method: 'POST' });
}

/** This broker's own active reservations ("My leads") - never includes another
 * channel partner's locked units. */
export function listMyReservedUnits(token: string): Promise<ReservedUnitsResponse> {
  return authedInventoryRequest<ReservedUnitsResponse>('/inventory/reserved/mine', token);
}
