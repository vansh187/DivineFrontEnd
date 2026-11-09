import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePaymentPlanPreview } from '../hooks/usePaymentPlanPreview';
import { PaymentPlanPicker } from './PaymentPlanPicker';
import { matchApplicationProjectId } from '../data/applicationProjects';
import { roundHalfUp, sanitizeAmountInput } from '../services/pricingCalc';
import type { InventoryUnit } from '../services/inventoryApi';
import { createPaymentOrder, ONLINE_PAYMENTS_ENABLED, recordCashPayment, verifyRazorpayPayment, type PaymentRecord } from '../services/paymentsApi';
import { openRazorpayCheckout } from '../services/razorpayCheckout';
import { ApiError } from '../services/authApi';
import { amountToIndianWords } from '../utils/currency';

interface RecordBookingPaymentModalProps {
  unit: InventoryUnit;
  onClose: () => void;
  /** Fired once the backend confirms the plot moved reserved -> booked. */
  onBooked: (unit: InventoryUnit) => void;
}

function parseAmount(value: string): number {
  const cleaned = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(cleaned) ? cleaned : 0;
}


function PriceInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(sanitizeAmountInput(event.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function RecordBookingPaymentModal({ unit, onClose, onBooked }: RecordBookingPaymentModalProps) {
  const { session } = useAuth();
  const area = unit.area_sqyd ?? 0;
  const [salePrice, setSalePrice] = useState(
    unit.estimated_price != null ? String(Math.round(unit.estimated_price)) : '',
  );
  const [ratePerSqYd, setRatePerSqYd] = useState(
    unit.estimated_price != null && area > 0 ? String(roundHalfUp(unit.estimated_price / area, 2)) : '',
  );
  const [plc, setPlc] = useState('');
  const [ifms, setIfms] = useState('');
  const [cam, setCam] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [busy, setBusy] = useState<'cash' | 'online' | null>(null);
  const [error, setError] = useState('');

  // Booking amount = the chosen plan's first instalment, from the server preview.
  const plan = usePaymentPlanPreview({
    projectId: matchApplicationProjectId(unit.project_name),
    planCode,
    prices: {
      salePrice: parseAmount(salePrice),
      plcAmount: parseAmount(plc),
      ifmsAmount: parseAmount(ifms),
      camAmount: parseAmount(cam),
    },
    enabled: busy === null,
  });
  const bookingAmount = plan.ready && plan.preview ? plan.preview.booking_amount : 0;
  const canPay = plan.ready && !!plan.selection && bookingAmount > 0 && busy === null;

  const updateRate = (value: string) => {
    setRatePerSqYd(value);
    if (area > 0) {
      const price = roundHalfUp(parseAmount(value) * area);
      setSalePrice(price > 0 ? String(price) : '');
    }
  };
  const updateSalePrice = (value: string) => {
    setSalePrice(value);
    if (area > 0) {
      const rate = roundHalfUp(parseAmount(value) / area, 2);
      setRatePerSqYd(rate > 0 ? String(rate) : '');
    }
  };

  const describeError = (err: unknown) => {
    if (err instanceof ApiError && err.detail === 'payment_plan_not_found') plan.reloadPlans();
    return err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  };

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
    if (!session || !canPay || !plan.selection) return;
    const selection = plan.selection;
    setBusy('cash');
    setError('');
    try {
      const record = await recordCashPayment(
        session.token,
        bookingAmount,
        `Booking amount for ${unit.project_name}${unit.unit_number ? ` Plot ${unit.unit_number}` : ''} (channel partner).`,
        { purpose: 'plot_booking', inventoryId: unit.id, plan: selection },
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
    if (!ONLINE_PAYMENTS_ENABLED) {
      setError('Online payments are temporarily unavailable while Razorpay is being configured. Please record cash.');
      return;
    }
    if (!session || !canPay || !plan.selection) return;
    const selection = plan.selection;
    setBusy('online');
    setError('');
    try {
      const order = await createPaymentOrder(session.token, bookingAmount, {
        purpose: 'plot_booking',
        inventoryId: unit.id,
        plan: selection,
      });
      if (!order.razorpay_key_id || !order.razorpay_order_id || !Number.isSafeInteger(order.amount_paise) || order.amount_paise <= 0) {
        throw new Error('Razorpay is not configured on the payment server yet.');
      }
      const result = await openRazorpayCheckout({
        keyId: order.razorpay_key_id,
        amountPaise: order.amount_paise,
        currency: order.currency,
        orderId: order.razorpay_order_id,
        name: 'Divine Vision Infratech',
        description: 'Plot booking payment',
        prefillEmail: session.email,
      });
      const record = await verifyRazorpayPayment(session.token, result);
      finish(record, true);
    } catch (err) {
      setError(describeError(err));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-hairline bg-surface p-6 shadow-[0_26px_60px_-24px_rgba(6,31,45,0.4)]">
        <p className="eyebrow-label text-terracotta">Record booking payment</p>
        <h3 className="mt-2 font-display text-lg font-bold text-ink">
          {unit.project_name}
          {unit.unit_number ? ` · Plot ${unit.unit_number}` : ''}
        </h3>
        <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
          Enter the agreed prices and choose the customer&rsquo;s payment plan. The booking amount is the plan&rsquo;s first
          instalment. Once the payment settles, the plot is held for this customer while their KYC is reviewed, and
          leaves the available list.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {area > 0 && (
            <PriceInput
              label={`BSP rate per sq yd (${area} sq yd)`}
              value={ratePerSqYd}
              onChange={updateRate}
              disabled={busy !== null}
              placeholder="Rate"
            />
          )}
          <PriceInput label="Basic Sale Price (Rs.)" value={salePrice} onChange={updateSalePrice} disabled={busy !== null} placeholder="e.g. 5000000" />
          <PriceInput label="PLC (Rs.)" value={plc} onChange={setPlc} disabled={busy !== null} placeholder="0" />
          <PriceInput label="IFMS (Rs.)" value={ifms} onChange={setIfms} disabled={busy !== null} placeholder="0" />
          <PriceInput label="CAM (Rs.)" value={cam} onChange={setCam} disabled={busy !== null} placeholder="0" />
        </div>

        <div className="mt-4">
          <PaymentPlanPicker state={plan} value={planCode} onChange={(code) => busy === null && setPlanCode(code)} compact />
        </div>
        {bookingAmount > 0 && <p className="mt-2 text-[11px] text-ink-muted">{amountToIndianWords(bookingAmount)}</p>}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleOnline}
            disabled={!ONLINE_PAYMENTS_ENABLED || !canPay || bookingAmount > 1_00_00_000}
            className="w-full rounded-full bg-green px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ONLINE_PAYMENTS_ENABLED ? (busy === 'online' ? 'Processing…' : 'Pay with Razorpay') : 'Razorpay temporarily unavailable'}
          </button>
          <button
            type="button"
            onClick={handleCash}
            disabled={!canPay}
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
