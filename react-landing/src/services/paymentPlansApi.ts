import { API_BASE_URL, ApiError } from './authApi';

/**
 * Payment plans a customer picks from when booking a plot (PP1, PP2, ...).
 *
 * The plans and every amount in a schedule come from the backend: the list from
 * `GET /payment-plans`, the exact instalments for a given price from
 * `POST /payment-plans/preview`. Nothing here hard-codes a plan or does the
 * instalment maths, so a new plan (or a new version of one) needs no frontend
 * change.
 *
 * For reference, the backend computes:
 *   total       = sale price + PLC + IFMS + CAM
 *   each row    = round(sale price × row %) + that row's charge (PLC / IFMS / CAM / all)
 *                 (the last row absorbs the rounding difference)
 *   due date    = booking date + row's days; "On Offer of Possession" has no date
 *                 until the company announces possession
 *   booking amt = the plan's first instalment (10% for PP1/PP2, 50% for PP3,
 *                 100% + all charges for PP4)
 */

export type PlanChargeHead = 'PLC' | 'IFMS' | 'CAM' | 'ALL' | 'PLC+IFMS+CAM';
export type PlanDueTrigger = 'booking' | 'possession';

export interface PaymentPlanInstalment {
  seq: number;
  label: string;
  percent: number;
  due_trigger: PlanDueTrigger;
  due_days: number | null;
  due_text: string;
  charge_head: PlanChargeHead | null;
}

export interface PlanScheduleRow {
  seq: number;
  label: string;
  percent: number;
  due_trigger?: PlanDueTrigger;
  due_days?: number | null;
  due_text: string;
  /** `null` for the "On Offer of Possession" row until possession is announced. */
  due_date?: string | null;
  basic_amount: number;
  charge_head: string | null;
  charge_amount: number;
  /** Payable amount for this row, charges included. */
  amount: number;
  status?: 'paid' | 'due';
}

export interface PaymentPlanExample {
  sale_price: number;
  plc: number;
  ifms: number;
  cam: number;
  total: number;
  booking_amount: number;
  rows: PlanScheduleRow[];
}

/** One entry of `GET /payment-plans`. */
export interface PaymentPlanOption {
  /** Full code, e.g. `PP1/FPP/10-15-25-25-15-10` — send exactly this. */
  code: string;
  short_code: string;
  name: string;
  description: string | null;
  project_id: string | null;
  version: number;
  booking_percent: number;
  instalments: PaymentPlanInstalment[];
  example: PaymentPlanExample | null;
}

/** Response of `POST /payment-plans/preview`. */
export interface PaymentPlanPreview {
  plan: { code: string; short_code: string; name: string; version: number };
  sale_price: number;
  plc: number;
  ifms: number;
  cam: number;
  total: number;
  booking_amount: number;
  booking_date: string | null;
  rows: PlanScheduleRow[];
}

/** Plan summary stored against a booking (profile / upload responses). */
export interface BookingPaymentPlanSummary {
  code: string;
  short_code: string;
  name: string;
  version: number;
  sale_price: number;
  plc: number;
  ifms: number;
  cam: number;
  total: number;
  booking_amount: number;
}

/** Prices the customer enters on the Pricing step, in rupees. */
export interface PlanPrices {
  salePrice: number;
  plcAmount: number;
  ifmsAmount: number;
  camAmount: number;
}

/** What a plot-booking payment has to carry so the backend can record the plan. */
export interface BookingPlanSelection extends PlanPrices {
  planCode: string;
}

/** Customer-facing message for a plan-related `detail` code, or `null` when the
 * code isn't one of the plan errors. Shared with paymentsApi / documentsApi. */
