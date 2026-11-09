import { describe, expect, it } from 'vitest';
import { applyPricingChange, pricingTotal, pricingTotalFields, roundHalfUp, sanitizeAmountInput, type PricingChange, type PricingField } from './pricingCalc';
import { previewMatches, roundRupee } from './paymentPlansApi';
import { emptyBookingApplicationFormData, type BookingApplicationFormData } from './documentStore';

/** Replays a sequence of keystrokes-worth of changes the way the page does. */
function run(changes: PricingChange[], start: Partial<BookingApplicationFormData> = {}) {
  let form: BookingApplicationFormData = { ...emptyBookingApplicationFormData(), ...start };
  let autoFilled = new Set<PricingField>();
  for (const change of changes) {
    const result = applyPricingChange(form, change, autoFilled);
    form = { ...form, ...result.updates };
    autoFilled = result.autoFilled;
  }
  return form;
}

describe('pricing auto-calculation', () => {
  it('fills price = rate × area and totals A+B+C+D', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'bsp', value: '25000' },
      { field: 'rate', row: 'plc', value: '500' },
      { field: 'rate', row: 'ifms', value: '250' },
      { field: 'price', row: 'cam', value: '75000' },
    ]);
    expect(form.basicSalePrice).toBe('5000000');
    expect(form.plcPrice).toBe('100000');
    expect(form.ifmsAmount).toBe('50000');
    expect(form.camAmount).toBe('75000');
    expect(form.camRatePerSqYd).toBe('375');
    expect(form.totalAmount).toBe('5225000');
    expect(form.amountInFigure).toBe('5225000');
    expect(form.totalAmountWords).not.toBe('');
  });

  it('lets every field be typed freely before the area is known', () => {
    const form = run([
      { field: 'rate', row: 'bsp', value: '25000' },
      { field: 'price', row: 'bsp', value: '4800000' },
      { field: 'price', row: 'plc', value: '90000' },
    ]);
    expect(form.ratePerSqYd).toBe('25000');
    expect(form.basicSalePrice).toBe('4800000');
    expect(form.totalAmount).toBe('4890000');
  });

  it('never overwrites a rate the customer typed when they then type the price', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'bsp', value: '25000' },
      { field: 'price', row: 'bsp', value: '4900000' },
    ]);
    expect(form.ratePerSqYd).toBe('25000');
    expect(form.basicSalePrice).toBe('4900000');
    expect(form.totalAmount).toBe('4900000');
  });

  it('back-fills an empty (or auto-filled) rate from a typed price', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'price', row: 'bsp', value: '5000000' },
      { field: 'price', row: 'bsp', value: '5100000' },
    ]);
    expect(form.ratePerSqYd).toBe('25500');
  });

  it('recalculates from typed rates when the area changes, and re-derives auto-filled rates', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'bsp', value: '25000' },
      { field: 'price', row: 'plc', value: '100000' },
      { field: 'area', value: '250' },
    ]);
    expect(form.basicSalePrice).toBe('6250000');
    expect(form.plcPrice).toBe('100000');
    expect(form.plcRatePerSqYd).toBe('400');
    expect(form.totalAmount).toBe('6350000');
  });

  it('keeps the area field free (any value, minus sign dropped) and clears the plan booking amount', () => {
    const form = run([{ field: 'area', value: '-1.5' }], { bookingAmount: '500000', bookingAmountWords: 'x' });
    expect(form.plotAreaSqYd).toBe('1.5');
    expect(form.bookingAmount).toBe('');
    expect(form.bookingAmountWords).toBe('');
  });

  it('clearing a rate clears its auto-filled price and the total', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'bsp', value: '25000' },
      { field: 'rate', row: 'bsp', value: '' },
    ]);
    expect(form.basicSalePrice).toBe('');
    expect(form.totalAmount).toBe('');
  });
});

describe('pricing calculation accuracy', () => {
  it('rounds half-up without binary floating-point error', () => {
    // 1.005 × 100 = 100.49999999999999 in JS; plain Math.round gives 100, the correct rupee is 101.
    expect(Math.round(1.005 * 100)).toBe(100);
    expect(roundHalfUp(1.005 * 100)).toBe(101);
    expect(roundHalfUp(0.145 * 100)).toBe(15);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(2500000.5)).toBe(2500001);
    expect(roundHalfUp(2500000.49)).toBe(2500000);
    expect(roundRupee(1.005 * 100)).toBe(101);
  });

  it('computes price from rate × area with correct rounding', () => {
    const form = run([
      { field: 'area', value: '100' },
      { field: 'rate', row: 'bsp', value: '1.005' },
    ]);
    expect(form.basicSalePrice).toBe('101');
    expect(form.totalAmount).toBe('101');
  });

  it('handles fractional areas and rates like real plots', () => {
    const form = run([
      { field: 'area', value: '166.67' },
      { field: 'rate', row: 'bsp', value: '27500' },
      { field: 'rate', row: 'plc', value: '1375.5' },
    ]);
    expect(form.basicSalePrice).toBe('4583425'); // 166.67 × 27500 = 4,583,425
    expect(form.plcPrice).toBe('229255'); // 166.67 × 1375.5 = 229,254.585 → 229,255
    expect(form.totalAmount).toBe('4812680');
  });

  it('totals match the server: each price rounded half-up, then summed', () => {
    const form = {
      plotAreaSqYd: '',
      ratePerSqYd: '', basicSalePrice: '2500000.5',
      plcRatePerSqYd: '', plcPrice: '1,00,000.49',
      ifmsRatePerSqYd: '', ifmsAmount: '50000.5',
      camRatePerSqYd: '', camAmount: '',
    };
    // 2500001 + 100000 + 50001 + 0
    expect(pricingTotal(form)).toBe(2650002);
    expect(pricingTotalFields(form)).toMatchObject({ totalAmount: '2650002', amountInFigure: '2650002', totalPlotAmount: '2650002' });
  });

  it('only keeps characters that form a positive amount', () => {
    expect(sanitizeAmountInput('25,000abc')).toBe('25,000');
    expect(sanitizeAmountInput('₹ 1,00,000')).toBe('1,00,000');
    expect(sanitizeAmountInput('-500')).toBe('500');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
    expect(sanitizeAmountInput('5e3')).toBe('53');
    const form = run([{ field: 'price', row: 'bsp', value: 'Rs 50,00,000/-' }]);
    expect(form.basicSalePrice).toBe('50,00,000');
    expect(form.totalAmount).toBe('5000000');
  });

  it('the value the customer sees is the value that is totalled and previewed', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'bsp', value: '25,000' },
    ]);
    expect(form.basicSalePrice).toBe('5000000');
    const preview = {
      plan: { code: 'PP2/FPP/10-90', short_code: 'PP2', name: 'PP2', version: 1 },
      sale_price: 5000000, plc: 0, ifms: 0, cam: 0, total: 5000000, booking_amount: 500000, booking_date: null, rows: [],
    };
    expect(previewMatches(preview, { planCode: 'PP2/FPP/10-90', salePrice: 5000000, plcAmount: 0, ifmsAmount: 0, camAmount: 0 })).toBe(true);
  });

  it('empty and zero inputs give an empty total, never NaN', () => {
    const form = run([
      { field: 'area', value: '' },
      { field: 'rate', row: 'bsp', value: '.' },
      { field: 'price', row: 'plc', value: ',' },
    ]);
    expect(form.totalAmount).toBe('');
    expect(form.totalAmountWords).toBe('');
    expect(form.basicSalePrice).toBe('');
  });
});
