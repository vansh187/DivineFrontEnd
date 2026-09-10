import type { CustomerScheduleRow, PaymentPlan } from './customerProfileApi';

/**
 * Pure helpers that turn whatever payment-schedule data we have — server rows
 * from `GET /customer/profile`, the plan the backend derived on the application
 * upload, or the hard-coded 10 / 15 / 25 / 25 / 25 split — into a uniform list
 * of milestones with resolved due dates, amounts, status, and the "can the
 * customer pay this now?" gate.
 *
 * No React, no network — safe to import anywhere (kept free of `customerProfilePdf`
 * so it never pulls `pdf-lib` into a page bundle).
 */

/** A payment reminder starts showing on the customer home and mailing this many
 *  days before an instalment's due date. */
export const REMINDER_LEAD_DAYS = 20;

/** "Pay now" for the next unpaid instalment unlocks this many days before its
 *  due date. */
export const PAY_WINDOW_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fallback split, mirrors PAYMENT_SCHEDULE in customerProfilePdf.ts (duplicated
 *  on purpose to keep this module dependency-free). */
const DEFAULT_SPLIT: Array<{ label: string; share: number; days: number }> = [
  { label: 'On Booking', share: 0.1, days: 0 },
  { label: 'Within 45 days of booking', share: 0.15, days: 45 },
  { label: 'Within 90 days of booking', share: 0.25, days: 90 },
  { label: 'Within 180 days of booking', share: 0.25, days: 180 },
  { label: 'Within 270 days of booking', share: 0.25, days: 270 },
];

export type MilestoneStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';

export interface ScheduleMilestone {
  /** 1-based position in the plan — used to attribute an instalment payment. */
  no: number;
  label: string;
  percent: number | null;
  amount: number | null;
  dueDate: Date | null;
  /** `YYYY-MM-DD`, for sending to the backend. */
  dueDateISO: string | null;
  status: MilestoneStatus;
  /** Whole days from today to the due date; negative = overdue, null = no date. */
  daysUntilDue: number | null;
  /** The earliest unpaid milestone — the one the reminder + Pay button target. */
  isNext: boolean;
  /** True when this milestone's "Pay now" button should be live. */
  payable: boolean;
}

function startOfDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseISO(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

export interface DeriveScheduleInput {
  /** Server rows (`GET /customer/profile` → `booking.payment_schedule`). */
  rows?: CustomerScheduleRow[] | null;
  /** Plan the backend returned on the application upload (localStorage fallback). */
  storedPlan?: PaymentPlan | null;
  totalAmount?: number | null;
  bookingDate?: string | null;
  /** Amount received so far — used to infer which early rows are paid when the
   *  backend hasn't stamped per-row status yet. */
  receivedAmount?: number | null;
}

export function deriveSchedule(input: DeriveScheduleInput): ScheduleMilestone[] {
  const bookingDate = parseISO(input.bookingDate ?? input.storedPlan?.booking_date ?? null);
  const total = input.totalAmount ?? input.storedPlan?.total_receivable ?? null;
  const received = input.receivedAmount ?? input.storedPlan?.total_received ?? 0;

  const usingServerRows = Boolean(input.rows?.length);
  const sourceRows = input.rows?.length
    ? input.rows
    : input.storedPlan?.rows?.length
      ? input.storedPlan.rows
      : null;

  const labelKey = (label: unknown): string => String(label ?? '').trim().toLowerCase();

  // Milestones the customer has already paid according to the locally-cached
  // plan (markInstallmentPaidLocally). Matched by label so a lagging server
  // response — profile rows still "due" right after a successful payment —
  // can't re-enable a "Pay now" button and invite a double payment.
  const locallyPaidLabels = usingServerRows
    ? new Set(
        (input.storedPlan?.rows ?? [])
          .filter((row) => (row.status ?? '').toLowerCase() === 'paid')
          .map((row) => labelKey(row.label)),
      )
    : new Set<string>();

  const base = sourceRows
    ? sourceRows.map((row) => {
        const rawStatus = (row.status ?? '').toLowerCase();
        return {
          label: row.label,
          percent: Number.isFinite(row.percent) ? row.percent : null,
          amount:
            typeof row.amount === 'number'
              ? row.amount
              : total != null && Number.isFinite(row.percent)
                ? Math.round(total * (row.percent / 100))
                : null,
          dueDate:
            parseISO(row.due_date) ??
            (bookingDate && row.due_days != null ? addDays(bookingDate, row.due_days) : null),
          rawStatus:
            rawStatus === 'paid' || (locallyPaidLabels.size > 0 && locallyPaidLabels.has(labelKey(row.label)))
              ? 'paid'
              : rawStatus,
        };
      })
    : DEFAULT_SPLIT.map((row) => ({
        label: row.label,
        percent: Math.round(row.share * 100),
        amount: total != null ? Math.round(total * row.share) : null,
        dueDate: bookingDate ? addDays(bookingDate, row.days) : null,
        rawStatus: '',
      }));

  // Decide which rows are paid: trust an explicit "paid" status, otherwise walk
  // the running total received across the rows in order.
  let runningReceived = received;
  const paidFlags = base.map((row) => {
    if (row.rawStatus === 'paid') {
      if (row.amount != null) runningReceived = Math.max(0, runningReceived - row.amount);
      return true;
    }
    if (row.amount != null && row.amount > 0 && runningReceived + 1 >= row.amount) {
      runningReceived -= row.amount;
      return true;
    }
    return false;
  });

  const firstUnpaid = paidFlags.findIndex((paid) => !paid);
  const todayMs = startOfDayMs(new Date());

  return base.map((row, i) => {
    const paid = paidFlags[i];
    const daysUntilDue = row.dueDate ? Math.round((startOfDayMs(row.dueDate) - todayMs) / DAY_MS) : null;

    let status: MilestoneStatus;
    if (paid) status = 'paid';
    else if (daysUntilDue == null) status = 'upcoming';
    else if (daysUntilDue < 0) status = 'overdue';
    else if (daysUntilDue <= REMINDER_LEAD_DAYS) status = 'due-soon';
    else status = 'upcoming';

    const isNext = i === firstUnpaid;
    const payable =
      isNext &&
      !paid &&
      daysUntilDue != null &&
      daysUntilDue <= PAY_WINDOW_DAYS &&
      row.amount != null &&
      row.amount > 0;

    return {
      no: i + 1,
      label: row.label,
      percent: row.percent,
      amount: row.amount,
      dueDate: row.dueDate,
      dueDateISO: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      status,
      daysUntilDue,
      isNext,
      payable,
    };
  });
}

export interface PaymentReminder {
  milestone: ScheduleMilestone;
  daysUntilDue: number;
  overdue: boolean;
}

/** The reminder to surface on the customer home (and mirror by email server-side):
 *  the next unpaid milestone once it is within `REMINDER_LEAD_DAYS` of its due
 *  date, or already overdue. `null` when nothing is due soon. */
export function paymentReminder(milestones: ScheduleMilestone[]): PaymentReminder | null {
  const next = milestones.find((m) => m.isNext);
  if (!next || next.status === 'paid' || next.daysUntilDue == null) return null;
  if (next.daysUntilDue > REMINDER_LEAD_DAYS) return null;
  return { milestone: next, daysUntilDue: next.daysUntilDue, overdue: next.daysUntilDue < 0 };
}
