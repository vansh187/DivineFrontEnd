import type { PaymentPlanPreviewState } from '../hooks/usePaymentPlanPreview';
import { chargeHeadLabel, planDisplayName, type PaymentPlanPreview, type PlanScheduleRow } from '../services/paymentPlansApi';
import { formatCurrencyINR, formatIndianDate } from '../utils/currency';

/** "₹12,50,000 + PLC ₹1,00,000" — the row's sale-price share plus its charge. */
function amountBreakdown(row: PlanScheduleRow): string | null {
  const head = chargeHeadLabel(row.charge_head);
  if (!head || !row.charge_amount) return null;
  return `${formatCurrencyINR(row.basic_amount)} + ${head} ${formatCurrencyINR(row.charge_amount)}`;
}

function dueLabel(row: PlanScheduleRow): string {
  return row.due_date ? formatIndianDate(row.due_date) : row.due_text;
}

/** Payable schedule (rows + total) — shared by the live preview and the paid snapshot. */
export function PlanScheduleTable({
  rows,
  total,
  showDates = true,
}: {
  rows: PlanScheduleRow[];
  total?: number | null;
  showDates?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full min-w-[480px] text-xs">
        <thead>
          <tr className="bg-bg text-left uppercase tracking-[0.04em] text-ink-muted">
            <th className="px-3 py-2 font-semibold">Instalment</th>
            <th className="px-3 py-2 font-semibold">%</th>
            <th className="px-3 py-2 font-semibold">{showDates ? 'Due date' : 'When'}</th>
            <th className="px-3 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const breakdown = amountBreakdown(row);
            return (
              <tr key={row.seq} className="border-t border-hairline align-top">
                <td className="px-3 py-2 text-ink">{row.label}</td>
                <td className="px-3 py-2 text-ink">
                  {row.percent}%{chargeHeadLabel(row.charge_head) ? ` + ${chargeHeadLabel(row.charge_head)}` : ''}
                </td>
                <td className="px-3 py-2 text-ink-muted">{showDates ? dueLabel(row) : row.due_text}</td>
                <td className="px-3 py-2 text-right">
                  <span className="block font-semibold text-ink">{formatCurrencyINR(row.amount)}</span>
                  {breakdown && <span className="block text-[11px] text-ink-muted">{breakdown}</span>}
                </td>
              </tr>
            );
          })}
          {total != null && (
            <tr className="border-t border-hairline bg-bg">
              <td className="px-3 py-2 font-semibold text-ink" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2 text-right font-display text-sm font-bold text-ink">{formatCurrencyINR(total)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Payment-plan dropdown + the selected plan's terms + the exact instalments for
 * the prices entered. Everything rendered comes from the API (`GET /payment-plans`
 * and `POST /payment-plans/preview`); nothing is computed here.
 */
export function PaymentPlanPicker({
  state,
  value,
  onChange,
  locked = false,
  compact = false,
  snapshot = null,
  missingPricesHint = 'Enter the Basic Sale Price to see the instalments and booking amount.',
}: {
  state: PaymentPlanPreviewState;
  value: string;
  onChange: (code: string) => void;
  /** Booking payment made — the plan can no longer be changed here. */
  locked?: boolean;
  /** Tighter layout for modals: hides the plan terms and worked example. */
  compact?: boolean;
  /** Schedule the booking was paid against; shown instead of a live preview once locked. */
  snapshot?: PaymentPlanPreview | null;
  missingPricesHint?: string;
}) {
  const { plans, plansLoading, plansError, reloadPlans, selectedPlan, previewLoading, previewError, selection } = state;
  const preview = locked && snapshot ? snapshot : state.preview;
  const valueKnown = !value || plans.some((plan) => plan.code === value);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold text-ink">Payment plan</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={locked || plansLoading || (!plans.length && !value)}
          className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-70"
        >
          <option value="">{plansLoading ? 'Loading plans…' : 'Select a payment plan'}</option>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {planDisplayName(plan)}
            </option>
          ))}
          {/* A saved plan that is no longer listed (retired, or the list failed). */}
          {!valueKnown && <option value={value}>{value}</option>}
        </select>
        {locked && (
          <span className="mt-1 block text-[11px] text-ink-muted">
            The plan is fixed by the booking payment. Contact our office to change it.
          </span>
        )}
      </label>

      {plansError && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {plansError}
          <button type="button" onClick={reloadPlans} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </p>
      )}
      {!plansLoading && !plansError && !plans.length && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          No payment plans are available for this project yet. Please contact our sales desk.
        </p>
      )}
      {value && !valueKnown && !plansLoading && !locked && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The saved plan is no longer offered. Please choose a plan again.
        </p>
      )}

      {selectedPlan && !compact && (
        <div className="rounded-lg border border-hairline bg-bg p-4">
          <p className="text-sm font-semibold text-ink">{planDisplayName(selectedPlan)}</p>
          {selectedPlan.description && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{selectedPlan.description}</p>}
          <div className="mt-3 overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="text-left uppercase tracking-[0.04em] text-ink-muted">
                  <th className="px-3 py-2 font-semibold">Instalment</th>
                  <th className="px-3 py-2 font-semibold">% of BSP</th>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">+ Charge</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlan.instalments.map((row) => (
                  <tr key={row.seq} className="border-t border-hairline">
                    <td className="px-3 py-2 text-ink">{row.label}</td>
                    <td className="px-3 py-2 text-ink">{row.percent}%</td>
                    <td className="px-3 py-2 text-ink-muted">{row.due_text}</td>
                    <td className="px-3 py-2 text-ink-muted">{chargeHeadLabel(row.charge_head) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedPlan.example && selectedPlan.example.rows.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-green">
                Example on {formatCurrencyINR(selectedPlan.example.sale_price)}
              </summary>
              <p className="mt-2 text-xs text-ink-muted">
                Example: Sale price {formatCurrencyINR(selectedPlan.example.sale_price)} + PLC{' '}
                {formatCurrencyINR(selectedPlan.example.plc)} + IFMS {formatCurrencyINR(selectedPlan.example.ifms)} + CAM{' '}
                {formatCurrencyINR(selectedPlan.example.cam)} = {formatCurrencyINR(selectedPlan.example.total)}.
              </p>
              <div className="mt-2">
                <PlanScheduleTable rows={selectedPlan.example.rows} total={selectedPlan.example.total} showDates={false} />
              </div>
            </details>
          )}
        </div>
      )}

      {value && !selection && !locked && <p className="text-xs text-ink-muted">{missingPricesHint}</p>}
      {selection && previewLoading && <p className="text-xs text-ink-muted">Calculating instalments…</p>}
      {selection && previewError && !previewLoading && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {previewError}
        </p>
      )}
      {preview && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-hairline bg-bg px-3 py-3">
              <p className="text-xs font-semibold text-ink-muted">Total plot amount</p>
              <p className="mt-1 font-display text-xl font-bold text-ink">{formatCurrencyINR(preview.total)}</p>
            </div>
            <div className="rounded-lg border border-green/30 bg-green/10 px-3 py-3">
              <p className="text-xs font-semibold text-ink-muted">Booking amount (first instalment)</p>
              <p className="mt-1 font-display text-xl font-bold text-ink">{formatCurrencyINR(preview.booking_amount)}</p>
            </div>
          </div>
          {!compact && <PlanScheduleTable rows={preview.rows} total={preview.total} />}
          {!compact && !(locked && snapshot) && (
            <p className="text-[11px] text-ink-muted">
              Due dates are counted from today and are fixed from the actual booking date once the booking payment is made.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
