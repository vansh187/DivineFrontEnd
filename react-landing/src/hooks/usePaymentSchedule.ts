import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { loadCustomerDocs } from '../services/documentStore';
import {
  getCustomerProfile,
  type CustomerScheduleRow,
} from '../services/customerProfileApi';
import {
  deriveSchedule,
  paymentReminder,
  type PaymentReminder,
  type ScheduleMilestone,
} from '../services/paymentSchedule';

export interface PaymentScheduleState {
  /** Full plan, normalised — always present (falls back to the default split). */
  milestones: ScheduleMilestone[];
  /** The next unpaid milestone once it is within 20 days of its due date / overdue. */
  reminder: PaymentReminder | null;
  totalAmount: number | null;
  hasBooking: boolean;
  loading: boolean;
  /** `server` when `GET /customer/profile` supplied the rows, else `local`. */
  source: 'server' | 'local';
  /** Re-read the stored plan and re-fetch the profile. */
  refresh: () => void;
}

interface RemoteMeta {
  rows: CustomerScheduleRow[] | null;
  total: number | null;
  received: number | null;
  bookingDate: string | null;
  hasBooking: boolean | null;
}

/**
 * Single source of truth for the customer payment schedule, shared by the home
 * "payment due" banner and the profile page's schedule table. Prefers the live
 * `GET /customer/profile` schedule, falls back to the plan cached from the
 * application upload, then to the hard-coded split — the UI always has something
 * to render.
 */
export function usePaymentSchedule(): PaymentScheduleState {
  const { session } = useAuth();
  const [tick, setTick] = useState(0);
  const [remote, setRemote] = useState<RemoteMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCustomerProfile(session.token)
      .then((data) => {
        if (cancelled) return;
        const booking = data.booking ?? {};
        setRemote({
          rows: Array.isArray(booking.payment_schedule) ? booking.payment_schedule : null,
          total: typeof booking.total_consideration === 'number' ? booking.total_consideration : null,
          received: typeof booking.amount_received === 'number' ? booking.amount_received : null,
          bookingDate: booking.booking_date ?? null,
          hasBooking: typeof booking.has_booking === 'boolean' ? booking.has_booking : null,
        });
      })
      .catch(() => {
        // Endpoint missing / network / server error — fall back to the cached plan.
        if (!cancelled) setRemote(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, tick]);

  return useMemo<PaymentScheduleState>(() => {
    if (!session) {
      return { milestones: [], reminder: null, totalAmount: null, hasBooking: false, loading, source: 'local', refresh };
    }

    const docs = loadCustomerDocs(session.email);
    const storedPlan = docs.bookingApplication.paymentPlan;
    const form = docs.bookingApplication.formData;
    const localTotal =
      Number(String(form.totalPlotAmount || form.totalAmount).replace(/[^0-9.]/g, '')) || null;
    const localReceived =
      docs.payment.status === 'paid' && docs.payment.amount ? docs.payment.amount : null;

    const usingServer = Boolean(remote?.rows?.length);
    const totalAmount = remote?.total ?? storedPlan?.total_receivable ?? localTotal;

    const milestones = deriveSchedule({
      rows: remote?.rows ?? null,
      storedPlan,
      totalAmount,
      bookingDate: remote?.bookingDate ?? storedPlan?.booking_date ?? form.applicationDate ?? null,
      receivedAmount: remote?.received ?? storedPlan?.total_received ?? localReceived,
    });

    const hasBooking =
      remote?.hasBooking ??
      Boolean(
        storedPlan?.rows?.length ||
          form.unitNo.trim() ||
          form.projectId ||
          milestones.some((m) => m.amount),
      );

    return {
      milestones,
      reminder: hasBooking ? paymentReminder(milestones) : null,
      totalAmount,
      hasBooking,
      loading,
      source: usingServer ? 'server' : 'local',
      refresh,
    };
    // loadCustomerDocs is a synchronous localStorage read; `tick` re-runs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, remote, loading, tick, refresh]);
}