export function messageForPlanDetail(detail: unknown): string | null {
  switch (detail) {
    case 'booking_amount_mismatch':
      return 'The booking amount no longer matches the selected payment plan. Please review the Pricing page and try again.';
    case 'payment_plan_not_found':
      return 'That payment plan is no longer offered. Please choose a plan again on the Pricing page.';
    case 'payment_plan_not_for_project':
      return 'That payment plan is not offered for this plot. Please choose another plan.';
    case 'inventory_id_required':
    case 'unit_not_found':
      return 'We could not identify the plot for this booking. Please start the booking from Available Plots.';
    case 'plot_lookup_failed':
      return 'We could not check this plot right now. Please try again in a moment.';
    case 'sale_price_out_of_range':
    case 'sale_price_too_small':
      return 'Please check the Basic Sale Price for this plot.';
    case 'total_amount_too_large':
      return 'The total plot amount looks too large. Please check the prices you entered.';
    case 'invalid_sale_price':
      return 'Enter a valid Basic Sale Price.';
    case 'invalid_plc_amount':
      return 'Enter a valid PLC amount (0 if none).';
    case 'invalid_ifms_amount':
      return 'Enter a valid IFMS amount (0 if none).';
    case 'invalid_cam_amount':
      return 'Enter a valid CAM amount (0 if none).';
    case 'payment_plan_only_for_booking':
      return 'A payment plan can only be chosen with the booking payment.';
    case 'plan_mismatch':
      return 'The plan or total on the application does not match the booking payment. Please review the Pricing page.';
    default:
      return null;
  }
}

function messageForPlansError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
  const planMessage = messageForPlanDetail(detail);
  if (planMessage) return planMessage;
  if (status === 404) return 'That payment plan could not be found.';
  if (status === 422) return 'Please check the prices you entered.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  return 'Could not load the payment plans. Please try again.';
}

async function publicRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, null, messageForPlansError(0, null));
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForPlansError(res.status, detail));
  }
  return data as T;
}

/** Plan lists change rarely (the backend itself caches them ~60 s). Cache per
 * project for a minute so moving between wizard pages doesn't refetch. */
const PLANS_TTL_MS = 60_000;
const plansCache = new Map<string, { at: number; promise: Promise<PaymentPlanOption[]> }>();

export function listPaymentPlans(projectId: string, { fresh = false } = {}): Promise<PaymentPlanOption[]> {
  const key = projectId.trim();
  const cached = plansCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < PLANS_TTL_MS) return cached.promise;

  const promise = publicRequest<{ count: number; plans: PaymentPlanOption[] }>(
    `/payment-plans?project_id=${encodeURIComponent(key)}`,
  ).then((data) => (Array.isArray(data?.plans) ? data.plans : []));
  plansCache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (plansCache.get(key)?.promise === promise) plansCache.delete(key);
  });
  return promise;
}

export interface PreviewPaymentPlanInput extends BookingPlanSelection {
  projectId?: string | null;
  /** `YYYY-MM-DD`; the server defaults to today (IST). */
  bookingDate?: string | null;
}

export function previewPaymentPlan(input: PreviewPaymentPlanInput, signal?: AbortSignal): Promise<PaymentPlanPreview> {
  return publicRequest<PaymentPlanPreview>('/payment-plans/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      plan_code: input.planCode,
      sale_price: input.salePrice,
      plc_amount: input.plcAmount,
      ifms_amount: input.ifmsAmount,
      cam_amount: input.camAmount,
      ...(input.projectId ? { project_id: input.projectId } : {}),
      ...(input.bookingDate ? { booking_date: input.bookingDate } : {}),
    }),
  });
}

/** The server rounds each price half-up to the rupee before computing. */
export function roundRupee(value: number): number {
  return Number.isFinite(value) ? Math.round(Number(value.toFixed(6))) : 0;
}

/** True when `preview` was computed for exactly this plan and these prices, so
 * its `booking_amount` / `total` can be charged and submitted. */
export function previewMatches(preview: PaymentPlanPreview | null | undefined, selection: BookingPlanSelection | null): boolean {
  if (!preview || !selection) return false;
  return (
    preview.plan.code === selection.planCode &&
    preview.sale_price === roundRupee(selection.salePrice) &&
    preview.plc === roundRupee(selection.plcAmount) &&
    preview.ifms === roundRupee(selection.ifmsAmount) &&
    preview.cam === roundRupee(selection.camAmount)
  );
}

/** "PP1 — Flexible Payment Plan 10-15-25-25-15-10" */
export function planDisplayName(plan: { short_code?: string | null; name?: string | null; code?: string | null }): string {
  const short = plan.short_code?.trim();
  const name = plan.name?.trim();
  if (short && name) return `${short} — ${name}`;
  return name || short || plan.code || 'Payment plan';
}

/** Human label for a row's charge head: "PLC", "IFMS", "CAM", or "PLC + IFMS + CAM". */
export function chargeHeadLabel(head: string | null | undefined): string | null {
  if (!head) return null;
  if (head === 'ALL' || head === 'PLC+IFMS+CAM') return 'PLC + IFMS + CAM';
  return head;
}
