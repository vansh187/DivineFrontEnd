import { ApiError, API_BASE_URL } from './authApi';

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
