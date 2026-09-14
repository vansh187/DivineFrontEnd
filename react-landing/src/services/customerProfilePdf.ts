/**
 * Client-side generators for the documents a customer can download from the
 * "My profile" panel — a provisional Allotment Letter and a Demand Letter that
 * mirrors the OPS Divine Greens / KCG Resorts template. There is no backend for
 * either yet, so they are rendered on the fly with pdf-lib from whatever
 * booking-application / Aadhaar data is already cached locally (see
 * documentStore.ts). Helvetica is WinAnsi-encoded and has no rupee glyph, so
 * amounts are prefixed "Rs." rather than "₹".
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { CustomerScheduleRow } from './customerProfileApi';

export interface ProfilePdfInput {
  name: string;
  gender: string;
  age: string;
  address: string;
  email: string;
  phone: string;
  township: string;
  unitNo: string;
  /** Formatted for display, e.g. "131 sq. yd." */
  plotArea: string;
  /** Raw numeric area for the demand-letter subject line, e.g. "131.43". */
  plotAreaSqYd: string;
  unitType: string;
  /** Stable per-customer reference shown on the demand letter, e.g. "ODG-0266". */
  customerId: string;
  /** Total plot price in rupees, if known — drives the payment-schedule amounts. */
  totalAmount: number | null;
  /** Amount already received (booking amount / confirmed payment), in rupees. */
  receivedAmount: number | null;
  /** ISO date the booking application was filed; blank falls back to today. */
  bookingDate: string;
  /** The backend-derived payment plan rows (from the application upload or
   * GET /customer/profile). When present, the letters render these verbatim
   * instead of the hard-coded percentage split. */
  scheduleRows?: CustomerScheduleRow[] | null;
  /** Amount-in-words for the outstanding total, if the backend supplied it. */
  outstandingWords?: string | null;
}

interface ResolvedRow {
  label: string;
  dueDate: Date;
  amount: number;
  percentText: string;
}

/** Turn either the backend rows or the hard-coded schedule into a uniform list
 *  the letter renderers can lay out. `amounts` foot exactly to `total`. */
function resolveScheduleRows(input: ProfilePdfInput): ResolvedRow[] {
  const base = input.bookingDate ? new Date(input.bookingDate) : new Date();
  const total = input.totalAmount ?? 0;
  const rows = input.scheduleRows ?? [];

  if (rows.length > 0) {
    return rows.map((row, i) => ({
      label: row.label,
      dueDate: row.due_date ? new Date(row.due_date) : addDays(base, row.due_days ?? 0),
      amount: typeof row.amount === 'number' ? row.amount : total && Number.isFinite(row.percent) ? Math.round((total * row.percent) / 100) : 0,
      percentText: Number.isFinite(row.percent) ? `${Math.round(row.percent)}%` : `${i + 1}`,
    }));
  }

  const amounts = PAYMENT_SCHEDULE.map((row) => Math.round(total * row.share));
  if (total) amounts[amounts.length - 1] = total - amounts.slice(0, -1).reduce((a, b) => a + b, 0);
  return PAYMENT_SCHEDULE.map((row, i) => ({
    label: row.label,
    dueDate: addDays(base, row.days),
    amount: amounts[i],
    percentText: `${Math.round(row.share * 100)}%`,
  }));
}

const chrome = rgb(44 / 255, 62 / 255, 80 / 255);
const ink = rgb(0.05, 0.12, 0.16);
const muted = rgb(0.35, 0.45, 0.5);
const hairline = rgb(0.8, 0.85, 0.88);
const border = rgb(0.45, 0.5, 0.54);

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 56;

/** Canonical plot payment schedule — a share of the Basic Sale Price against a
 * timeline of days from booking. Single source of truth for the profile-page
 * table, the allotment letter and the demand letter. `days: 0` is "On Booking". */
export const PAYMENT_SCHEDULE: Array<{ label: string; share: number; days: number }> = [
  { label: 'On Booking', share: 0.1, days: 0 },
  { label: 'Within 45 days of booking', share: 0.15, days: 45 },
  { label: 'Within 90 days of booking', share: 0.25, days: 90 },
  { label: 'Within 180 days of booking', share: 0.25, days: 180 },
  { label: 'Within 270 days of booking', share: 0.25, days: 270 },
];

