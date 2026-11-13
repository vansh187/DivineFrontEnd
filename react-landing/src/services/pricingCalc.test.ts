import { describe, expect, it } from 'vitest';
import { applyPricingChange, CAM_DURATION_OPTIONS, camDurationLabel, camDurationMonths, camRateLabel, isCamDuration, pricingTotal, pricingTotalFields, roundHalfUp, sanitizeAmountInput, type PricingChange, type PricingField } from './pricingCalc';
import { previewMatches, roundRupee } from './paymentPlansApi';
import { emptyBookingApplicationFormData, isBookingPaymentComplete, restoreBookingFormData, type BookingApplicationFormData } from './documentStore';

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
      { field: 'rate', row: 'plc', value: '2' },
      { field: 'rate', row: 'ifms', value: '250' },
      { field: 'price', row: 'cam', value: '75000' },
    ]);
    expect(form.basicSalePrice).toBe('5000000');
    expect(form.plcPrice).toBe('100000');
    expect(form.ifmsAmount).toBe('50000');
    expect(form.camAmount).toBe('75000');
    expect(form.camRatePerSqYd).toBe('31.25'); // 75,000 ÷ (200 sq yd × 12 months)
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
    expect(form.plcPercent).toBe('1.6'); // 1,00,000 of a 62,50,000 BSP
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

describe('PLC as a percentage of the Basic Sale Price', () => {
  it('PLC amount = BSP × PLC % ÷ 100 (spec example: 5% of 20,00,000 = 1,00,000)', () => {
    const form = run([
      { field: 'price', row: 'bsp', value: '2000000' },
      { field: 'rate', row: 'plc', value: '5' },
    ]);
    expect(form.plcPrice).toBe('100000');
    expect(form.totalAmount).toBe('2100000');
  });

  it('does not need the plot area', () => {
    const form = run([
      { field: 'rate', row: 'plc', value: '5' },
      { field: 'price', row: 'bsp', value: '2000000' },
    ]);
    expect(form.plcPrice).toBe('100000');
  });

  it('follows the BSP when the BSP changes, directly or through the area', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'bsp', value: '10000' },
      { field: 'rate', row: 'plc', value: '5' },
      { field: 'area', value: '250' },
    ]);
    expect(form.basicSalePrice).toBe('2500000');
    expect(form.plcPrice).toBe('125000');
    expect(form.totalAmount).toBe('2625000');
  });

  it('clears an auto-filled PLC amount when the BSP is cleared', () => {
    const form = run([
      { field: 'price', row: 'bsp', value: '6250000' },
      { field: 'rate', row: 'plc', value: '2' },
      { field: 'price', row: 'bsp', value: '' },
    ]);
    expect(form.plcPercent).toBe('2');
    expect(form.plcPrice).toBe('');
    expect(form.totalAmount).toBe('');
    // ...and brings it back when a BSP is entered again
    expect(run([{ field: 'price', row: 'bsp', value: '1000000' }], form).plcPrice).toBe('20000');
  });

  it('keeps a PLC amount the customer typed when the BSP is cleared', () => {
    const form = run([
      { field: 'price', row: 'bsp', value: '2000000' },
      { field: 'price', row: 'plc', value: '150000' },
      { field: 'price', row: 'bsp', value: '' },
    ]);
    expect(form.plcPrice).toBe('150000');
  });

  it('refuses a PLC % over 100', () => {
    const form = run([
      { field: 'price', row: 'bsp', value: '2000000' },
      { field: 'rate', row: 'plc', value: '15' },
      { field: 'rate', row: 'plc', value: '150' },
    ]);
    expect(form.plcPercent).toBe('15');
    expect(form.plcPrice).toBe('300000');
    expect(run([{ field: 'rate', row: 'plc', value: '100' }], form).plcPrice).toBe('2000000');
  });

  it('works the % back from a typed PLC amount', () => {
    const form = run([
      { field: 'price', row: 'bsp', value: '2000000' },
      { field: 'price', row: 'plc', value: '150000' },
    ]);
    expect(form.plcPercent).toBe('7.5');
  });
});

