import { authedRequest as authedRequestBase } from './authApi';

/** Contract with the backend's `POST /payments/create-order` for Zoho Payments'
 * *hosted checkout* - a full-page redirect, not an embedded widget. `checkout_url`
 * is where the customer's browser must be sent (`window.location.href =
 * checkout_url`) - it already embeds the access_key the backend also returns
 * (`https://payments.zoho.in/hostedcheckout/<access_key>`), so the frontend
 * never needs that field on its own. Zoho later redirects the browser back to
 * whichever of ZOHO_PAYMENTS_SUCCESS_URL / ZOHO_PAYMENTS_FAILURE_URL applies,
 * appending the fields `VerifyPaymentInput` expects as a query string. See
 * ZOHO_PAYMENTS_SETUP.md. */
export interface PaymentOrder {
  payment_id: string;
  checkout_url: string;
  amount: number;
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
 *  - `pending_kyc_review` — the plot is held for this buyer while an admin
 *                 reviews their KYC documents; not booked yet
 *  - `booked`   — KYC was approved and the plot is now locked to this buyer
 *                 (only reachable via the KYC approval flow now, not directly
 *                 on payment settlement)
 *  - `conflict` — the payment went through but the plot was already taken; the
 *                 money is safe and flagged for manual review server-side
 *  - `null`     — this payment had no `plot_booking` purpose, so nothing happened
 */
export type InventoryLockStatus = 'pending_kyc_review' | 'booked' | 'conflict' | null;

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

export type CashPaymentMethod = 'cash' | 'rtgs_neft';

export interface PaymentRecord {
  id: string;
  owner_id: string;
  owner_role: string;
  amount: number;
  currency: string;
  status: string;
  method: 'zoho' | 'cash' | 'rtgs_neft';
  verified: boolean;
  zoho_payments_session_id: string;
  zoho_payment_id: string | null;
  created_date: string;
  /** Present on a `plot_booking` payment - the unit the backend tried to lock. */
  inventory_id?: string | null;
  /** Result of that lock attempt - see InventoryLockStatus. */
  inventory_status?: InventoryLockStatus;
  /** Populated only when `inventory_status === 'conflict'`. */
  inventory_conflict_reason?: InventoryConflictReason;
  /** Present on a `plot_booking` payment once inventory_status is set - the
   *  booking record to poll via bookingsApi (GET /bookings/mine) and, once
   *  approved, download the receipt for. */
  booking_id?: string | null;
}

/** The exact query-string fields Zoho's hosted checkout appends when it redirects
 * the browser back to the success/failure URL - forwarded to the backend
 * unchanged (see ZOHO_PAYMENTS_SETUP.md). `udf1`-`udf5` are only present if the
 * backend set them when creating the order. */
export interface VerifyPaymentInput {
  payments_session_id: string;
  payment_id: string;
  payment_status: string;
  amount: string;
  signature: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
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
    if (detail === 'invalid_method') return 'Choose a valid payment method.';
    if (detail === 'utr_number_required') return 'Enter the UTR number for this bank transfer.';
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

/** Sends Zoho Payments' checkout callback fields (payment id + payments session id) to
 * the backend to be confirmed server-side against Zoho's API — the frontend never decides
 * "paid" on its own, only that backend confirmation does. */
export function verifyPayment(token: string, input: VerifyPaymentInput): Promise<PaymentRecord> {
  return authedRequest<PaymentRecord>('/payments/verify', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** Records cash (or an already-completed RTGS/NEFT transfer) collected outside
 * Zoho Pay — settles immediately server-side, no gateway involved (unlike
 * createPaymentOrder/verifyPayment). `utrNumber` is required when
 * `method` is `'rtgs_neft'`; omit both for a plain cash record. */
export function recordCashPayment(
  token: string,
  amount: number,
  note?: string,
  opts: BookingPaymentOptions = {},
  method: CashPaymentMethod = 'cash',
  utrNumber?: string | null,
): Promise<PaymentRecord> {
  return authedRequest<PaymentRecord>('/payments/cash', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      note: note || undefined,
      purpose: opts.purpose ?? 'other',
      method,
      ...(utrNumber ? { utr_number: utrNumber } : {}),
      ...(opts.inventoryId ? { inventory_id: opts.inventoryId } : {}),
      ...(opts.installmentNo != null ? { installment_no: opts.installmentNo } : {}),
      ...(opts.dueDate ? { due_date: opts.dueDate } : {}),
    }),
  });
}
