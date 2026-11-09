import type { BookingApplicationFormData } from './documentStore';
import { amountToIndianWords } from '../utils/currency';

/**
 * Pricing-table auto-calculation for the booking form.
 *
 * Every field stays free to type in. Auto-calculation only ever fills the
 * *other* field of a row, and never overwrites a value the customer typed
 * themselves:
 *   - rate typed            → price = rate × plot area (sq yd)
 *   - price typed           → rate = price ÷ area, but only if the rate is empty
 *                             or was itself auto-filled
 *   - plot area changed     → rows with a typed rate get a new price; rows with
 *                             only a typed price get a new auto-filled rate
 *   - any change            → Total (A+B+C+D), amount in figure / words
 *
 * The booking amount is deliberately NOT computed here: it depends on the
 * payment plan and comes only from the server preview (cleared on every change).
 */

export type PriceRowKind = 'bsp' | 'plc' | 'ifms' | 'cam';

export type PricingField =
  | 'ratePerSqYd'
  | 'basicSalePrice'
  | 'plcRatePerSqYd'
  | 'plcPrice'
  | 'ifmsRatePerSqYd'
  | 'ifmsAmount'
  | 'camRatePerSqYd'
  | 'camAmount';

export const PRICE_ROW_FIELDS: Record<PriceRowKind, { rate: PricingField; price: PricingField }> = {
  bsp: { rate: 'ratePerSqYd', price: 'basicSalePrice' },
  plc: { rate: 'plcRatePerSqYd', price: 'plcPrice' },
  ifms: { rate: 'ifmsRatePerSqYd', price: 'ifmsAmount' },
  cam: { rate: 'camRatePerSqYd', price: 'camAmount' },
};

export type PricingChange =
  | { field: 'rate'; row: PriceRowKind; value: string }
  | { field: 'price'; row: PriceRowKind; value: string }
  | { field: 'area'; value: string };

export interface PricingResult {
  updates: Partial<BookingApplicationFormData>;
  /** Fields whose current value was filled by auto-calculation, not typed. */
  autoFilled: Set<PricingField>;
}

type PricingForm = Pick<BookingApplicationFormData, PricingField | 'plotAreaSqYd'>;

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

export function applyPricingChange(
  form: PricingForm,
  change: PricingChange,
  previouslyAutoFilled: ReadonlySet<PricingField>,
): PricingResult {
  const autoFilled = new Set(previouslyAutoFilled);
  const updates: Partial<BookingApplicationFormData> = {};
  const next: PricingForm = { ...form };
  const set = (field: PricingField | 'plotAreaSqYd', value: string) => {
    updates[field] = value;
    next[field] = value;
  };
  const rateIsReplaceable = (rateField: PricingField) =>
    !next[rateField].trim() || autoFilled.has(rateField);

  if (change.field === 'area') {
    const areaText = sanitizeAmountInput(change.value);
    const area = parseAmount(areaText);
    set('plotAreaSqYd', areaText);
    if (area > 0) {
      for (const { rate, price } of Object.values(PRICE_ROW_FIELDS)) {
        if (parseAmount(next[rate]) > 0 && !autoFilled.has(rate)) {
          set(price, amountString(parseAmount(next[rate]) * area));
          autoFilled.add(price);
        } else if (parseAmount(next[price]) > 0 && rateIsReplaceable(rate)) {
          set(rate, amountString(parseAmount(next[price]) / area, 2));
          autoFilled.add(rate);
        }
      }
    }
  } else {
    const { rate, price } = PRICE_ROW_FIELDS[change.row];
    const value = sanitizeAmountInput(change.value);
    const area = parseAmount(next.plotAreaSqYd);
    if (change.field === 'rate') {
      set(rate, value);
      autoFilled.delete(rate);
      if (area > 0) {
        set(price, amountString(parseAmount(value) * area));
        autoFilled.add(price);
      }
    } else {
      set(price, value);
      autoFilled.delete(price);
      if (area > 0 && rateIsReplaceable(rate)) {
        set(rate, amountString(parseAmount(value) / area, 2));
        autoFilled.add(rate);
      }
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