describe('CAM = area × rate per sq yd per month × duration in months', () => {
  it('converts years to months: 200 sq yd × Rs 7 × 2 years (24 months) = 33,600', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'cam', value: '7' },
      { field: 'camDuration', value: '2' },
    ]);
    expect(form.camAmount).toBe('33600');
    expect(form.totalAmount).toBe('33600');
  });

  it('defaults to 1 year and recalculates when the duration or area changes', () => {
    let form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'cam', value: '7' },
    ]);
    expect(form.camDurationYears).toBe('1');
    expect(form.camAmount).toBe('16800'); // 200 × 7 × 12 months
    form = run([{ field: 'camDuration', value: '4.5' }], form);
    expect(form.camAmount).toBe('75600'); // 200 × 7 × 54 months
    form = run([{ field: 'area', value: '300' }], form);
    expect(form.camAmount).toBe('113400'); // 300 × 7 × 54 months
  });

  it('works the rate back from a typed CAM amount', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'camDuration', value: '2.5' },
      { field: 'price', row: 'cam', value: '60000' },
    ]);
    expect(form.camRatePerSqYd).toBe('10'); // 60,000 ÷ (200 × 30 months)
  });

  it('offers 1 to 5 years in half-year steps', () => {
    expect(CAM_DURATION_OPTIONS).toEqual(['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5']);
    expect(camDurationLabel('1')).toBe('1 Year (12 months)');
    expect(camDurationLabel('2.5')).toBe('2.5 Years (30 months)');
    expect(camDurationMonths('1')).toBe(12);
    expect(camDurationMonths('4.5')).toBe(54);
    expect(camDurationMonths('')).toBe(0);
    expect(camDurationLabel('')).toBe('');
    expect(camDurationLabel('6')).toBe('');
    expect(isCamDuration('4.5')).toBe(true);
    expect(isCamDuration('')).toBe(false);
  });

  it('clears an auto-filled CAM amount when no duration is chosen', () => {
    const form = run([
      { field: 'area', value: '200' },
      { field: 'rate', row: 'cam', value: '7' },
      { field: 'camDuration', value: '' },
    ]);
    expect(form.camAmount).toBe('');
  });
});

