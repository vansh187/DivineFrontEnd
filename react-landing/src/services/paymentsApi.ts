import { ApiError, API_BASE_URL } from './authApi';

export interface PaymentOrder {
  payment_id: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  amount_paise: number;
  currency: string;
  status: string;
}

export interface PaymentRecord {
  id: string;
  owner_id: string;
  owner_role: string;
  amount: number;
  currency: string;
  status: string;
  method: 'razorpay' | 'cash';
  verified: boolean;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  created_date: string;
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function messageForPaymentError(status: number, detail: unknown): string {
  if (status === 401) {
    return detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 403) return 'You can only access your own payments.';
  if (status === 404) return 'That payment could not be found.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 400) {
    if (detail === 'invalid_amount') return 'Enter a valid amount.';
    if (detail === 'amount_too_large') return 'That amount is too large — please contact us directly for large payments.';
  }
  if (typeof detail === 'string' && detail.startsWith('payment_')) {
    return 'Something went wrong starting your payment. Please try again.';
  }
  if (status === 422) return 'Please check the amount you entered.';
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
    throw new ApiError(res.status, detail, messageForPaymentError(res.status, detail));
  }

  return data as T;
}

export function createPaymentOrder(token: string, amount: number): Promise<PaymentOrder> {
  return authedRequest<PaymentOrder>('/payments/create-order', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
}

/** Sends Razorpay's checkout callback fields (order id, payment id, signature) to the
 * backend to be cryptographically verified — the frontend never decides "paid" on its own,
 * only the backend's signature check (against Razorpay's key_secret) does. */
export function verifyPayment(token: string, input: VerifyPaymentInput): Promise<PaymentRecord> {
  return authedRequest<PaymentRecord>('/payments/verify', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** Records cash already collected in person — settles immediately server-side, no
 * gateway involved (unlike createPaymentOrder/verifyPayment). */
export function recordCashPayment(token: string, amount: number, note?: string): Promise<PaymentRecord> {
  return authedRequest<PaymentRecord>('/payments/cash', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, note: note || undefined }),
  });
}
