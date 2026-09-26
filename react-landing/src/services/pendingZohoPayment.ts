import type { PaymentPurpose } from './paymentsApi';

/**
 * Zoho Payments' hosted checkout is a full-page redirect: the browser leaves the
 * app entirely, then comes back on a fresh page load at
 * /customer/payments/success|failure. Whatever in-memory state the payment
 * button's page had (which booking, which installment) is gone by then - this
 * stashes just enough of it, right before redirecting, for PaymentResultPage to
 * apply the same optimistic local update the old in-page checkout used to do
 * synchronously. sessionStorage (not localStorage) since it only needs to
 * survive this one round trip, same tab.
 */
export interface PendingZohoPayment {
  purpose: PaymentPurpose;
  email: string;
  role: 'customer' | 'broker';
  installmentNo?: number | null;
  /** The amount requested when the order was created - purpose `plot_booking`
   * only. PaymentResultPage compares the verified payment's amount against
   * this (the same short-payment guard the old in-page checkout applied
   * right after verify, before this became a redirect flow). */
  expectedAmount?: number | null;
  /** Where "Try again" should send the visitor back to on a failed/unverified payment. */
  returnPath: string;
  at: number;
}

const KEY = 'dvi_pending_zoho_payment';
// Generous but bounded - covers a slow hosted-checkout session without letting a
// stale entry from a long-abandoned tab apply itself to some unrelated payment.
const TTL_MS = 60 * 60 * 1000;

export function stashPendingZohoPayment(context: Omit<PendingZohoPayment, 'at'>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...context, at: Date.now() }));
  } catch {
    /* private-browsing / storage-disabled - PaymentResultPage falls back to a
     * plain backend re-fetch on the next profile load instead of an optimistic
     * local update. */
  }
}

export function readPendingZohoPayment(): PendingZohoPayment | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingZohoPayment;
    if (!parsed?.email || Date.now() - parsed.at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingZohoPayment(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
