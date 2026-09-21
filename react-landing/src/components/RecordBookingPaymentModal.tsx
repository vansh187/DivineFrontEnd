import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { InventoryUnit } from '../services/inventoryApi';
import { createPaymentOrder, recordCashPayment, verifyPayment, type PaymentRecord } from '../services/paymentsApi';
import { openZohoCheckout } from '../services/zohoCheckout';
import { ApiError } from '../services/authApi';
import { amountToIndianWords, formatCurrencyINR } from '../utils/currency';

interface RecordBookingPaymentModalProps {
  unit: InventoryUnit;
  onClose: () => void;
  /** Fired once the backend confirms the plot moved reserved -> booked. */
  onBooked: (unit: InventoryUnit) => void;
}

/** On-booking instalment = 10% of the agreed Total Plot Amount. Same rule the
 * customer application form derives the booking amount with. */
const BOOKING_SHARE = 0.1;

function parseAmount(value: string): number {
  const cleaned = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(cleaned) ? cleaned : 0;
}

export function RecordBookingPaymentModal({ unit, onClose, onBooked }: RecordBookingPaymentModalProps) {
  const { session } = useAuth();
  const [totalPlotAmount, setTotalPlotAmount] = useState(
    unit.estimated_price != null ? String(Math.round(unit.estimated_price)) : '',
  );
  const [busy, setBusy] = useState<'cash' | 'online' | null>(null);
  const [error, setError] = useState('');

  const bookingAmount = useMemo(() => {
    const total = parseAmount(totalPlotAmount);
    return total > 0 ? Math.round(total * BOOKING_SHARE) : 0;
  }, [totalPlotAmount]);

  const describeError = (err: unknown) =>
    err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong. Please try again.';

  const finish = (record: PaymentRecord, requireVerified: boolean) => {
    if (requireVerified && !record.verified) {
      setError('Payment could not be verified. Please try again or contact the office.');
      return;
    }
    // Payment settled but the backend says the plot was already taken.
    if (record.inventory_status === 'conflict') {
      setError(
        record.inventory_conflict_reason === 'unit_not_available'
          ? 'This plot is no longer available. The payment is recorded and flagged for manual review — please contact the office.'
          : 'The payment is recorded, but the plot could not be marked booked. It is flagged for manual review — please contact the office.',
      );
      return;
    }
    // 'pending_kyc_review', 'booked', or the backend doesn't report an inventory
    // status yet — either way the payment settled and the plot is held/booked,
    // so treat the lead as converted and drop it from the available list.
    onBooked(unit);
  };

  const handleCash = async () => {
    if (!session || bookingAmount <= 0) return;
    setBusy('cash');
    setError('');
    try {
      const record = await recordCashPayment(
        session.token,
        bookingAmount,
        `Booking amount for ${unit.project_name}${unit.unit_number ? ` Plot ${unit.unit_number}` : ''} (channel partner).`,
        { purpose: 'plot_booking', inventoryId: unit.id },
      );
      // Cash settles immediately on a successful response — no verification gate.
      finish(record, false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const handleOnline = async () => {
    if (!session || bookingAmount <= 0) return;
    setBusy('online');
    setError('');
    try {
      const order = await createPaymentOrder(session.token, bookingAmount, {
        purpose: 'plot_booking',
        inventoryId: unit.id,
      });
      const result = await openZohoCheckout({
        accountId: order.zoho_account_id,
        amount: order.amount,
        currency: order.currency,
        paymentsSessionId: order.zoho_payments_session_id,
        name: 'Divine Vision Infratech',
        description: `Booking payment · ${unit.project_name}${unit.unit_number ? ` · Plot ${unit.unit_number}` : ''}`,
      });
      const record = await verifyPayment(session.token, {
        zoho_payments_session_id: result.zoho_payments_session_id,
        zoho_payment_id: result.zoho_payment_id,
      });
      finish(record, true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-[0_26px_60px_-24px_rgba(6,31,45,0.4)]">
        <p className="eyebrow-label text-terracotta">Record booking payment</p>
        <h3 className="mt-2 font-display text-lg font-bold text-ink">
          {unit.project_name}
          {unit.unit_number ? ` · Plot ${unit.unit_number}` : ''}
        </h3>
        <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
          Enter the agreed Total Plot Amount. The booking instalment is 10% of it. Once the payment settles, the plot
          is held for this customer while their KYC is reviewed, and leaves the available list.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-semibold text-ink">Total Plot Amount (Rs.)</span>
          <input
            type="number"
            inputMode="numeric"
            value={totalPlotAmount}
            onChange={(event) => setTotalPlotAmount(event.target.value)}
            placeholder="e.g. 5000000"
            disabled={busy !== null}
            className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <div className="mt-3 rounded-lg border border-hairline bg-bg px-3 py-3">
          <p className="text-xs font-semibold text-ink-muted">Booking instalment (10%)</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">
            {bookingAmount > 0 ? formatCurrencyINR(bookingAmount) : '—'}
          </p>
          {bookingAmount > 0 && <p className="mt-1 text-[11px] text-ink-muted">{amountToIndianWords(bookingAmount)}</p>}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleOnline}
            disabled={bookingAmount <= 0 || busy !== null}
            className="w-full rounded-full bg-green px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'online' ? 'Processing…' : 'Pay online (Zoho Pay)'}
          </button>
          <button
            type="button"
            onClick={handleCash}
            disabled={bookingAmount <= 0 || busy !== null}
            className="w-full rounded-full border border-hairline px-4 py-2.5 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'cash' ? 'Recording…' : 'Record cash payment'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="w-full rounded-full px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
