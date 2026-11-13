import type { BookingApplicationFormData } from './documentStore';
import { amountToIndianWords } from '../utils/currency';

/**
 * Pricing-table auto-calculation for the booking form.
 *
 * Each row has a "rate" input and a price, linked by a multiplier:
 *   A. BSP   rate per sq yd  × plot area (sq yd)
 *   B. PLC   % of BSP        × BSP price ÷ 100
 *   C. IFMS  rate per sq yd  × plot area (sq yd)
 *   D. CAM   rate per sq yd per month × plot area (sq yd) × duration in months
 *            (the duration is picked in years and converted: 1 year = 12 months)
 *
 * Every field stays free to type in. Auto-calculation only ever fills the
 * *other* field of a row, and never overwrites a value the customer typed
 * themselves:
 *   - rate typed            → price = rate × multiplier
 *   - price typed           → rate = price ÷ multiplier, but only if the rate is
 *                             empty or was itself auto-filled
 *   - multiplier changed    → (area, BSP price, CAM duration) rows with a typed
 *                             rate get a new price; rows with only a typed price
 *                             get a new auto-filled rate
 *   - any change            → Total (A+B+C+D), amount in figure / words
 *
 * The booking amount is deliberately NOT computed here: it depends on the
 * payment plan and comes only from the server preview (cleared on every change).
 */

export type PriceRowKind = 'bsp' | 'plc' | 'ifms' | 'cam';

export type PricingField =
  | 'ratePerSqYd'
  | 'basicSalePrice'
  | 'plcPercent'
  | 'plcPrice'
  | 'ifmsRatePerSqYd'
  | 'ifmsAmount'
  | 'camRatePerSqYd'
  | 'camAmount';

/** Rows in dependency order: PLC follows BSP because its multiplier is the BSP price. */
export const PRICE_ROW_FIELDS: Record<PriceRowKind, { rate: PricingField; price: PricingField }> = {
  bsp: { rate: 'ratePerSqYd', price: 'basicSalePrice' },
  plc: { rate: 'plcPercent', price: 'plcPrice' },
  ifms: { rate: 'ifmsRatePerSqYd', price: 'ifmsAmount' },
  cam: { rate: 'camRatePerSqYd', price: 'camAmount' },
};

/** CAM is charged for 1 to 5 years in half-year steps. */
export const CAM_DURATION_OPTIONS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'] as const;
export const DEFAULT_CAM_DURATION_YEARS = '1';
export const MONTHS_PER_YEAR = 12;

/**
 * How a form's CAM rate is meant:
 *   - 'monthly' rate per sq yd per month × duration in months (current rule)
 *   - 'legacy'  saved before the months conversion (amount = area × rate × years)
 *               and kept as it was because a booking payment was made against it
 * A draft saved before this field existed has no value and is treated as legacy.
 */
export type CamRateBasis = 'monthly' | 'legacy';
export const CURRENT_CAM_RATE_BASIS: CamRateBasis = 'monthly';

export function isCamDuration(years: string | null | undefined): boolean {
  return (CAM_DURATION_OPTIONS as readonly string[]).includes(String(years ?? ''));
}

/** The chosen CAM duration in months (2.5 years → 30); 0 if none is chosen. */
export function camDurationMonths(years: string | null | undefined): number {
  return isCamDuration(years) ? Number(years) * MONTHS_PER_YEAR : 0;
}

/**
 * "1 Year (12 months)", "2.5 Years (30 months)"; '' for anything that isn't a
 * dropdown option. A legacy form was not worked out in months, so it gets the
 * plain "2 Years".
 */
export function camDurationLabel(years: string, basis: CamRateBasis = CURRENT_CAM_RATE_BASIS): string {
  if (!isCamDuration(years)) return '';
  const label = `${years} ${years === '1' ? 'Year' : 'Years'}`;
  return basis === 'legacy' ? label : `${label} (${camDurationMonths(years)} months)`;
}

/** Row label for the CAM rate, matching how the rate is meant. */
export function camRateLabel(basis: CamRateBasis = CURRENT_CAM_RATE_BASIS): string {
  return basis === 'legacy' ? 'rate per sq yard' : 'rate per sq yard per month';
}

