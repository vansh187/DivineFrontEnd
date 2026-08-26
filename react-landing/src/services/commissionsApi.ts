import { authedRequest as authedRequestBase } from './authApi';

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

export interface CommissionSummary {
  pending: number;
  paid: number;
  rejected: number;
}

export interface ListCommissionsResponse {
  success: boolean;
  commissions: CommissionRecord[];
  summary: CommissionSummary;
}

type RawCommissionRecord = Partial<CommissionRecord> & {
  broker_id?: string;
  serial_number?: string;
  unit_address?: string;
  customer_name?: string | null;
  sale_value?: number | null;
  commission_amount?: number;
  transaction_mode?: CommissionTransactionMode;
  created_at?: string;
  created_date?: string;
  paid_at?: string | null;
  rejected_at?: string | null;
};

type RawSummary = Partial<CommissionSummary>;

function normalizeCommission(record: RawCommissionRecord): CommissionRecord {
  return {
    id: record.id ?? '',
    brokerId: record.brokerId ?? record.broker_id ?? '',
    serialNumber: record.serialNumber ?? record.serial_number ?? '',
    unitAddress: record.unitAddress ?? record.unit_address ?? '',
    customerName: record.customerName ?? record.customer_name ?? null,
    township: record.township ?? null,
    saleValue: record.saleValue ?? record.sale_value ?? null,
    commissionAmount: record.commissionAmount ?? record.commission_amount ?? 0,
    status: record.status ?? 'pending',
    transactionMode: record.transactionMode ?? record.transaction_mode ?? 'cash',
    createdAt: record.createdAt ?? record.created_at ?? record.created_date ?? '',
    paidAt: record.paidAt ?? record.paid_at ?? null,
    rejectedAt: record.rejectedAt ?? record.rejected_at ?? null,
  };
}

function normalizeSummary(summary: RawSummary | null | undefined): CommissionSummary {
  return {
    pending: summary?.pending ?? 0,
    paid: summary?.paid ?? 0,
    rejected: summary?.rejected ?? 0,
  };
}

function messageForCommissionError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
  if (status === 401) {
    return detail === 'expired token' || detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 403) return 'You can only view your own commission records.';
  if (status === 500) return 'Something went wrong on our end. Please try again shortly.';
  return 'Something went wrong with commissions. Please try again.';
}

function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return authedRequestBase<T>(path, token, messageForCommissionError, init);
}

export async function listBrokerCommissions(token: string, brokerId: string): Promise<ListCommissionsResponse> {
  const res = await authedRequest<{ success: boolean; commissions?: RawCommissionRecord[]; summary?: RawSummary }>(
    `/api/broker/commissions?brokerId=${encodeURIComponent(brokerId)}`,
    token,
  );
  return {
    success: res.success,
    commissions: (res.commissions ?? []).map(normalizeCommission),
    summary: normalizeSummary(res.summary),
  };
}
