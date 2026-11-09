import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../services/authApi';
import {
  listPaymentPlans,
  previewMatches,
  previewPaymentPlan,
  type BookingPlanSelection,
  type PaymentPlanOption,
  type PaymentPlanPreview,
  type PlanPrices,
} from '../services/paymentPlansApi';

const PREVIEW_DEBOUNCE_MS = 300;

export interface PaymentPlanPreviewState {
  plans: PaymentPlanOption[];
  plansLoading: boolean;
  plansError: string | null;
  reloadPlans: () => void;
  /** The plan matching `planCode`, once the list has loaded. */
  selectedPlan: PaymentPlanOption | null;
  /** Latest preview, only while it still matches the current plan + prices. */
  preview: PaymentPlanPreview | null;
  previewLoading: boolean;
  previewError: string | null;
  /** The plan + prices to send with the booking payment, or `null` while incomplete. */
  selection: BookingPlanSelection | null;
  /** True once a preview for exactly the current inputs has loaded — the only
   * state in which the booking amount may be shown as final or charged. */
  ready: boolean;
}

/**
 * Loads the payment plans for a project and keeps a server preview of the
 * selected plan in step with the prices typed in (debounced ~300 ms).
 *
 * Pass `enabled: false` once the booking payment is made: the plan and prices
 * are then locked and nothing is re-fetched.
 */
export function usePaymentPlanPreview({
  projectId,
  planCode,
  prices,
  enabled = true,
}: {
  projectId: string | null | undefined;
  planCode: string | null | undefined;
  prices: PlanPrices;
  enabled?: boolean;
}): PaymentPlanPreviewState {
  const [plans, setPlans] = useState<PaymentPlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [plansTick, setPlansTick] = useState(0);
  const [preview, setPreview] = useState<PaymentPlanPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const reloadPlans = useCallback(() => setPlansTick((value) => value + 1), []);

  useEffect(() => {
    if (!projectId) {
      setPlans([]);
      setPlansError(null);
      return;
    }
    let cancelled = false;
    setPlansLoading(true);
    setPlansError(null);
    listPaymentPlans(projectId, { fresh: plansTick > 0 })
      .then((list) => {
        if (!cancelled) setPlans(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlans([]);
        setPlansError(err instanceof Error ? err.message : 'Could not load the payment plans.');
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, plansTick]);

  const { salePrice, plcAmount, ifmsAmount, camAmount } = prices;
  const selection = useMemo<BookingPlanSelection | null>(() => {
    const code = planCode?.trim();
    if (!code || !(salePrice > 0)) return null;
    if ([plcAmount, ifmsAmount, camAmount].some((value) => !Number.isFinite(value) || value < 0)) return null;
    return { planCode: code, salePrice, plcAmount, ifmsAmount, camAmount };
  }, [planCode, salePrice, plcAmount, ifmsAmount, camAmount]);

  useEffect(() => {
    if (!enabled || !selection) {
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);
    const timer = window.setTimeout(() => {
      previewPaymentPlan({ ...selection, projectId }, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setPreview(result);
          setPreviewLoading(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setPreviewLoading(false);
          setPreviewError(err instanceof Error ? err.message : 'Could not calculate the instalments.');
          // A retired plan: refresh the list so the dropdown stops offering it.
          if (err instanceof ApiError && err.detail === 'payment_plan_not_found') reloadPlans();
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, selection, projectId, reloadPlans]);

  const matchingPreview = previewMatches(preview, selection) ? preview : null;
  const selectedPlan = plans.find((plan) => plan.code === planCode) ?? null;

  return {
    plans,
    plansLoading,
    plansError,
    reloadPlans,
    selectedPlan,
    preview: matchingPreview,
    previewLoading: previewLoading && enabled,
    previewError,
    selection,
    ready: !!matchingPreview && !previewLoading && !previewError,
  };
}