/** PLC is a share of the Basic Sale Price, so a % above this is a typo. */
export const MAX_PLC_PERCENT = 100;

export type PricingChange =
  | { field: 'rate'; row: PriceRowKind; value: string }
  | { field: 'price'; row: PriceRowKind; value: string }
  | { field: 'area'; value: string }
  | { field: 'camDuration'; value: string };

export interface PricingResult {
  updates: Partial<BookingApplicationFormData>;
  /** Fields whose current value was filled by auto-calculation, not typed. */
  autoFilled: Set<PricingField>;
}

type PricingForm = Pick<BookingApplicationFormData, PricingField | 'plotAreaSqYd' | 'camDurationYears' | 'camRateBasis'>;

export function parseAmount(value: string | null | undefined): number {
  const cleaned = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(cleaned) ? cleaned : 0;
}

/**
 * Keeps an amount field to what can be a positive number: digits, Indian-style
 * thousands commas and a single decimal point. Anything else typed or pasted
 * (letters, ₹, minus, spaces, a second '.') is dropped, so what the customer
 * sees is always exactly what gets added up.
 */
export function sanitizeAmountInput(value: string): string {
  const kept = value.replace(/[^0-9.,]/g, '');
  const firstDot = kept.indexOf('.');
  return firstDot === -1 ? kept : kept.slice(0, firstDot + 1) + kept.slice(firstDot + 1).replace(/\./g, '');
}

/**
 * Half-up rounding that is immune to binary floating-point error: 10.15 × 10 is
 * 101.49999999999999 in JS, which plain Math.round turns into 101 instead of
 * 102. Snapping to 6 decimals first removes that noise.
 */
export function roundHalfUp(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(Number((value * factor).toFixed(6))) / factor;
}

/** A positive number as a form string, rounded to `decimals` ('' for 0 / invalid). */
export function amountString(value: number, decimals = 0): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return String(roundHalfUp(value, decimals));
}

/** Total of the four prices, each rounded half-up to the rupee like the server does. */
export function pricingTotal(form: PricingForm): number {
  return (Object.values(PRICE_ROW_FIELDS) as Array<{ price: PricingField }>).reduce(
    (sum, { price }) => sum + roundHalfUp(parseAmount(form[price])),
    0,
  );
}

/** Total / amount in figure / amount in words for the current prices. */
export function pricingTotalFields(form: PricingForm): Partial<BookingApplicationFormData> {
  const total = pricingTotal(form);
  const totalText = total > 0 ? String(total) : '';
  return {
    totalAmount: totalText,
    amountInFigure: totalText,
    totalPlotAmount: totalText,
    totalAmountWords: total > 0 ? amountToIndianWords(total) : '',
  };
}

/**
 * What a row's rate is multiplied by to give its price (0 = not known yet).
 * A CAM duration that isn't one of the dropdown options counts as not chosen.
 */
export function rowMultiplier(row: PriceRowKind, form: PricingForm): number {
  const area = parseAmount(form.plotAreaSqYd);
  switch (row) {
    case 'plc':
      return roundHalfUp(parseAmount(form.basicSalePrice)) / 100;
    case 'cam':
      // CAM rate is per sq yd per month, so the years are converted to months.
      return area * camDurationMonths(form.camDurationYears);
    default:
      return area;
  }
}

/**
 * Moves a form saved before the months conversion onto the monthly rule. The
 * CAM rate is kept (it is the figure the office gives the customer) and the CAM
 * amount is redone as area × rate × months, so the amount, rate and labels agree.
 * When the amount changes, the totals follow and the plan-dependent booking
 * amount is cleared, exactly as for an edit. Returns only what changes.
 */
