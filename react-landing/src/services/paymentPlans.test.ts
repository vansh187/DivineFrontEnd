import { afterEach, describe, expect, it, vi } from 'vitest';
import { chargeHeadLabel, previewMatches, type PaymentPlanPreview } from './paymentPlansApi';
import { deriveSchedule, undatedDueLabel } from './paymentSchedule';
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

describe('deriveSchedule with a custom "Counted from" event', () => {
  const rows = [
    { label: 'Booking Amount', percent: 10, due_days: 0, due_date: '2026-01-01', amount: 100000, due_trigger: 'booking', status: 'paid' },
    {
      label: 'On completion of plinth', percent: 40, due_days: 30, due_date: null, amount: 400000,
      due_trigger: 'custom', due_from: 'Completion of plinth', due_text: '30 days after Completion of plinth',
    },
    { label: 'Within 180 days of booking', percent: 50, due_days: 180, due_date: '2026-06-30', amount: 500000, due_trigger: 'booking' },
  ];

  it('never dates the custom row from the booking date and never makes it payable', () => {
    const milestones = deriveSchedule({ rows, bookingDate: '2026-01-01', totalAmount: 1000000 });
    const plinth = milestones[1];
    expect(plinth.dueDate).toBeNull();
    expect(plinth.awaitingPossession).toBe(true);
    expect(plinth.dueTrigger).toBe('custom');
    expect(plinth.status).toBe('upcoming');
    expect(plinth.payable).toBe(false);
    expect(plinth.dueText).toBe('30 days after Completion of plinth');
  });

  it('lets the dated instalment after an undated event be paid', () => {
    const milestones = deriveSchedule({ rows, bookingDate: '2026-01-01', totalAmount: 1000000 });
    expect(milestones[2]).toMatchObject({ isNext: true, payable: true, amount: 500000 });
  });

  it('credits money received to the dated row paid, not the undated row before it', () => {
    const unstamped = rows.map((row) => ({ ...row, status: undefined }));
    const milestones = deriveSchedule({ rows: unstamped, bookingDate: '2026-01-01', totalAmount: 1000000, receivedAmount: 600000 });
    expect(milestones.map((m) => m.status === 'paid')).toEqual([true, false, true]);
    expect(milestones[1].payable).toBe(false);
    expect(milestones[2].payable).toBe(false);
  });

  it('only possession and custom triggers wait on an event; anything else counts from booking', () => {
    const odd = [
      { label: 'Booking', percent: 10, due_days: 0, amount: 100000, due_trigger: 'on_booking' },
      { label: 'Next', percent: 90, due_days: 30, amount: 900000, due_trigger: 'Booking ' },
    ];
    const milestones = deriveSchedule({ rows: odd, bookingDate: '2026-01-01', totalAmount: 1000000 });
    expect(milestones.map((m) => m.awaitingPossession)).toEqual([false, false]);
    expect(milestones[0]).toMatchObject({ isNext: true, payable: true });
    expect(milestones[1].dueDateISO).toBe('2026-01-31');
  });

  it('labels an undated row by its own trigger', () => {
    expect(undatedDueLabel({ dueTrigger: 'custom', dueFrom: 'Completion of plinth', dueText: null })).toBe('On Completion of plinth');
    expect(undatedDueLabel({ dueTrigger: 'custom', dueFrom: null, dueText: '  ' })).toBe('To be announced');
    expect(undatedDueLabel({ dueTrigger: 'possession', dueFrom: null, dueText: null })).toBe('On Offer of Possession');
    expect(undatedDueLabel({ dueTrigger: 'custom', dueFrom: 'X', dueText: '30 days after X' })).toBe('30 days after X');
  });
});

describe('chargeHeadLabel', () => {
  it('spells out single charges, pairs and all three', () => {
    expect(chargeHeadLabel(null)).toBeNull();
    expect(chargeHeadLabel('PLC')).toBe('PLC');
    expect(chargeHeadLabel('PLC+IFMS')).toBe('PLC + IFMS');
    expect(chargeHeadLabel('PLC+CAM')).toBe('PLC + CAM');
    expect(chargeHeadLabel('IFMS+CAM')).toBe('IFMS + CAM');
    expect(chargeHeadLabel('ALL')).toBe('PLC + IFMS + CAM');
    expect(chargeHeadLabel('PLC+IFMS+CAM')).toBe('PLC + IFMS + CAM');
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
