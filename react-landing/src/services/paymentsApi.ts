import { authedRequest as authedRequestBase } from './authApi';

export interface PaymentOrder {
  payment_id: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  amount_paise: number;
  currency: string;
  status: string;
}

/** Why the payment is being made.
 *  - `plot_booking` — the 10% booking amount; tells the backend to lock the
 *    linked inventory unit (see `inventory_id`) the moment this payment settles.
 *  - `installment`  — a later milestone of the construction-linked plan; carries
 *    `installment_no` + `due_date` so the backend can mark that milestone paid.
 *  - `other`        — anything else. */
export type PaymentPurpose = 'plot_booking' | 'installment' | 'other';

/** Outcome of the inventory lock the backend attempts when a `plot_booking`
 * payment settles:
 *  - `booked`   — the plot was free and is now locked to this buyer
 *  - `conflict` — the payment went through but the plot was already taken; the
 *                 money is safe and flagged for manual review server-side
 *  - `null`     — this payment had no `plot_booking` purpose, so nothing happened
 */
export type InventoryLockStatus = 'booked' | 'conflict' | null;

/** Only set when `inventory_status === 'conflict'`. */
export type InventoryConflictReason = 'unit_not_available' | 'inventory_update_failed' | null;

export interface BookingPaymentOptions {
  purpose?: PaymentPurpose;
  /** Inventory unit id (`InventoryUnit.id`) the booking amount is being paid for. */
  inventoryId?: string | null;
  /** purpose `installment`: 1-based milestone number in the payment plan. */
  installmentNo?: number | null;
  /** purpose `installment`: that milestone's ISO (`YYYY-MM-DD`) due date. */
  dueDate?: string | null;
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
  /** Present on a `plot_booking` payment - the unit the backend tried to lock. */
  inventory_id?: string | null;
  /** Result of that lock attempt - see InventoryLockStatus. */
  inventory_status?: InventoryLockStatus;
  /** Populated only when `inventory_status === 'conflict'`. */
  inventory_conflict_reason?: InventoryConflictReason;
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function messageForPaymentError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
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
    if (detail === 'invalid_purpose') return 'Something went wrong starting your payment. Please refresh and try again.';
  }
  if (typeof detail === 'string' && detail.startsWith('payment_')) {
    return 'Something went wrong starting your payment. Please try again.';
  }
  if (status === 422) return 'Please check the amount you entered.';
  return 'Something went wrong. Please try again.';
}

function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return authedRequestBase<T>(path, token, messageForPaymentError, init);
}

export function createPaymentOrder(
  token: string,
  amount: number,
  opts: BookingPaymentOptions = {},
): Promise<PaymentOrder> {
  return authedRequest<PaymentOrder>('/payments/create-order', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      purpose: opts.purpose ?? 'other',
      ...(opts.inventoryId ? { inventory_id: opts.inventoryId } : {}),
      ...(opts.installmentNo != null ? { installment_no: opts.installmentNo } : {}),
      ...(opts.dueDate ? { due_date: opts.dueDate } : {}),
    }),
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
export function recordCashPayment(
  token: string,
  amount: number,
  note?: string,
  opts: BookingPaymentOptions = {},
): Promise<PaymentRecord> {
  return authedRequest<PaymentRecord>('/payments/cash', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      note: note || undefined,
      purpose: opts.purpose ?? 'other',
      ...(opts.inventoryId ? { inventory_id: opts.inventoryId } : {}),
      ...(opts.installmentNo != null ? { installment_no: opts.installmentNo } : {}),
      ...(opts.dueDate ? { due_date: opts.dueDate } : {}),
    }),
  });
}
