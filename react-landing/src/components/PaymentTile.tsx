import { useState } from 'react';
import { createPaymentOrder, verifyPayment } from '../services/paymentsApi';
import { openRazorpayCheckout } from '../services/razorpayCheckout';
import { ApiError } from '../services/authApi';
import type { PaymentStatus } from '../services/documentStore';
import { TileShell } from './DocumentTile';
import { RupeeIcon } from './DashboardIcons';

interface PaymentTileProps {
  token: string;
  email: string;
  name: string;
  status: PaymentStatus;
  onChange: (next: PaymentStatus) => void;
  onSessionExpired: () => void;
}

export function PaymentTile({ token, email, name, status, onChange, onSessionExpired }: PaymentTileProps) {
  const [amountInput, setAmountInput] = useState(status.amount ? String(status.amount) : '');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = status.status === 'paid' ? 'Paid' : status.status === 'failed' ? 'Payment failed' : 'Not paid';
  const statusTone = status.status === 'paid' ? 'done' : status.status === 'failed' ? 'failed' : 'neutral';

  const describeError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 401) onSessionExpired();
      return err.message;
    }
    return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  };

  const handlePayNow = async () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const order = await createPaymentOrder(token, amount);
      const result = await openRazorpayCheckout({
        keyId: order.razorpay_key_id,
        amountPaise: order.amount_paise,
        currency: order.currency,
        orderId: order.razorpay_order_id,
        name: 'Divine Vision Infratech',
        description: 'Plot booking payment',
        prefillEmail: email,
        prefillName: name,
      });
      const record = await verifyPayment(token, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      onChange({
        amount: record.amount,
        status: record.verified ? 'paid' : 'failed',
        razorpayOrderId: record.razorpay_order_id,
        razorpayPaymentId: record.razorpay_payment_id,
        paidAt: record.verified ? new Date().toISOString() : null,
        error: record.verified ? null : 'Payment could not be verified. Please try again or contact support.',
      });
      if (!record.verified) setError('Payment could not be verified. Please try again or contact support.');
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPaying(false);
    }
  };

  return (
    <TileShell
      icon={<RupeeIcon />}
      title="Pay now"
      description="Pay your booking amount securely online."
      statusLabel={statusLabel}
      statusTone={statusTone}
    >
      {status.status === 'paid' ? (
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <p>
            <span className="font-semibold text-ink">₹{status.amount?.toLocaleString('en-IN')}</span> paid
          </p>
          {status.paidAt && <p>Paid on {new Date(status.paidAt).toLocaleDateString('en-IN')}.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="number"
            min="1"
            step="0.01"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="Amount (₹)"
            className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
          />
          <button
            type="button"
            onClick={handlePayNow}
            disabled={paying}
            className="self-start rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {paying ? 'Processing…' : 'Pay Now'}
          </button>
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </TileShell>
  );
}
