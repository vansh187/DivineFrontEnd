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

export type MilestoneStatus = 'paid' | 'pending-review' | 'overdue' | 'due-soon' | 'upcoming';

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
  /** True when this milestone's "Pay now" button should be live: the next unpaid
   *  instalment, any time (no window before the due date). */
  payable: boolean;
  /** Due from an event with no date yet - "On Offer of Possession" before the
   *  possession date is set, or an admin-named custom event ("30 days after
   *  Completion of plinth"): not payable, never overdue. */
  awaitingPossession: boolean;
  /** 'booking' | 'possession' | 'custom' (null for the default split). */
  dueTrigger: string | null;
  /** 'custom' rows: the event the days count from, e.g. "Completion of plinth". */
  dueFrom: string | null;
  /** Server text for when it falls due, e.g. "On Offer of Possession". */
  dueText: string | null;
  /** Charge included in `amount` (e.g. "PLC"), and its amount. */
  chargeHead: string | null;
  chargeAmount: number | null;
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
        // A row due from an event (possession, or a custom event such as
        // "Completion of plinth") is dated only by the server once that event
        // has a date - never project it from the booking date.
        // Only these two triggers wait on an event - the same rule as the
        // backend, so both agree on which instalment is next. Anything else
        // (including an unknown trigger) is treated as counted from booking.
        const trigger = (row.due_trigger ?? '').trim().toLowerCase();
        const eventLinked = trigger === 'possession' || trigger === 'custom';
        const dueDate =
          parseISO(row.due_date) ??
          (!eventLinked && bookingDate && row.due_days != null ? addDays(bookingDate, row.due_days) : null);
        return {
          label: row.label,
          percent: Number.isFinite(row.percent) ? row.percent : null,
          amount:
            typeof row.amount === 'number'
              ? row.amount
              : total != null && Number.isFinite(row.percent)
                ? Math.round(total * (row.percent / 100))
                : null,
          dueDate,
          awaitingPossession: eventLinked && !dueDate,
          dueTrigger: trigger || null,
          dueFrom: row.due_from?.trim() || null,
          dueText: row.due_text ?? null,
          chargeHead: row.charge_head ?? null,
          chargeAmount: typeof row.charge_amount === 'number' ? row.charge_amount : null,
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
        awaitingPossession: false,
        dueTrigger: null as string | null,
        dueFrom: null as string | null,
        dueText: null as string | null,
        chargeHead: null as string | null,
        chargeAmount: null as number | null,
        rawStatus: '',
      }));

  // Decide which rows are paid: trust an explicit "paid" status, otherwise walk
  // what's left of the total received across the remaining rows. Rows waiting on
  // an undated event come last in that walk: the customer can pay a dated
  // instalment after one of them, and that money must land on the dated row
  // they actually paid, not on the earlier undated row.
  const paidFlags = base.map((row) => row.rawStatus === 'paid');
  let runningReceived = base.reduce(
    (left, row, i) => (paidFlags[i] && row.amount != null ? Math.max(0, left - row.amount) : left),
    received,
  );
  const walkOrder = [
    ...base.map((_, i) => i).filter((i) => !base[i].awaitingPossession),
    ...base.map((_, i) => i).filter((i) => base[i].awaitingPossession),
  ];
  for (const i of walkOrder) {
    const { amount } = base[i];
    if (paidFlags[i] || amount == null || amount <= 0 || runningReceived + 1 < amount) continue;
    runningReceived -= amount;
    paidFlags[i] = true;
  }

  // The next instalment to pay: the first unpaid one that isn't waiting on an
  // undated event (the server lets a dated instalment after such a row be paid).
  const firstUnpaidAny = paidFlags.findIndex((paid) => !paid);
  const firstUnpaidDated = paidFlags.findIndex((paid, i) => !paid && !base[i].awaitingPossession);
  const firstUnpaid = firstUnpaidDated >= 0 ? firstUnpaidDated : firstUnpaidAny;
  const todayMs = startOfDayMs(new Date());

  return base.map((row, i) => {
    const paid = paidFlags[i];
    const daysUntilDue = row.dueDate ? Math.round((startOfDayMs(row.dueDate) - todayMs) / DAY_MS) : null;

    let status: MilestoneStatus;
    if (paid) status = 'paid';
    else if (base[i].rawStatus === 'pending_review' || base[i].rawStatus === 'pending-review') status = 'pending-review';
    else if (daysUntilDue == null) status = 'upcoming';
    else if (daysUntilDue < 0) status = 'overdue';
    else if (daysUntilDue <= REMINDER_LEAD_DAYS) status = 'due-soon';
    else status = 'upcoming';

    const isNext = i === firstUnpaid;
    const payable =
      isNext &&
      !paid &&
      !row.awaitingPossession &&
      status !== 'pending-review' &&
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
      awaitingPossession: row.awaitingPossession,
      dueTrigger: row.dueTrigger,
      dueFrom: row.dueFrom,
      dueText: row.dueText,
      chargeHead: row.chargeHead,
      chargeAmount: row.chargeAmount,
    };
  });
}

/** What the Due date column shows for a row that has no date yet. */
export function undatedDueLabel(milestone: Pick<ScheduleMilestone, 'dueTrigger' | 'dueFrom' | 'dueText'>): string {
  if (milestone.dueText?.trim()) return milestone.dueText.trim();
  if (milestone.dueTrigger === 'possession') return 'On Offer of Possession';
  if (milestone.dueFrom) return `On ${milestone.dueFrom}`;
  return 'To be announced';
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
  if (!next || next.status === 'paid' || next.status === 'pending-review' || next.daysUntilDue == null) return null;
  if (next.daysUntilDue > REMINDER_LEAD_DAYS) return null;
  return { milestone: next, daysUntilDue: next.daysUntilDue, overdue: next.daysUntilDue < 0 };
}
