import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/authApi';
import { verifyPayment } from '../services/paymentsApi';
import { loadCustomerDocs, saveCustomerDocs, markInstallmentPaidLocally } from '../services/documentStore';
import { clearPendingUnit } from '../services/pendingUnit';
import { readPendingZohoPayment, clearPendingZohoPayment } from '../services/pendingZohoPayment';

type Status = 'verifying' | 'confirmed' | 'failed';

function continuePath(role: 'customer' | 'broker' | undefined, pendingReturnPath: string | undefined): string {
  if (role === 'broker') return '/broker/plots';
  return pendingReturnPath || '/customer/profile';
}

/**
 * Landing page Zoho's hosted checkout redirects the browser back to after the
 * customer/broker leaves the app to pay - see ZOHO_PAYMENTS_SETUP.md. Both
 * ZOHO_PAYMENTS_SUCCESS_URL and ZOHO_PAYMENTS_FAILURE_URL append the same query
 * fields; `outcome` only tints the initial "verifying" copy, since the actual
 * result always comes from what POST /payments/verify reports back, never from
 * which URL Zoho happened to redirect to.
 */
export function PaymentResultPage({ outcome }: { outcome: 'success' | 'failure' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const ranRef = useRef(false);
  const pending = useRef(readPendingZohoPayment()).current;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(location.search);
    const paymentsSessionId = params.get('payments_session_id');
    const paymentId = params.get('payment_id');

    if (!session) {
      setStatus('failed');
      setMessage('Please sign in to confirm this payment, then contact support with your payment details if it isn’t reflected.');
      return;
    }
    if (!paymentsSessionId || !paymentId) {
      setStatus('failed');
      setMessage('This payment link is missing required details. Please contact support if an amount was charged.');
      return;
    }

    verifyPayment(session.token, {
      payments_session_id: paymentsSessionId,
      payment_id: paymentId,
      payment_status: params.get('payment_status') ?? '',
      amount: params.get('amount') ?? '',
      signature: params.get('signature') ?? '',
      udf1: params.get('udf1') ?? undefined,
      udf2: params.get('udf2') ?? undefined,
      udf3: params.get('udf3') ?? undefined,
      udf4: params.get('udf4') ?? undefined,
      udf5: params.get('udf5') ?? undefined,
    })
      .then((record) => {
        if (!record.verified) {
          setStatus('failed');
          setMessage('Payment could not be verified. Please try again or contact support.');
          return;
        }

        // A confirmed payment for less than the fixed 10% booking instalment is
        // not acceptable - same isShortPayment guard the old in-page checkout
        // applied right after verify, before this became a redirect flow.
        // Bail out before the optimistic local update below, exactly like the
        // old code did, so the local cache never claims "paid" for a short
        // amount even though the backend already recorded the payment itself.
        if (
          pending?.purpose === 'plot_booking' &&
          pending.expectedAmount != null &&
          record.amount + 1 < pending.expectedAmount
        ) {
          setStatus('failed');
          setMessage('Please correct the amount. If you were charged, contact support before trying again.');
          return;
        }

        // Best-effort optimistic local update so the app reflects the payment
        // immediately instead of waiting for the next GET /customer/profile -
        // mirrors what the old in-page checkout applied synchronously. Never
        // blocks showing confirmation either way; a failure here just means
        // the next profile refresh catches up instead.
        try {
          if (pending?.role === 'customer' && session.role === 'customer') {
            if (pending.purpose === 'plot_booking') {
              const docs = loadCustomerDocs(pending.email);
              saveCustomerDocs(pending.email, {
                ...docs,
                payment: {
                  paymentId: record.id,
                  amount: record.amount,
                  status: 'paid',
                  method: record.method,
                  zohoPaymentsSessionId: record.zoho_payments_session_id,
                  zohoPaymentId: record.zoho_payment_id,
                  paidAt: new Date().toISOString(),
                  inventoryStatus: record.inventory_status ?? null,
                  inventoryConflictReason: record.inventory_conflict_reason ?? null,
                  error: null,
                },
              });
              clearPendingUnit(pending.email);
            } else if (pending.purpose === 'installment' && pending.installmentNo != null) {
              markInstallmentPaidLocally(pending.email, pending.installmentNo, record.amount);
            }
          }
        } catch {
          /* next profile refresh picks this up regardless */
        }

        setStatus('confirmed');
        setMessage(
          record.inventory_status === 'conflict'
            ? 'Your payment is confirmed, but this plot needs manual review — our team will reach out shortly.'
            : 'Your payment is confirmed.',
        );
      })
      .catch((err) => {
        setStatus('failed');
        setMessage(err instanceof ApiError ? err.message : 'Payment could not be verified. Please try again or contact support.');
      })
      .finally(() => {
        clearPendingZohoPayment();
      });
    // Only ever runs once per page load (guarded by ranRef) - session/location
    // are read at that moment, not meant to re-trigger a second verify.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dest = continuePath(session?.role, pending?.returnPath);

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        {status === 'verifying' && (
          <>
            <p className="eyebrow-label text-terracotta">
              {outcome === 'success' ? 'Confirming payment' : 'Checking payment status'}
            </p>
            <h1 className="font-display text-2xl font-bold text-ink">Just a moment…</h1>
            <p className="text-sm text-ink-muted">We're confirming your payment with the bank. This only takes a few seconds.</p>
          </>
        )}

        {status === 'confirmed' && (
          <>
            <p className="eyebrow-label text-green">Payment confirmed</p>
            <h1 className="font-display text-2xl font-bold text-ink">Thank you</h1>
            <p className="text-sm text-ink-muted">{message}</p>
            <button
              type="button"
              onClick={() => navigate(dest, { replace: true })}
              className="mt-2 rounded-none border border-green bg-green px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-terracotta hover:bg-terracotta"
            >
              Continue
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <p className="eyebrow-label text-terracotta">Payment not confirmed</p>
            <h1 className="font-display text-2xl font-bold text-ink">We couldn’t confirm that payment</h1>
            <p className="text-sm text-ink-muted">{message}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate(dest, { replace: true })}
                className="rounded-none border border-green bg-green px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-terracotta hover:bg-terracotta"
              >
                Try again
              </button>
              <Link
                to="/"
                className="rounded-none border border-hairline px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-ink transition-colors hover:border-terracotta hover:text-terracotta"
              >
                Back to home
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