export function convertLegacyCam(form: PricingForm): Partial<BookingApplicationFormData> {
  if (form.camRateBasis === CURRENT_CAM_RATE_BASIS) return {};
  const updates: Partial<BookingApplicationFormData> = { camRateBasis: CURRENT_CAM_RATE_BASIS };
  const multiplier = rowMultiplier('cam', form);
  const rate = parseAmount(form.camRatePerSqYd);
  if (multiplier > 0 && rate > 0) {
    const camAmount = amountString(rate * multiplier);
    if (camAmount !== form.camAmount) {
      Object.assign(updates, {
        camAmount,
        ...pricingTotalFields({ ...form, camAmount }),
        bookingAmount: '',
        bookingAmountWords: '',
      });
    }
  }
  return updates;
}

export function applyPricingChange(
  currentForm: PricingForm,
  change: PricingChange,
  previouslyAutoFilled: ReadonlySet<PricingField>,
): PricingResult {
  const autoFilled = new Set(previouslyAutoFilled);
  // A legacy form that is being edited moves to the monthly rule first, so the
  // edit is worked out on figures that already agree with it.
  const updates: Partial<BookingApplicationFormData> = convertLegacyCam(currentForm);
  const form: PricingForm = { ...currentForm, ...updates };
  const next: PricingForm = { ...form };
  const set = (field: PricingField | 'plotAreaSqYd' | 'camDurationYears', value: string) => {
    updates[field] = value;
    next[field] = value;
  };
  const rateIsReplaceable = (rateField: PricingField) =>
    !next[rateField].trim() || autoFilled.has(rateField);
  const rows = Object.keys(PRICE_ROW_FIELDS) as PriceRowKind[];
  const multipliersBefore = Object.fromEntries(rows.map((row) => [row, rowMultiplier(row, form)])) as Record<
    PriceRowKind,
    number
  >;

  if (change.field === 'area') {
    set('plotAreaSqYd', sanitizeAmountInput(change.value));
  } else if (change.field === 'camDuration') {
    set('camDurationYears', change.value);
  } else {
    const { row } = change;
    const { rate, price } = PRICE_ROW_FIELDS[row];
    const value = sanitizeAmountInput(change.value);
    // Refuse a PLC % over 100 (e.g. '150' typed for '1.50'): the field keeps
    // its previous value instead of silently inflating every amount.
    if (change.field === 'rate' && row === 'plc' && parseAmount(value) > MAX_PLC_PERCENT) {
      return { updates: {}, autoFilled };
    }
    const multiplier = rowMultiplier(row, next);
    if (change.field === 'rate') {
      set(rate, value);
      autoFilled.delete(rate);
      if (multiplier > 0) {
        set(price, amountString(parseAmount(value) * multiplier));
        autoFilled.add(price);
      }
    } else {
      set(price, value);
      autoFilled.delete(price);
      if (multiplier > 0 && rateIsReplaceable(rate)) {
        set(rate, amountString(parseAmount(value) / multiplier, 2));
        autoFilled.add(rate);
      }
    }
  }

  // Re-work every row whose multiplier moved (area → BSP/IFMS/CAM, BSP price →
  // PLC, duration → CAM). In row order, so a new BSP price flows into PLC.
  for (const row of rows) {
    const multiplier = rowMultiplier(row, next);
    if (multiplier === multipliersBefore[row]) continue;
    const { rate, price } = PRICE_ROW_FIELDS[row];
    if (multiplier <= 0) {
      // Its basis is gone (BSP / area cleared, no duration): an auto-filled
      // price can't stand - e.g. a 2% PLC with no BSP to be 2% of.
      if (autoFilled.has(price) && parseAmount(next[price]) > 0) {
        set(price, '');
        autoFilled.delete(price);
      }
      continue;
    }
    if (parseAmount(next[rate]) > 0 && !autoFilled.has(rate)) {
      set(price, amountString(parseAmount(next[rate]) * multiplier));
      autoFilled.add(price);
    } else if (parseAmount(next[price]) > 0 && rateIsReplaceable(rate)) {
      set(rate, amountString(parseAmount(next[price]) / multiplier, 2));
      autoFilled.add(rate);
    }
  }

  Object.assign(updates, {
    ...pricingTotalFields(next),
    // Plan-dependent: only the server preview may set it.
    bookingAmount: '',
    bookingAmountWords: '',
  });
  return { updates, autoFilled };
}