describe('restoring a saved draft', () => {
  it('fills the new defaults and turns a legacy per-sq-yd PLC rate into a %', () => {
    const restored = restoreBookingFormData({ plcRatePerSqYd: '500', plcPrice: '100000', basicSalePrice: '5000000' });
    expect(restored).not.toHaveProperty('plcRatePerSqYd');
    expect(restored.plcPercent).toBe('2');
    expect(restored.plcPrice).toBe('100000');
    expect(restored.camDurationYears).toBe('1');
  });

  // Saved before the months conversion: no camRateBasis, CAM = area × rate × years.
  const legacyDraft = {
    plotAreaSqYd: '200', basicSalePrice: '5000000',
    camRatePerSqYd: '7', camDurationYears: '2', camAmount: '2800',
    totalAmount: '5002800', amountInFigure: '5002800', totalPlotAmount: '5002800', totalAmountWords: 'old words',
    bookingAmount: '500280', bookingAmountWords: 'old booking words',
  };

  it('moves an unpaid pre-months draft onto the monthly rule: rate kept, amount and totals redone', () => {
    const restored = restoreBookingFormData(legacyDraft);
    expect(restored.camRatePerSqYd).toBe('7');
    expect(restored.camAmount).toBe('33600'); // 200 × 7 × 24 months
    expect(restored).toMatchObject({ totalAmount: '5033600', amountInFigure: '5033600', totalPlotAmount: '5033600' });
    expect(restored.totalAmountWords).not.toBe('old words');
    // the booking amount depends on the total, so it waits for a fresh plan preview
    expect(restored).toMatchObject({ bookingAmount: '', bookingAmountWords: '' });
    expect(restored.camRateBasis).toBe('monthly');
  });

  it('migrates only once, so a CAM amount typed under the monthly rule always sticks', () => {
    const once = restoreBookingFormData(legacyDraft);
    expect(restoreBookingFormData(once)).toEqual(once);
    // typed under the new build, even though it equals the old years-only figure
    const typed = { ...legacyDraft, camRateBasis: 'monthly' };
    expect(restoreBookingFormData(typed).camAmount).toBe('2800');
    expect(restoreBookingFormData(typed).totalAmount).toBe('5002800');
  });

  it('keeps an old CAM amount that has no rate (nothing to redo it from)', () => {
    const restored = restoreBookingFormData({ ...legacyDraft, camRatePerSqYd: '' });
    expect(restored.camAmount).toBe('2800');
    expect(restored.bookingAmount).toBe('500280');
    expect(restored.camRateBasis).toBe('monthly');
  });

  it('redoes a pre-months amount whose rate was rounded when back-filled', () => {
    // 1000 typed for 150 sq yd × 1 year back-filled a 6.67 rate (150 × 6.67 = 1000.5)
    const restored = restoreBookingFormData({ plotAreaSqYd: '150', camRatePerSqYd: '6.67', camDurationYears: '1', camAmount: '1000' });
    expect(restored.camAmount).toBe('12006'); // 150 × 6.67 × 12, consistent with what any later edit gives
    expect(restored.camRateBasis).toBe('monthly');
  });

  it('keeps the prices of a draft with a booking payment exactly, marked legacy', () => {
    const restored = restoreBookingFormData(legacyDraft, { paymentMade: true });
    expect(restored).toMatchObject({ camAmount: '2800', totalAmount: '5002800', bookingAmount: '500280', camRateBasis: 'legacy' });
    // and still legacy on the next load, but moved over once no payment stands
    expect(restoreBookingFormData(restored, { paymentMade: true })).toEqual(restored);
    expect(restoreBookingFormData(restored).camAmount).toBe('33600');
  });

  it('labels legacy figures the way they were worked out', () => {
    expect(camDurationLabel('2', 'legacy')).toBe('2 Years');
    expect(camRateLabel('legacy')).toBe('rate per sq yard');
    expect(camDurationLabel('2', 'monthly')).toBe('2 Years (24 months)');
    expect(camRateLabel('monthly')).toBe('rate per sq yard per month');
  });

  it('editing a legacy form moves it onto the monthly rule first', () => {
    const legacy = restoreBookingFormData(legacyDraft, { paymentMade: true });
    const form = run([{ field: 'rate', row: 'bsp', value: '25000' }], legacy);
    expect(form.camRateBasis).toBe('monthly');
    expect(form.camAmount).toBe('33600');
    expect(form.totalAmount).toBe('5033600');
  });

  it('leaves a current draft as it was', () => {
    const restored = restoreBookingFormData({ plcPercent: '5', plcPrice: '100000', basicSalePrice: '2000000', camDurationYears: '2.5', camRateBasis: 'monthly' });
    expect(restored).toMatchObject({ plcPercent: '5', camDurationYears: '2.5', camRateBasis: 'monthly' });
    expect(restoreBookingFormData(undefined)).toEqual(emptyBookingApplicationFormData());
  });

  it('counts a booking payment as complete only with a payment reference', () => {
    expect(isBookingPaymentComplete({ status: 'paid', paymentId: 'pay_1' })).toBe(true);
    expect(isBookingPaymentComplete({ status: 'paid', paymentId: null })).toBe(false);
    expect(isBookingPaymentComplete({ status: 'created', paymentId: 'pay_1' })).toBe(false);
    expect(isBookingPaymentComplete(null)).toBe(false);
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
      { field: 'rate', row: 'plc', value: '2.5' },
      { field: 'rate', row: 'cam', value: '7.25' },
      { field: 'camDuration', value: '1.5' },
    ]);
    expect(form.basicSalePrice).toBe('4583425'); // 166.67 × 27500 = 4,583,425
    expect(form.plcPrice).toBe('114586'); // 4,583,425 × 2.5% = 114,585.625 → 114,586
    expect(form.camAmount).toBe('21750'); // 166.67 × 7.25 × 18 months = 21,750.435 → 21,750
    expect(form.totalAmount).toBe('4719761');
  });

  it('totals match the server: each price rounded half-up, then summed', () => {
    const form = {
      plotAreaSqYd: '',
      ratePerSqYd: '', basicSalePrice: '2500000.5',
      plcPercent: '', plcPrice: '1,00,000.49',
      ifmsRatePerSqYd: '', ifmsAmount: '50000.5',
      camRatePerSqYd: '', camDurationYears: '1', camAmount: '', camRateBasis: 'monthly' as const,
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
