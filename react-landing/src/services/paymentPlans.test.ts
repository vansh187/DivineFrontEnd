import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewMatches, type PaymentPlanPreview } from './paymentPlansApi';
import { deriveSchedule } from './paymentSchedule';
import { recordCashPayment } from './paymentsApi';

// PP1 worked example from the business spec: sale price 50,00,000 + PLC 1,00,000
// + IFMS 50,000 + CAM 75,000 = 52,25,000; booking amount 5,00,000.
const PP1_PREVIEW: PaymentPlanPreview = {
  plan: { code: 'PP1/FPP/10-15-25-25-15-10', short_code: 'PP1', name: 'Flexible Payment Plan 10-15-25-25-15-10', version: 1 },
  sale_price: 5000000,
  plc: 100000,
  ifms: 50000,
  cam: 75000,
  total: 5225000,
  booking_amount: 500000,
  booking_date: '2026-11-09',
  rows: [],
};

const PP1_SELECTION = { planCode: PP1_PREVIEW.plan.code, salePrice: 5000000, plcAmount: 100000, ifmsAmount: 50000, camAmount: 75000 };

describe('previewMatches', () => {
  it('accepts a preview computed for the same plan and prices', () => {
    expect(previewMatches(PP1_PREVIEW, PP1_SELECTION)).toBe(true);
  });

  it('matches after the server rounds paise to the rupee', () => {
    expect(previewMatches(PP1_PREVIEW, { ...PP1_SELECTION, salePrice: 5000000.4 })).toBe(true);
  });

  it('rejects a stale preview once a price or the plan changes', () => {
    expect(previewMatches(PP1_PREVIEW, { ...PP1_SELECTION, camAmount: 80000 })).toBe(false);
    expect(previewMatches(PP1_PREVIEW, { ...PP1_SELECTION, planCode: 'PP2/FPP/10-90' })).toBe(false);
    expect(previewMatches(null, PP1_SELECTION)).toBe(false);
    expect(previewMatches(PP1_PREVIEW, null)).toBe(false);
  });
});

describe('deriveSchedule with plan rows', () => {
  const rows = [
    { label: 'On Booking', percent: 10, due_days: 0, due_date: '2026-11-09', amount: 500000, due_trigger: 'booking', status: 'paid' },
    { label: 'Within 45 days of booking', percent: 15, due_days: 45, due_date: '2026-12-24', amount: 750000, due_trigger: 'booking' },
    {
      label: 'Within 90 days of booking', percent: 25, due_days: 90, due_date: '2027-02-07', amount: 1350000,
      basic_amount: 1250000, charge_head: 'PLC', charge_amount: 100000, due_trigger: 'booking',
    },
    {
      label: 'On Offer of Possession', percent: 10, due_days: 0, due_date: null, amount: 500000,
      due_trigger: 'possession', due_text: 'On Offer of Possession',
    },
  ];

  it('never dates the possession row from the booking date, and never makes it payable', () => {
    const milestones = deriveSchedule({ rows, bookingDate: '2026-11-09', totalAmount: 5225000 });
    const possession = milestones[3];
    expect(possession.dueDate).toBeNull();
    expect(possession.awaitingPossession).toBe(true);
    expect(possession.status).toBe('upcoming');
    expect(possession.payable).toBe(false);
    expect(possession.dueText).toBe('On Offer of Possession');
  });

  it('keeps the charge breakdown and pays the next row by its full amount', () => {
    const milestones = deriveSchedule({ rows, bookingDate: '2026-11-09', totalAmount: 5225000 });
    expect(milestones[2]).toMatchObject({ amount: 1350000, chargeHead: 'PLC', chargeAmount: 100000 });
    expect(milestones[1]).toMatchObject({ isNext: true, payable: true, amount: 750000 });
  });

  it('does not offer Pay when the only unpaid row is the undated possession row', () => {
    const allButLastPaid = rows.map((row, index) => (index < 3 ? { ...row, status: 'paid' } : row));
    const milestones = deriveSchedule({ rows: allButLastPaid, bookingDate: '2026-11-09' });
    expect(milestones[3].isNext).toBe(true);
    expect(milestones[3].payable).toBe(false);
  });

  it('dates the possession row once the admin sets the possession date', () => {
    const dated = rows.map((row, index) => (index === 3 ? { ...row, due_date: '2028-03-01' } : row));
    const milestones = deriveSchedule({ rows: dated, bookingDate: '2026-11-09' });
    expect(milestones[3].awaitingPossession).toBe(false);
    expect(milestones[3].dueDateISO).toBe('2028-03-01');
  });
});

describe('booking payment request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the plan fields and cheque number with a plot-booking cheque payment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'pay_1', amount: 500000, method: 'cheque', verified: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await recordCashPayment('token', 500000, 'note', { purpose: 'plot_booking', inventoryId: 'unit-1', plan: PP1_SELECTION }, 'cheque', '000123');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      amount: 500000,
      purpose: 'plot_booking',
      method: 'cheque',
      cheque_number: '000123',
      inventory_id: 'unit-1',
      payment_plan_code: 'PP1/FPP/10-15-25-25-15-10',
      sale_price: 5000000,
      plc_amount: 100000,
      ifms_amount: 50000,
      cam_amount: 75000,
    });
    expect(body.utr_number).toBeUndefined();
  });
});
