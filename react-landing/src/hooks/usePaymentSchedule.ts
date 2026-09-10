import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { loadCustomerDocs } from '../services/documentStore';
import { loadPendingUnit } from '../services/pendingUnit';
import {
  clearCustomerProfileCache,
  getCustomerProfileShared,
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

/** Largest of the given values, ignoring null/undefined/NaN. `null` when none qualify. */
function maxDefined(...values: Array<number | null | undefined>): number | null {
  const nums = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return nums.length ? Math.max(...nums) : null;
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

  const refresh = useCallback(() => {
    clearCustomerProfileCache();
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCustomerProfileShared(session.token, tick > 0)
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
    // Take the largest "received" across sources: the optimistic local mark
    // (markInstallmentPaidLocally) bumps the cached plan the instant an
    // instalment is paid, before `GET /customer/profile` catches up, so a plain
    // server-first fallback would hide a payment the customer just made.
    const receivedAmount = maxDefined(remote?.received, storedPlan?.total_received, localReceived);

    // Strong local evidence a booking exists even when `GET /customer/profile`
    // hasn't linked it to this customer yet (just booked / cash just recorded):
    // a backend-derived plan, or a verified payment on file.
    const strongLocalBooking = Boolean(
      storedPlan?.rows?.length || (docs.payment.status === 'paid' && docs.payment.paymentId),
    );
    // Weak evidence — a plot picked or a half-filled wizard. Only trusted while
    // the server hasn't answered; a pending unit is never cleared on abandon, so
    // on its own it must not manufacture a permanent "payment due" banner.
    const weakLocalBooking = Boolean(
      loadPendingUnit(session.email) || form.unitNo.trim() || form.projectId || totalAmount != null,
    );

    // The server is authoritative when it explicitly answers has_booking.
    // `null` = endpoint missing / errored / field absent → fall back to local.
    const confirmedBooking = remote?.hasBooking === true || strongLocalBooking;
    const hasBooking =
      remote?.hasBooking === false ? strongLocalBooking : confirmedBooking || weakLocalBooking;

    // Milestone due dates need an anchor. When neither the server nor the cached
    // plan gives a booking date, assume the booking is dated today — the same
    // fallback the letter PDFs use — so the table shows real due dates and
    // "Pay now" windows instead of a column of dashes. Only anchor on a
    // *confirmed* booking: a half-filled draft must never backdate milestone 1
    // to "due today" and light up the home banner.
    const knownBookingDate = remote?.bookingDate ?? storedPlan?.booking_date ?? null;
    const bookingDate =
      knownBookingDate ??
      (confirmedBooking ? form.applicationDate || new Date().toISOString().slice(0, 10) : null);

    const milestones = deriveSchedule({
      rows: remote?.rows ?? null,
      storedPlan,
      totalAmount,
      bookingDate,
      receivedAmount,
    });

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
