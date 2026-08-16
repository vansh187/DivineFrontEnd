import { ApiError, API_BASE_URL } from './authApi';

export type CommissionStatus = 'pending' | 'paid' | 'rejected';
export type CommissionTransactionMode = 'cash' | 'booking';

export interface CommissionRecord {
  id: string;
  brokerId: string;
  serialNumber: string;
  unitAddress: string;
  customerName?: string | null;
  township?: string | null;
  saleValue?: number | null;
  commissionAmount: number;
  status: CommissionStatus;
  transactionMode: CommissionTransactionMode;
  createdAt: string;
  paidAt: string | null;
  rejectedAt: string | null;
}

export interface CreateCashCommissionInput {
  brokerId: string;
  serialNumber: string;
  unitAddress: string;
  customerName?: string;
  township?: string;
  saleValue?: number;
  commissionAmount: number;
  transactionMode: 'cash';
}

export interface CommissionSummary {
  pending: number;
  paid: number;
  rejected: number;
}

export interface CreateCommissionResponse {
  success: boolean;
  commission: CommissionRecord;
}

export interface ListCommissionsResponse {
  success: boolean;
  commissions: CommissionRecord[];
  summary: CommissionSummary;
}

function messageForCommissionError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
  if (status === 401) {
    return detail === 'expired token' || detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 403) {
    if (detail === 'broker_only') return 'Only brokers can add commission records.';
    return 'You can only manage your own commission records.';
  }
  if (status === 409) return 'This commission record already exists.';
  if (status === 400) {
    if (detail === 'transactionMode_must_be_cash') return 'Broker commission records must be cash transactions.';
    if (typeof detail === 'string') {
      if (detail.endsWith('_required')) return 'Please fill all required commission details.';
      if (detail.startsWith('invalid_')) return 'Please check the commission details and try again.';
    }
  }
  if (status === 422) return 'Please check the commission details and try again.';
  if (status === 500) return 'Something went wrong on our end. Please try again shortly.';
  return 'Something went wrong with commissions. Please try again.';
}

async function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, null, messageForCommissionError(0, null));
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForCommissionError(res.status, detail));
  }

  return data as T;
}

export async function listBrokerCommissions(token: string, brokerId: string): Promise<ListCommissionsResponse> {
  return authedRequest<ListCommissionsResponse>(`/api/broker/commissions?brokerId=${encodeURIComponent(brokerId)}`, token);
}

export async function createBrokerCashCommission(
  token: string,
  input: CreateCashCommissionInput,
): Promise<CreateCommissionResponse> {
  return authedRequest<CreateCommissionResponse>('/api/broker/commissions', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