function formatRs(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

function today(): string {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

/** Amount in words, Indian numbering (Lakh / Crore). */
function numberToIndianWords(value: number): string {
  let n = Math.round(Math.abs(value));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitWords(rest));
  return parts.join(' ');
}

function rupeesInWords(value: number): string {
  return `Rupees ${numberToIndianWords(value)} Only`;
}

interface Doc {
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function toBlob(pdfDoc: PDFDocument): Promise<Blob> {
  const bytes = await pdfDoc.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

/* -------------------------------------------------------------------------- */
/*  Allotment letter                                                          */
/* -------------------------------------------------------------------------- */

async function startBrandedDoc(kicker: string, title: string): Promise<Doc> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PAGE);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: PAGE[1] - 96, width: PAGE[0], height: 96, color: chrome });
  page.drawText('DIVINE VISION INFRA', { x: MARGIN, y: PAGE[1] - 44, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(kicker, { x: MARGIN, y: PAGE[1] - 66, size: 9, font, color: rgb(0.85, 0.89, 0.92) });
  page.drawText(`Issued ${today()}`, { x: MARGIN, y: PAGE[1] - 82, size: 9, font, color: rgb(0.85, 0.89, 0.92) });

  const doc: Doc = { pdfDoc, page, font, bold, y: PAGE[1] - 140 };
  doc.page.drawText(title, { x: MARGIN, y: doc.y, size: 18, font: bold, color: ink });
  doc.y -= 28;
  return doc;
}

function text(doc: Doc, value: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
  const size = opts.size ?? 10.5;
  doc.page.drawText(value, { x: MARGIN, y: doc.y, size, font: opts.bold ? doc.bold : doc.font, color: opts.color ?? ink });
  doc.y -= opts.gap ?? size + 8;
}

function paragraph(doc: Doc, value: string, size = 10.5) {
  for (const line of wrap(doc.font, value, size, PAGE[0] - MARGIN * 2)) {
    doc.page.drawText(line, { x: MARGIN, y: doc.y, size, font: doc.font, color: ink });
    doc.y -= size + 5;
  }
  doc.y -= 6;
}

function infoRow(doc: Doc, label: string, value: string) {
  doc.page.drawText(label, { x: MARGIN, y: doc.y, size: 10, font: doc.bold, color: muted });
  for (const line of wrap(doc.font, value || '—', 10.5, PAGE[0] - MARGIN * 2 - 150)) {
    doc.page.drawText(line, { x: MARGIN + 150, y: doc.y, size: 10.5, font: doc.font, color: ink });
    doc.y -= 15;
  }
  doc.y -= 4;
}

export async function generateAllotmentLetterPdf(input: ProfilePdfInput): Promise<Blob> {
  const doc = await startBrandedDoc('Provisional Allotment Letter', 'Provisional Allotment Letter');

  paragraph(
    doc,
    `Dear ${input.name || 'Applicant'}, we are pleased to confirm the provisional allotment of the residential plot detailed below in ${input.township || 'our township'}, subject to the terms and conditions of the booking application form and the Agreement for Sale.`,
  );

  text(doc, 'Allottee details', { bold: true, size: 12, gap: 20 });
  infoRow(doc, 'Name', input.name);
  infoRow(doc, 'Gender', input.gender);
  infoRow(doc, 'Address', input.address);
  infoRow(doc, 'Email', input.email);
  infoRow(doc, 'Phone', input.phone);
  doc.y -= 8;

  text(doc, 'Plot details', { bold: true, size: 12, gap: 20 });
  infoRow(doc, 'Township', input.township);
  infoRow(doc, 'Plot / Unit no.', input.unitNo);
  infoRow(doc, 'Plot area', input.plotArea);
  infoRow(doc, 'Unit type', input.unitType);
  infoRow(doc, 'Total consideration', input.totalAmount ? formatRs(input.totalAmount) : 'As per price list');
  doc.y -= 12;

  paragraph(
    doc,
    'This provisional allotment is subject to realisation of the booking amount and timely payment of all instalments as per the payment schedule. The allotment may be cancelled and earnest money forfeited as per applicable RERA rules in case of breach. This letter does not by itself create any right, title or interest in the plot until the Agreement for Sale is executed and registered.',
    9.5,
  );

  doc.y -= 24;
  doc.page.drawLine({ start: { x: MARGIN, y: doc.y }, end: { x: MARGIN + 180, y: doc.y }, thickness: 0.75, color: hairline });
  doc.y -= 14;
  text(doc, 'For Divine Vision Infra', { size: 9.5, color: muted });
  text(doc, 'Authorised Signatory', { size: 9.5, color: muted });

  // Keep the payment-milestone reference on the allotment letter.
  doc.y -= 18;
  text(doc, 'Indicative payment schedule', { bold: true, size: 11, gap: 16 });
  let allotCumulative = 0;
  resolveScheduleRows(input).forEach(({ label, amount, percentText, dueDate }) => {
    allotCumulative += amount;
    doc.page.drawText(percentText, { x: MARGIN, y: doc.y, size: 9, font: doc.bold, color: muted });
    doc.page.drawText(`${label}  (by ${formatDate(dueDate)})`, { x: MARGIN + 40, y: doc.y, size: 9, font: doc.font, color: ink });
    doc.page.drawText(amount > 0 ? formatRs(amount) : '—', {
      x: PAGE[0] - MARGIN - 90,
      y: doc.y,
      size: 9,
      font: doc.font,
      color: ink,
    });
    doc.y -= 14;
  });
  if (input.totalAmount || allotCumulative) {
    doc.page.drawText('Total', { x: MARGIN + 40, y: doc.y, size: 9, font: doc.bold, color: ink });
    doc.page.drawText(formatRs(input.totalAmount ?? allotCumulative), {
      x: PAGE[0] - MARGIN - 90,
      y: doc.y,
      size: 9,
      font: doc.bold,
      color: ink,
    });
    doc.y -= 14;
  }

  return toBlob(doc.pdfDoc);
}

/* -------------------------------------------------------------------------- */
/*  Demand letter — OPS Divine Greens / KCG Resorts template                  */
/* -------------------------------------------------------------------------- */

const COMPANY = {
  name: 'KCG Resorts Pvt. Ltd.',
  email: 'sales1@divinevisioninfra.com',
  web: 'www.divineinfravision.com',
  state: 'Haryana',
  stateCode: '06',
  gstin: '06AAECK2303D1Z8',
  cin: '55101HR2009PTC039831',
  bankAccount: '370305500283',
  bankHolder: 'KCG Resorts Pvt. Ltd.',
  bankName: 'ICICI Bank Ltd.',
  bankBranch: 'Sector-7, Karnal',
  ifsc: 'ICIC0003703',
  footerEmail: 'sales1@divinevisioninfra.com',
  footerMob: 'Mob : +91-74282 91303',
  footerAddress: 'OPS Divine Greens - Sec-16, Taraori Karnal, Haryana 132116',
};

function cell(
  page: PDFPage,
  x1: number,
  yTop: number,
  x2: number,
  yBottom: number,
  fill?: ReturnType<typeof rgb>,
) {
  page.drawRectangle({
    x: x1,
    y: yBottom,
    width: x2 - x1,
    height: yTop - yBottom,
    borderColor: border,
    borderWidth: 0.75,
    color: fill,
  });
}

function cellText(
  page: PDFPage,
  value: string,
  x: number,
  yTop: number,
  yBottom: number,
  font: PDFFont,
  size: number,
  align: 'left' | 'right' | 'center' = 'left',
  xRight?: number,
) {
  const baseline = (yTop + yBottom) / 2 - size / 3;
  let tx = x + 4;
  if (align === 'right' && xRight != null) tx = xRight - 4 - font.widthOfTextAtSize(value, size);
  if (align === 'center' && xRight != null) tx = (x + xRight) / 2 - font.widthOfTextAtSize(value, size) / 2;
  page.drawText(value, { x: tx, y: baseline, size, font, color: ink });
}

export async function generateDemandLetterPdf(input: ProfilePdfInput): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PAGE);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const left = MARGIN;
  const right = PAGE[0] - MARGIN;
  let y = PAGE[1] - 54;

  // --- Header -------------------------------------------------------------
  page.drawText('K C G RESORTS PVT. LTD', { x: left, y: y - 12, size: 20, font: bold, color: ink });
  page.drawText('OPS Divine', { x: right - 96, y: y - 2, size: 9, font, color: muted });
  page.drawText('Greens', { x: right - 78, y: y - 18, size: 15, font: bold, color: rgb(0.42, 0.55, 0.14) });
  y -= 30;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.4, color: chrome });
  y -= 26;

  // --- Title ------------------------------------------------------------
  const title = 'DEMAND LETTER';
  const titleWidth = bold.widthOfTextAtSize(title, 13);
  page.drawText(title, { x: (PAGE[0] - titleWidth) / 2, y, size: 13, font: bold, color: ink });
  page.drawLine({
    start: { x: (PAGE[0] - titleWidth) / 2, y: y - 2 },
    end: { x: (PAGE[0] + titleWidth) / 2, y: y - 2 },
    thickness: 0.75,
    color: ink,
  });
  y -= 26;

  // --- Company block (right) + date -----------------------------------
  const companyX = PAGE[0] / 2 + 20;
  page.drawText(`Dated: ${formatDate(new Date())}`, { x: companyX, y, size: 9.5, font: bold, color: ink });
  let cy = y - 18;
  const companyLines: Array<[string, string]> = [
    ['', COMPANY.name],
    ['Email: ', COMPANY.email],
    ['Web: ', COMPANY.web],
    ['State: ', COMPANY.state],
    ['State Code: ', COMPANY.stateCode],
    ['GSTIN: ', COMPANY.gstin],
    ['CIN No.: ', COMPANY.cin],
  ];
  companyLines.forEach(([label, value]) => {
    if (label) page.drawText(label, { x: companyX, y: cy, size: 8.5, font: bold, color: ink });
    page.drawText(value, {
      x: companyX + (label ? bold.widthOfTextAtSize(label, 8.5) : 0),
      y: cy,
      size: 8.5,
      font: label ? font : bold,
      color: ink,
    });
    cy -= 12;
  });

  // --- Customer block (left) ----------------------------------------
  let ly = y;
  page.drawText(input.name || 'Customer', { x: left, y: ly, size: 9.5, font: bold, color: ink });
  ly -= 13;
  for (const line of wrap(font, input.address || '—', 8.5, PAGE[0] / 2 - left - 10)) {
    page.drawText(line, { x: left, y: ly, size: 8.5, font, color: ink });
    ly -= 12;
  }
  ly -= 2;
  page.drawText(`Customer ID: ${input.customerId}`, { x: left, y: ly, size: 8.5, font: bold, color: ink });

  y = Math.min(cy, ly) - 24;

  // --- Subject --------------------------------------------------------
  const areaText = input.plotAreaSqYd || input.plotArea || '—';
  const subject = `Subject:- Demand against Plot No. ${input.unitNo || '—'} having Area ${areaText} Sq.Yrd. in "OPS Divine Greens" situated at Sector 16, Taraori, Karnal, Haryana`;
  for (const line of wrap(bold, subject, 9.5, right - left)) {
    page.drawText(line, { x: left, y, size: 9.5, font: bold, color: ink });
    y -= 13;
  }
  y -= 12;

  page.drawText('Dear Sir/Madam,', { x: left, y, size: 9.5, font, color: ink });
  y -= 16;
  for (const line of wrap(
    font,
    'This has reference to your booking of above mentioned Plot. This is to inform you that the following amount stands due as per the payment plan opted by you.',
    9.5,
    right - left,
  )) {
    page.drawText(line, { x: left, y, size: 9.5, font, color: ink });
    y -= 13;
  }
  y -= 14;

  // --- Table --------------------------------------------------------
  const scheduleRows = resolveScheduleRows(input);
  const total = input.totalAmount ?? scheduleRows.reduce((sum, row) => sum + row.amount, 0);
  const received = Math.max(0, input.receivedAmount ?? 0);
  const outstanding = Math.max(0, total - received);
  // When the total consideration isn't on record yet, `outstanding` collapses to
  // 0 - which would print a self-contradictory "Rs. 0 / Rupees Zero Only" demand
  // next to a real "received" figure. Show a dash and a generic remit line instead.
  const hasTotal = total > 0;
  const labels = scheduleRows.map((row) => row.label);
  const dueDates = scheduleRows.map((row) => row.dueDate);
  const amounts = scheduleRows.map((row) => row.amount);
  // "Total Installment" column is a cumulative running sum of the rows above.
  const cumulative: number[] = [];
  amounts.reduce((sum, amt, i) => (cumulative[i] = sum + amt), 0);

  const cX0 = left;
  const cHead = left + 190;
  const cDue = cHead + 66;
  const cInst = cDue + 84;
  const cTot = cInst + 82;
  const cX1 = right;

  const H1 = 20;
  const H2 = 15;
  const RH = 16;

  let ty = y;
  // header row 1
  cell(page, cX0, ty, cHead, ty - H1 - H2, rgb(0.96, 0.97, 0.98));
  cellText(page, 'Particulars', cX0, ty, ty - H1 - H2, bold, 8.5, 'center', cHead);
  cell(page, cHead, ty, cDue, ty - H1 - H2, rgb(0.96, 0.97, 0.98));
  cellText(page, 'Head', cHead, ty, ty - H1 - H2, bold, 8.5, 'center', cDue);
  cell(page, cDue, ty, cInst, ty - H1 - H2, rgb(0.96, 0.97, 0.98));
  cellText(page, 'Due Date', cDue, ty, ty - H1 - H2, bold, 8.5, 'center', cInst);
  cell(page, cInst, ty, cX1, ty - H1, rgb(0.96, 0.97, 0.98));
  cellText(page, 'Receivable', cInst, ty, ty - H1, bold, 8.5, 'center', cX1);
  // header row 2
  cell(page, cInst, ty - H1, cTot, ty - H1 - H2, rgb(0.96, 0.97, 0.98));
  cellText(page, 'Installment', cInst, ty - H1, ty - H1 - H2, bold, 7.5, 'center', cTot);
  cell(page, cTot, ty - H1, cX1, ty - H1 - H2, rgb(0.96, 0.97, 0.98));
  cellText(page, 'Total Installment', cTot, ty - H1, ty - H1 - H2, bold, 7, 'center', cX1);
  ty -= H1 + H2;

  // data rows
  const dataTop = ty;
  labels.forEach((label, i) => {
    cell(page, cX0, ty, cHead, ty - RH);
    cellText(page, label, cX0, ty, ty - RH, font, 7.6);
    cell(page, cDue, ty, cInst, ty - RH);
    cellText(page, formatDate(dueDates[i]), cDue, ty, ty - RH, font, 8, 'center', cInst);
    cell(page, cInst, ty, cTot, ty - RH);
    cellText(page, total ? amounts[i].toLocaleString('en-IN') : '—', cInst, ty, ty - RH, font, 8, 'right', cTot);
    cell(page, cTot, ty, cX1, ty - RH);
    cellText(page, total ? cumulative[i].toLocaleString('en-IN') : '—', cTot, ty, ty - RH, font, 8, 'right', cX1);
    ty -= RH;
  });
  // merged "Basic Price" head cell
  cell(page, cHead, dataTop, cDue, ty);
  cellText(page, 'Basic Price', cHead, dataTop, ty, font, 8, 'center', cDue);

  // summary rows
  const summary: Array<[string, string, boolean]> = [
    ['Total Receivable Amount', total ? total.toLocaleString('en-IN') : '—', false],
    ['Total Received Amount', formatRs(received), false],
    ['Total Outstanding Amount', hasTotal ? formatRs(outstanding) : '—', true],
  ];
  summary.forEach(([label, value, strong], i) => {
    if (i === 0) {
      cell(page, cX0, ty, cInst, ty - RH);
      cellText(page, label, cX0, ty, ty - RH, bold, 8);
      cell(page, cInst, ty, cTot, ty - RH);
      cellText(page, value, cInst, ty, ty - RH, bold, 8, 'right', cTot);
      cell(page, cTot, ty, cX1, ty - RH);
      cellText(page, value, cTot, ty, ty - RH, bold, 8, 'right', cX1);
    } else {
      cell(page, cX0, ty, cInst, ty - RH);
      cellText(page, label, cX0, ty, ty - RH, bold, 8);
      cell(page, cInst, ty, cX1, ty - RH);
      cellText(page, value, cInst, ty, ty - RH, strong ? bold : font, 8.5, 'right', cX1);
    }
    ty -= RH;
  });
  // words row — value spans from the Head column and auto-shrinks to fit
  const wordsRowH = 20;
  cell(page, cX0, ty, cHead, ty - wordsRowH);
  cellText(page, 'Total Outstanding Amount (In Words)', cX0, ty, ty - wordsRowH, bold, 7.2);
  cell(page, cHead, ty, cX1, ty - wordsRowH);
  const outstandingWords = input.outstandingWords?.trim()
    ? `Rupees ${input.outstandingWords.trim().replace(/^Rupees\s+/i, '').replace(/\s+Only\.?$/i, '')} Only`
    : rupeesInWords(outstanding);
  const wordsValue = hasTotal ? `${outstandingWords}.` : '—';
  let wordsSize = 8;
  while (wordsSize > 5 && font.widthOfTextAtSize(wordsValue, wordsSize) > cX1 - cHead - 8) wordsSize -= 0.25;
  cellText(page, wordsValue, cHead, ty, ty - wordsRowH, font, wordsSize);
  ty -= wordsRowH;

  y = ty - 20;

  // --- Remit instruction -------------------------------------------
  const lastDue = formatDate(dueDates[dueDates.length - 1]);
  const remitSentence = hasTotal
    ? `You are requested to remit the total dues of ${formatRs(outstanding)}/- (${outstandingWords}) in favour of "${COMPANY.name}" payable on or before ${lastDue}.`
    : `You are requested to remit the dues as per the payment plan opted by you in favour of "${COMPANY.name}" as and when they fall due.`;
  for (const line of wrap(
    font,
    remitSentence,
    9,
    right - left,
  )) {
    page.drawText(line, { x: left, y, size: 9, font, color: ink });
    y -= 12;
  }
  y -= 12;

  const bankLines = [
    `Bank Account Number: ${COMPANY.bankAccount}`,
    `Name of Account Holder: ${COMPANY.bankHolder}`,
    `Name of Bank: ${COMPANY.bankName}`,
    `Branch Name: ${COMPANY.bankBranch}`,
    `IFSC Code: ${COMPANY.ifsc}`,
  ];
  bankLines.forEach((line) => {
    page.drawText(line, { x: left, y, size: 8.5, font, color: ink });
    y -= 12;
  });
  y -= 10;

  for (const line of wrap(
    font,
    "Kindly note that in case of non-receipt of due amount within stipulated time, interest @18 % p.a. shall be charged as per company's policy on the delayed payments.",
    9,
    right - left,
  )) {
    page.drawText(line, { x: left, y, size: 9, font, color: ink });
    y -= 12;
  }
  y -= 12;
  page.drawText('Thanking you & assuring you of our best services always.', { x: left, y, size: 9, font, color: ink });
  y -= 18;
  page.drawText(`For ${COMPANY.name}`, { x: left, y, size: 9, font: bold, color: ink });
  y -= 22;
  page.drawText('This is system generated document no signature required.', { x: left, y, size: 8.5, font, color: muted });

  // --- Footer ------------------------------------------------------
  const footerY = 56;
  page.drawLine({ start: { x: left, y: footerY + 26 }, end: { x: right, y: footerY + 26 }, thickness: 1, color: chrome });
  const contactLine = `E-Mail : ${COMPANY.footerEmail}   |   ${COMPANY.footerMob}`;
  page.drawText(contactLine, {
    x: (PAGE[0] - font.widthOfTextAtSize(contactLine, 8)) / 2,
    y: footerY + 12,
    size: 8,
    font,
    color: ink,
  });
  page.drawText(COMPANY.footerAddress, {
    x: (PAGE[0] - font.widthOfTextAtSize(COMPANY.footerAddress, 8)) / 2,
    y: footerY,
    size: 8,
    font,
    color: muted,
  });

  return toBlob(pdfDoc);
}

/** Triggers a browser download for a generated PDF blob. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
