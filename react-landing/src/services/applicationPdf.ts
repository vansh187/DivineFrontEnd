import { PDFDocument, PDFName, PDFObjectCopier, StandardFonts, rgb } from 'pdf-lib';
import type { PDFImage, PDFPage, PDFFont } from 'pdf-lib';
import { getApplicationProject } from '../data/applicationProjects';
import type { ApplicationProject, ApplicationProjectId } from '../data/applicationProjects';
import type { BookingApplicationFormData, PaymentStatus } from './documentStore';

interface GenerateApplicationPdfInput {
  formData: BookingApplicationFormData;
  applicantSignatureDataUrl: string;
  coApplicantSignatureDataUrl?: string | null;
  /** Passport-size photo shown on the "Sole / first applicant" page — a data URL
   * (preferred, already cached locally) or a signed storage URL fallback. */
  applicantPhotoSource?: string | null;
  /** Same as applicantPhotoSource, for the "Co-applicant details" page. */
  coApplicantPhotoSource?: string | null;
  /** Whether a co-applicant exists at all (the checkbox on the PAN card tile). When
   * false, the entire "Co-applicant details" page - and any leftover co-applicant
   * signature/photo/form data from before it was unchecked - is left out of the PDF. */
  hasCoApplicant: boolean;
  identityAttachments?: IdentityAttachment[];
  paymentInfo?: PaymentStatus | null;
}

export interface IdentityAttachment {
  title: string;
  fileName?: string | null;
  dataUrl?: string | null;
  signedUrl?: string | null;
}

interface PdfContext {
  pdfDoc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  applicantSignature: PDFImage;
  coApplicantSignature: PDFImage | null;
  applicantPhoto: PDFImage | null;
  coApplicantPhoto: PDFImage | null;
  pageNumber: number;
  project: ApplicationProject;
}

interface PageCursor {
  page: PDFPage;
  y: number;
  title: string;
}

const pageSize: [number, number] = [595.28, 841.89];
const marginX = 48;
const topY = 792;
const contentBottomY = 128;
const signatureTopY = 102;
const contentWidth = pageSize[0] - marginX * 2;
const labelColumnWidth = 150;
const navy = rgb(0.024, 0.122, 0.176);
// Matches the website footer's --color-chrome (#2c3e50) - the PDF's whole accent
// theme (header/footer bands, bullets, labels, alternating row tints) uses this
// rather than a separate green, so the document matches the site's chrome.
const divineGreen = rgb(44 / 255, 62 / 255, 80 / 255);
const paleGreen = rgb(0.94, 0.96, 0.98);
const tableTint = rgb(0.985, 0.988, 0.995);
const ink = rgb(0.05, 0.12, 0.16);
const muted = rgb(0.35, 0.45, 0.5);
const hairline = rgb(0.78, 0.84, 0.87);

const pricingNotes = [
  'Price of plot per sq. meter = Total Price Amount / Area of Plots in Sq. meter.',
  'Price of plot per sq. yard = Total Price Amount / Area in Sq. yard.',
  'Conversion of unit of Measurement: 1 Sq. meter = 1.1959 square yd.',
  'Breakup of the amount i.e. towards charges mentioned above, if any, is calculated on Plot area.',
  'EDC has been included in above price as per rates for EDC applicable on the date of grant of License No. 68 of 2024. Any upward/downward revision by the concerned Authority shall be payable/refundable as per the terms and conditions of the Agreement for Sale.',
  'The cost of Electricity Meter connection and actual electricity consumption is not included in the above price and the Applicant shall apply to the competent Authority to get the same at his/her own additional cost.',
  'The above mentioned Total Price includes cost of maintenance charges up to the period of 45 days from the date of offer of possession. Thereafter, the maintenance security deposit and maintenance charges shall be charged as per the terms and conditions of agreement for sale. The Stamp duty, sale/conveyance deed registration charges, retrospective revision in currently applicable and/or introduction of new taxes/cess/government charges shall be payable additionally as per the terms and conditions of Agreement for Sale.',
  "The standard Agreement for Sale format is available on Haryana RERA and Company's web site and the applicant is requested to read the same.",
];

const applicantDeclarationItems = [
  'All cheque/drafts are to be made in favor of "K C G Resorts Pvt Ltd", payable at par only.',
  'Persons signing the application form on behalf of another person, firm, or company shall file proper authorization / power of attorney.',
  'I/we declare that the particulars given by me/us are true and correct and nothing has been concealed.',
  'I/we shall be liable and responsible for cancellation of the booked Residential Plot by the Company if the enclosed document/information is found to be forged or faked.',
  'Any allotment against this application is subject to the terms and conditions attached to this application form and the Allotment Letter / Buyer Agreement.',
  'The terms and conditions shall be applicable to my/our legal heir(s), successor(s), and nominee(s).',
  'I/we undertake to inform the Company of any change in my/our address or any other particulars/information given above until the booked property is registered in my/our name(s).',
  'If I/we fail to update the Company, the particulars shall be deemed correct and letters sent at the recorded address shall be deemed received by me/us.',
  'Where the booking is through a dealer/broker, I/we shall be liable and responsible for any action/inaction of the dealer in respect of the Residential Plot and shall not hold the Company responsible for the same.',
];

const termsAndConditions = [
  'I/we have applied for allotment of Residential Plot in the project named "OPS Divine Greens" to be developed and constructed under lawful arrangement by M/s KCG Resorts Pvt Ltd, situated at Village Gangar and Shamgarh, Tehsil Nilokheri, Sec-16 Taraori, Karnal, Haryana.',
  'The Applicant has applied for provisional allotment of the Plot with full knowledge of all laws, notifications, and rules applicable to this location and this Project.',
  'The Applicant has satisfied himself/herself about the right, interest, and title of the Owners/Company in the land and has understood the arrangements, limitations, and obligations in respect thereof.',
  'The Company shall have the exclusive right to accept or reject this application in its sole discretion.',
  'The provisional allotment is subject to the terms and conditions of this application form; in case of breach, the booking shall not be confirmed and the Applicant shall not be entitled to allotment.',
  'If the application is accepted, the Applicant(s) shall sign, execute, and register the Agreement for Sale. Stamp duty, registration fee, and related expenses shall be borne by the Applicant(s).',
  'If the Applicant(s) fail to sign and register the Agreement for Sale within 60 days from signing this application, the provisional allotment may be cancelled and Earnest Money/part thereof may be forfeited as per applicable RERA rules.',
  'The Total Price includes applicable taxes, GST if applicable, cess, fees, charges, and levies paid/payable by the Company up to 45 days from the date of offer of possession.',
  'If possession is offered and not taken within 45 days, the Plot shall be deemed handed over for liabilities towards taxes, charges, levies, maintenance, and similar dues.',
  'The Project is being developed/marketed on project land under license and other requisite sanctions from the concerned authorities; land and license details are in the Agreement for Sale.',
  'All provisions and obligations in respect of the Plot shall apply to occupiers, substitutes, tenants, licensees, subsequent purchasers, and assignees.',
  'External/peripheral services, government/local authority charges, or charges under any other head shall be payable additionally on proportionate basis by the Applicant.',
  'The Applicant shall use common areas and facilities harmoniously with other occupants and maintenance staff, subject to timely payment of maintenance and electricity charges.',
  'Earnest Money is paid to ensure fulfillment of these terms, and the Applicant authorizes the Company to forfeit Earnest Money/part thereof as per applicable RERA rules in case of breach.',
  'Timely payment of installments as per the opted Payment Plan is the essence of this application and the Agreement for Sale.',
  'The Applicant must make regular payments as per the Payment Plan without depending on demand notices, except in a Development Linked payment plan.',
  'Delay in payment shall attract interest at the rate specified in the concerned State RERA Rules.',
  'If default continues beyond 60 days after notice, the Company may cancel the provisional allotment and refund amounts after applicable forfeiture and interest liabilities, with prior intimation as required.',
  'If any cheque is dishonored, the Applicant shall deposit the cheque amount with dishonor charges and interest within 15 days of intimation; failure may lead to legal action and cancellation.',
  'The Applicant authorizes the Company to adjust all payments first towards interest and lawful outstanding dues against the Plot and shall not object to such adjustment.',
  'The Company shall hand over possession as declared under RERA, unless delayed by Force Majeure, court/tribunal/authority orders, government policy/guidelines, or decisions affecting project development.',
  'If implementation becomes impossible for reasons other than Force Majeure and stated conditions, allotment shall stand terminated and the Company shall refund amounts as per RERA Rules.',
  'On receiving offer of possession, the Applicant shall remit all balance dues, complete required formalities, sign declarations/undertakings and maintenance/electricity agreements if applicable, and pay maintenance security deposit and common maintenance charges before possession and sale deed.',
  'Maintenance Security Deposit shall be payable at the rate of Rs 250/- per sq. yd.',
  'A title deed shall be executed and registered after receipt of total sale consideration, other dues/charges, stamp duty, GST/service tax, registration fee, cesses, documentation charges, incidental expenses, NOC, and required declarations/undertakings.',
  'The title of the Plot shall pass only after execution of the title deed; until then the Plot remains the property of the Company.',
  'If the Applicant fails to take possession within 45 days from offer of possession or extended date, the Company will not be responsible for deterioration and possession will be handed over on an as-is-where-is basis.',
  'Stamp duty, registration charges, and all other incidental/legal expenses for execution and registration of agreements, deeds, or documents shall be borne by the Applicant.',
  'After taking physical possession, the Applicant shall comply with building laws, layout plans, building plans, and applicable state, municipal, and local laws.',
  'At possession, the Applicant shall enter into a maintenance agreement with the Company/nominee/association/authority/maintenance agency and pay maintenance, electricity consumption, and related charges as demanded.',
  'The Applicant shall plan and distribute electrical load in conformity with the electrical systems and shall be responsible for loss or damage from breach.',
  'The Applicant shall take possession by executing necessary indemnities, undertakings, and other documentation prescribed in the application/Agreement for Sale.',
  'Physical possession shall be given by the Sales Manager on the basis of Possession Letter and valid NOC after all dues and formalities are complete.',
  'The Plot shall be used for residential purposes only. Commercial activity is not permitted, and the Applicant shall not alter the Plot area or shape or cause damage/nuisance.',
  'The Applicant/Plot Owner shall ensure installation of Solar Water Heating Plant as per government policy and indemnify the Company for any penalty caused by non-compliance.',
  'The Applicant shall not install, operate, or use any generator set in open area.',
  'The Applicant shall not sink, drill, install, or commission any well, bore well, or tube well within or outside the Plot area.',
  'The Applicant shall keep postal address, email address, and mobile number updated with the Company. Communications sent to the recorded address shall be deemed received.',
  'For joint Applicants, communication sent to the first Applicant at the provided postal/email address shall be considered served on all Applicants unless separate addresses are provided in writing.',
  'The Applicant may avail loan from financial institutions/banks, but the Company is not responsible if finance is refused, delayed, or not disbursed.',
  'The Applicant agrees not to hold the Company liable for any refusal of loan/financial assistance by any bank or financial institution.',
  'Where a long-term payment plan with a financial institution/bank is opted, the sale deed shall be executed as per such institution/bank arrangements.',
  'The Applicant shall sign all papers/documents and do all acts necessary for safeguarding the interest of the Company and other applicants in the Project.',
  'The Applicant covenants to pay all amounts due and observe all conditions, and shall indemnify the Company against losses due to non-payment or non-performance.',
  'For non-resident/foreign national Applicants or payments in foreign currency, compliance with FEMA, RBI rules, and applicable laws is solely the Applicant responsibility.',
  'Any refund or transfer of security for such Applicant shall be made according to FEMA, RBI rules, and applicable law; the Company accepts no responsibility for Applicant non-compliance.',
  'The Company is not responsible for third-party payments/remittances made on behalf of Applicant(s), and receipts shall be issued in favor of Applicant(s) only.',
  'The Applicant agrees that the Company may join as an affected party in any suit/complaint where Company rights may be affected.',
  'The Applicant authorizes the Company to communicate by email and SMS for notices, reminders, and project information.',
  'If any phrase, sentence, clause, or paragraph is declared invalid by final order, the remaining terms shall remain valid and binding.',
  'Any delay, indulgence, forbearance, or time given by the Company shall not be treated as waiver of breach or non-compliance.',
  'This application becomes complete and binding only when signed by the Company through its Authorized Signatory at the Registered Office in Karnal after receiving copies duly signed by Applicant(s).',
  'For all intents and purposes, singular shall include plural.',
  'This application shall be construed, interpreted, governed, and applied according to the laws, rules, and regulations of India.',
  'I/we have fully read and understood the terms and conditions and agree to abide by them, including the terms of the Agreement for Sale.',
  'I/we understand the Company is not required to send reminders/notices for my/our obligations and I/we shall be liable for consequences of default.',
  'I/we confirm that explanations and clarifications have been sought and provided, and I/we sign this application fully conscious of liabilities, obligations, and possible forfeiture of Earnest Money or booking amount.',
  'In case of cancellation, forfeiture, refund, or any other termination, I/we shall have no right, title, interest, or lien on the Plot applied for or provisionally/finally allotted.',
];

const paymentPlanRows: Array<[string, string]> = [
  ['On Booking', '10% of BSP'],
  ['On Issuance of Allotment Letter/BBA', '20% of BSP'],
  ['On Start of Drainage Work', '25% of BSP + PLC'],
  ['On Start of Underground Cabling Work', '25% of BSP'],
  ['On Application of CC', '15% of BSP + IFMS'],
  ['On offer of Possession', '5% of BSP'],
];

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, payload] = dataUrl.split(',');
  const binary = window.atob(payload ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function yesNo(value: boolean): string {
  return value ? 'Accepted' : 'Not accepted';
}

function formatCurrencyINR(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `Rs. ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDateTimeIN(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN');
}

function formatPaymentMethod(value: PaymentStatus['method']): string {
  if (value === 'razorpay') return 'Online payment - Razorpay';
  if (value === 'cash') return 'Cash payment';
  return '-';
}

function valueOrDash(value: string | null | undefined): string {
  return value?.trim() ? value : '-';
}

function requireProjectId(projectId: BookingApplicationFormData['projectId']): ApplicationProjectId {
  if (!projectId) throw new Error('Select the project before generating the application PDF.');
  return projectId;
}

function joinValues(values: string[]): string {
  const filled = values.filter((value) => value.trim());
  return filled.length ? filled.join(' / ') : '-';
}

function splitLongWord(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const character of word) {
    const next = `${current}${character}`;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapTextToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const source = valueOrDash(text);
  const words = source.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const wordParts = font.widthOfTextAtSize(word, size) > maxWidth ? splitLongWord(font, word, size, maxWidth) : [word];
    for (const part of wordParts) {
      const next = current ? `${current} ${part}` : part;
      if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(current);
        current = part;
      } else {
        current = next;
      }
    }
  }

  if (current) lines.push(current);
  return lines;
}

function drawTextRight(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = ink) {
  page.drawText(text, { x: xRight - font.widthOfTextAtSize(text, size), y, size, font, color });
}

async function embedSignature(pdfDoc: PDFDocument, dataUrl: string) {
  const bytes = dataUrlToBytes(dataUrl);
  if (dataUrl.startsWith('data:image/png')) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

async function bytesFromUrl(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load booking form template.');
  return new Uint8Array(await response.arrayBuffer());
}

async function embedImageFromSource(pdfDoc: PDFDocument, source: string): Promise<PDFImage> {
  const bytes = source.startsWith('data:') ? dataUrlToBytes(source) : await bytesFromUrl(source);
  if (source.startsWith('data:image/png') || source.toLowerCase().includes('.png')) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

function drawTemplateImage(page: PDFPage, image: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: x + (maxWidth - width) / 2, y: y + (maxHeight - height) / 2, width, height, opacity: 0.94 });
}

async function appendIdentityAttachmentPages(ctx: PdfContext, attachments: IdentityAttachment[] = []) {
  const available = attachments.filter((attachment) => attachment.dataUrl || attachment.signedUrl);
  if (!available.length) return;

  for (const attachment of available) {
    const source = attachment.dataUrl || attachment.signedUrl;
    if (!source) continue;
    const page = ctx.pdfDoc.addPage(pageSize);
    ctx.pageNumber += 1;
    drawPageHeader(ctx, page, 'Attached Identity Document', attachment.title);
    if (attachment.fileName) page.drawText(attachment.fileName, { x: marginX, y: topY - 58, size: 8, font: ctx.font, color: muted });
    page.drawRectangle({ x: marginX, y: 128, width: contentWidth, height: 560, borderColor: hairline, borderWidth: 1 });
    try {
      const image = await embedImageFromSource(ctx.pdfDoc, source);
      drawTemplateImage(page, image, marginX + 18, 148, contentWidth - 36, 520);
    } catch {
      page.drawText('Could not embed this uploaded image. Please re-upload the document and generate again.', {
        x: marginX + 18,
        y: 430,
        size: 9,
        font: ctx.bold,
        color: muted,
      });
    }
    drawFooterSignatures(ctx, page);
  }
}

async function appendTemplateCoverPage(ctx: PdfContext) {
  const templateBytes = await bytesFromUrl(ctx.project.templateUrl);
  const templateDoc = await PDFDocument.load(templateBytes);
  const [coverPage] = await ctx.pdfDoc.copyPages(templateDoc, [0]);
  ctx.pdfDoc.addPage(coverPage);
  ctx.pageNumber += 1;

  // pdf-lib's copyPages does not carry over the source document's
  // /OCProperties catalog entry, so optional-content layers used on the
  // template's cover page (e.g. its background/branding art) lose their
  // visibility config and render blank in viewers. Copy it over manually.
  const ocPropertiesRef = templateDoc.catalog.get(PDFName.of('OCProperties'));
  if (ocPropertiesRef) {
    const copier = PDFObjectCopier.for(templateDoc.context, ctx.pdfDoc.context);
    ctx.pdfDoc.catalog.set(PDFName.of('OCProperties'), copier.copy(ocPropertiesRef));
  }
}

function drawFooterSignatures(ctx: PdfContext, page: PDFPage) {
  const { width } = page.getSize();
  const sigWidth = 108;
  const sigHeight = sigWidth / 3.25;
  page.drawRectangle({ x: 0, y: 0, width, height: 22, color: divineGreen });
  page.drawLine({ start: { x: marginX, y: signatureTopY }, end: { x: width - marginX, y: signatureTopY }, thickness: 0.8, color: hairline });
  page.drawImage(ctx.applicantSignature, { x: width - sigWidth - marginX, y: 52, width: sigWidth, height: sigHeight, opacity: 0.92 });
  page.drawText('Applicant Signature', { x: width - sigWidth - marginX, y: 38, size: 7.5, font: ctx.bold, color: ink });
  if (ctx.coApplicantSignature) {
    page.drawImage(ctx.coApplicantSignature, { x: marginX, y: 52, width: sigWidth, height: sigHeight, opacity: 0.92 });
    page.drawText('Co-applicant Signature', { x: marginX, y: 38, size: 7.5, font: ctx.bold, color: ink });
  }
  page.drawText(`Page ${ctx.pageNumber}`, { x: width / 2 - 18, y: 7, size: 7.5, font: ctx.font, color: rgb(1, 1, 1) });
}

function drawPageHeader(ctx: PdfContext, page: PDFPage, title: string, subtitle?: string) {
  const { width } = page.getSize();
  page.drawRectangle({ x: 0, y: topY + 14, width, height: 36, color: divineGreen });
  page.drawText(ctx.project.label.toUpperCase(), { x: marginX, y: topY + 29, size: 12, font: ctx.bold, color: rgb(1, 1, 1) });
  drawTextRight(page, ctx.project.company, width - marginX, topY + 30, 7.5, ctx.font, rgb(1, 1, 1));
  page.drawText(title.toUpperCase(), { x: marginX, y: topY - 9, size: 15.5, font: ctx.bold, color: divineGreen });
  if (subtitle) {
    const subtitleLines = wrapTextToWidth(ctx.font, subtitle, 8.5, contentWidth).slice(0, 2);
    subtitleLines.forEach((line, index) => {
      page.drawText(line, { x: marginX, y: topY - 28 - index * 10, size: 8.5, font: ctx.font, color: muted });
    });
  }
  page.drawLine({ start: { x: marginX, y: topY - 45 }, end: { x: width - marginX, y: topY - 45 }, thickness: 1, color: hairline });
}

function addPage(ctx: PdfContext, title: string, subtitle?: string, options?: { signatures?: boolean }): PageCursor {
  ctx.pageNumber += 1;
  const page = ctx.pdfDoc.addPage(pageSize);
  drawPageHeader(ctx, page, title, subtitle);
  if (options?.signatures !== false) drawFooterSignatures(ctx, page);
  return { page, y: topY - 74, title };
}

function ensureSpace(ctx: PdfContext, cursor: PageCursor, needed: number): PageCursor {
  if (cursor.y - needed >= contentBottomY) return cursor;
  return addPage(ctx, `${cursor.title} (continued)`);
}

function drawParagraph(
  ctx: PdfContext,
  cursor: PageCursor,
  text: string,
  options?: { bullet?: string; maxChars?: number; size?: number; lineHeight?: number; bottomGap?: number },
): PageCursor {
  const size = options?.size ?? 9.4;
  const lineHeight = options?.lineHeight ?? size + 4;
  const bulletWidth = options?.bullet ? 30 : 0;
  const textWidth = contentWidth - bulletWidth;
  const lines = wrapTextToWidth(ctx.font, text, size, textWidth);
  const height = lines.length * lineHeight + (options?.bottomGap ?? 8);
  let next = ensureSpace(ctx, cursor, height);
  const textX = marginX + bulletWidth;
  if (options?.bullet) next.page.drawText(options.bullet, { x: marginX, y: next.y, size, font: ctx.bold, color: divineGreen });
  lines.forEach((line, index) => {
    next.page.drawText(line, { x: textX, y: next.y - index * lineHeight, size, font: ctx.font, color: ink });
  });
  next.y -= height;
  return next;
}

function drawRows(ctx: PdfContext, cursor: PageCursor, rows: Array<[string, string]>): PageCursor {
  let next = cursor;
  rows.forEach(([label, value], index) => {
    const valueSize = 9.5;
    const lineHeight = 12.5;
    const valueX = marginX + labelColumnWidth + 16;
    const valueWidth = contentWidth - labelColumnWidth - 28;
    const lines = wrapTextToWidth(ctx.font, value, valueSize, valueWidth);
    const height = Math.max(34, lines.length * lineHeight + 18);
    next = ensureSpace(ctx, next, height);
    next.page.drawRectangle({
      x: marginX,
      y: next.y - height + 7,
      width: contentWidth,
      height: height - 3,
      color: index % 2 === 0 ? tableTint : paleGreen,
      borderColor: hairline,
      borderWidth: 0.6,
    });
    next.page.drawLine({
      start: { x: marginX + labelColumnWidth, y: next.y - height + 7 },
      end: { x: marginX + labelColumnWidth, y: next.y + 4 },
      thickness: 0.5,
      color: hairline,
    });
    wrapTextToWidth(ctx.bold, label.toUpperCase(), 7.2, labelColumnWidth - 18).slice(0, 2).forEach((line, lineIndex) => {
      next.page.drawText(line, { x: marginX + 10, y: next.y - 7 - lineIndex * 9, size: 7.2, font: ctx.bold, color: divineGreen });
    });
    lines.forEach((line, index) => {
      next.page.drawText(line, { x: valueX, y: next.y - 8 - index * lineHeight, size: valueSize, font: ctx.font, color: ink });
    });
    next.y -= height;
  });
  return next;
}

function drawSectionLabel(ctx: PdfContext, cursor: PageCursor, label: string, options?: { yOffset?: number }): PageCursor {
  const next = ensureSpace(ctx, cursor, 26);
  next.page.drawText(label.toUpperCase(), { x: marginX, y: next.y + (options?.yOffset ?? 0), size: 10, font: ctx.bold, color: navy });
  next.y -= 20;
  return next;
}

function drawAccepted(ctx: PdfContext, cursor: PageCursor, label: string, accepted: boolean): PageCursor {
  return drawRows(ctx, cursor, [[label, yesNo(accepted)]]);
}

function renderProjectPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  const project = getApplicationProject(requireProjectId(formData.projectId));
  let cursor = addPage(ctx, 'Page 1 - Project', undefined, { signatures: false });
  cursor = drawRows(ctx, cursor, [
    ['Application form project', `${project.label} - ${project.location}`],
    ['Developer entity', project.company],
    ['Generated on', new Date().toLocaleString('en-IN')],
  ]);
}

function renderFillApplicationPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  const project = getApplicationProject(requireProjectId(formData.projectId));
  let cursor = addPage(ctx, 'Page 2 - Fill application form');
  cursor = drawParagraph(ctx, cursor, 'Dear Sir,');
  cursor = drawParagraph(
    ctx,
    cursor,
    `I/we have examined the tentative plan of Residential Township Project named as ${project.label} and understand that this application is for booking consideration subject to the terms, approvals, payment plan, allotment letter, buyer agreement, government levies, maintenance deposits, stamp duty, registration charges and other applicable charges.`,
  );
  cursor = drawParagraph(
    ctx,
    cursor,
    'I/we understand this application does not constitute an agreement to sell and does not by itself create entitlement to provisional or final allotment. If I/we cancel this application or fail to sign/execute the required documents within the prescribed period, the company may treat the application as cancelled and the booking/earnest money may be forfeited as per the application terms.',
  );
  cursor = drawParagraph(
    ctx,
    cursor,
    'I/we agree to pay installments and additional charges as per the payment plan opted by me/us and understand that failure to pay may result in cancellation and forfeiture as per the project application terms.',
  );
  cursor = drawRows(ctx, cursor, [
    ['Booking amount remitted', formData.bookingAmount],
    ['Amount in words', formData.bookingAmountWords],
    ['Bank draft / cheque / reference no.', formData.chequeNo],
    ['Dated', formData.chequeDate],
    ['Drawn on bank', formData.bankName],
    ['Payment mode', formData.paymentMode],
  ]);
}

const PHOTO_BOX_WIDTH = 92;
const PHOTO_BOX_HEIGHT = 112;

/** Draws a passport-photo box in the top-right of the current cursor position and
 * returns a cursor moved below it, so the rows that follow never overlap it. */
function drawPhotoBox(cursor: PageCursor, ctx: PdfContext, photo: PDFImage | null, label: string): PageCursor {
  const x = marginX + contentWidth - PHOTO_BOX_WIDTH;
  const y = cursor.y - PHOTO_BOX_HEIGHT;
  cursor.page.drawRectangle({ x, y, width: PHOTO_BOX_WIDTH, height: PHOTO_BOX_HEIGHT, borderColor: hairline, borderWidth: 1, color: tableTint });
  if (photo) {
    drawTemplateImage(cursor.page, photo, x + 4, y + 4, PHOTO_BOX_WIDTH - 8, PHOTO_BOX_HEIGHT - 8);
  } else {
    cursor.page.drawText('No photo', { x: x + 10, y: y + PHOTO_BOX_HEIGHT / 2, size: 8, font: ctx.font, color: muted });
  }
  cursor.page.drawText(label.toUpperCase(), { x, y: y - 11, size: 7, font: ctx.bold, color: divineGreen });
  return { ...cursor, y: y - 18 };
}

function renderApplicantPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 3 - Sole / first applicant');
  cursor = drawPhotoBox(cursor, ctx, ctx.applicantPhoto, 'Applicant photo');
  cursor = drawRows(ctx, cursor, [
    ['Customer name', formData.applicantName],
    ['S/o, W/o, D/o, C/o', formData.guardianName],
    ['DOB / DOI', formData.dob],
    ['Gender', formData.gender],
    ['PAN', formData.pan],
    ['Aadhaar no.', formData.aadhaar],
    ['Email ID', formData.email],
    ['Mobile no.', formData.mobile],
    ['Residence phone', formData.phone],
    ['Residential status', formData.residentialStatus],
    ['Permanent address', formData.permanentAddress],
    ['Correspondence address', formData.correspondenceAddress],
  ]);
}

function renderCoApplicantPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 4 - Co-applicant details');
  cursor = drawPhotoBox(cursor, ctx, ctx.coApplicantPhoto, 'Co-applicant photo');
  cursor = drawRows(ctx, cursor, [
    ['Customer name', formData.coApplicantName],
    ['S/o, W/o, D/o, C/o', formData.coApplicantGuardianName],
    ['DOB / DOI', formData.coApplicantDob],
    ['Gender', formData.coApplicantGender],
    ['PAN', formData.coApplicantPan],
    ['Aadhaar no.', formData.coApplicantAadhaar],
    ['Phone no. residence', formData.coApplicantPhone],
    ['Mobile no.', formData.coApplicantMobile],
    ['Email ID', formData.coApplicantEmail],
    ['Residential status', formData.coApplicantResidentialStatus],
    ['Permanent address', formData.coApplicantPermanentAddress],
    ['Correspondence address', formData.coApplicantCorrespondenceAddress],
  ]);
}

function renderPlotPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 5 - Details of residential plot');
  cursor = drawRows(ctx, cursor, [
    ['Unit no.', formData.unitNo],
    ['In sq yd.', formData.plotAreaSqYd],
    ['In sq mtr.', formData.plotAreaSqMtr],
    ['Unit type', formData.unitType],
  ]);
}

function renderPricingPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 6 - Details of pricing', 'Amount in Rs.');
  cursor = drawRows(ctx, cursor, [
    ['A. Basic Sale Price - rate per sq yard', formData.ratePerSqYd],
    ['A. Basic Sale Price - price', formData.basicSalePrice],
    ['B. PLC Applicable - rate per sq yard', formData.plcRatePerSqYd],
    ['B. PLC Applicable - price', formData.plcPrice],
    ['Total Amount A+B', formData.totalAmount],
    ['Amount in figure', formData.amountInFigure],
    ['Amount in words', formData.totalAmountWords],
    ['Plan type', 'Construction Linked Plan'],
    ['Mode of booking', formData.bookingMode],
    ['Employee name', formData.employeeName],
    ['Employee code', formData.employeeCode],
  ]);
}

function renderPricingNotesPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 7 - Pricing notes');
  pricingNotes.forEach((note) => {
    cursor = drawParagraph(ctx, cursor, note, { bullet: '-' });
  });
  cursor = drawAccepted(ctx, cursor, 'Pricing notes accepted', formData.pricingNotesAccepted);
}

function renderChannelPartnerPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 8 - Channel partner declaration');
  cursor = drawRows(ctx, cursor, [
    ['CP name', formData.channelPartnerName],
    ['CP code', formData.channelPartnerCode],
    ['CP address', formData.channelPartnerAddress],
    ['CP contact no.', formData.channelPartnerMobile],
    ['Authorized signatory', formData.channelPartnerAuthorizedSignatory],
    ['Dealer / firm name', formData.channelPartnerFirmName],
  ]);
  cursor = drawParagraph(
    ctx,
    cursor,
    'I, the authorized signatory of the dealer/channel partner, do hereby declare that all particulars filled by the Applicant(s) herein and documents/ID proof supplied by the Applicant(s) are personally verified by me and found to be genuine. The signatures of the Applicant(s) appended herein are subscribed in my presence.',
  );
  cursor = drawParagraph(
    ctx,
    cursor,
    'I shall be liable and responsible if the enclosed document/information is found to be forged or faked and results in cancellation of the booked Residential Plot by the Company. I shall provide NOC in case of surrender, transfer, or assignment of allotment right by the Applicant(s).',
  );
  cursor = drawAccepted(ctx, cursor, 'Channel partner declaration accepted', formData.channelPartnerDeclarationAccepted);
}

function renderApplicantDeclarationPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 9 - Applicant declaration');
  cursor = drawRows(ctx, cursor, [
    ['Application date', formData.applicationDate],
    ['Place', formData.place],
  ]);
  applicantDeclarationItems.forEach((item) => {
    cursor = drawParagraph(ctx, cursor, item, { bullet: '-' });
  });
  cursor = drawAccepted(ctx, cursor, 'Applicant declaration accepted', formData.applicantDeclarationAccepted);
}

function renderTermsPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 10 - Terms and conditions');
  termsAndConditions.forEach((term, index) => {
    cursor = drawParagraph(ctx, cursor, term, { bullet: `${index + 1}.`, maxChars: 82, size: 8.2 });
  });
  cursor = drawAccepted(ctx, cursor, 'Terms and conditions accepted', formData.termsAccepted);
}

function renderPaymentPlanPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 11 - Construction linked payment plan');
  cursor = drawParagraph(
    ctx,
    cursor,
    'Cost of stamp duty, registration, documentation charges, government taxes, and other applicable charges are payable by the intending allottee(s) as per actuals.',
  );
  cursor = drawParagraph(ctx, cursor, 'The booking is applicable as per the Allotment Letter and is to be signed separately, and it overrides all conditions mentioned herewith.');
  cursor = drawParagraph(ctx, cursor, 'In case of non-payment or delay in payment of installments, the developer reserves the right to cancel the allotment or regularize the unit with interest from the due dates.');
  cursor = drawParagraph(ctx, cursor, 'The time period mentioned above regarding the payment will remain same for the new transferee as well.');
  cursor = drawSectionLabel(ctx, cursor, 'Construction linked plan');
  cursor = drawRows(ctx, cursor, paymentPlanRows);
  cursor = drawAccepted(ctx, cursor, 'Payment plan accepted', formData.paymentPlanAccepted);
}

function renderForm60Page(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 12 - Annexure - Form No. 60');
  cursor = drawParagraph(
    ctx,
    cursor,
    'Form of Declaration to be filled by a person who does not have either a Permanent Account Number or General Index Register Number and who makes payment in cash in respect of transaction specified in clauses (a) to (h) of rule 114B.',
  );
  cursor = drawRows(ctx, cursor, [
    ['1. Full name and address of declarant', formData.form60FullNameAddress],
    ['2. Particulars of transaction', formData.form60TransactionParticulars],
    ['3. Amount of transaction', formData.form60TransactionAmount],
    ['4. Are you assessed to tax?', formData.form60AssessedToTax],
    ['5(i). Ward / circle / range', formData.form60WardCircleRange],
    ['5(ii). Reason for not having PAN / GIR', formData.form60NoPanReason],
    ['6. Address proof document produced', formData.form60AddressProofDocument],
  ]);
  cursor = drawSectionLabel(ctx, cursor, 'Verification');
  cursor = drawParagraph(ctx, cursor, `I, ${valueOrDash(formData.form60VerificationName)}, do hereby declare that what is stated above is true to the best of my knowledge and belief.`);
  cursor = drawRows(ctx, cursor, [
    ['Verified today, the day of', joinValues([formData.form60VerificationDay, formData.form60VerificationDate])],
    ['Date', formData.form60VerificationDate],
    ['Place', formData.form60VerificationPlace],
    ['Form 60 accepted', yesNo(formData.form60Accepted)],
  ]);
  cursor = drawSectionLabel(ctx, cursor, 'Address proof instructions', { yOffset: -4 });
  ['Passport', 'Driving License', 'Identity Card issued by any Institution', 'Electricity/telephone bill showing residential address', 'Document or communication issued by Central/State Government or local bodies showing residential address', 'Any other documentary evidence in support of the address given in the declaration'].forEach((item) => {
    cursor = drawParagraph(ctx, cursor, item, { bullet: '-', size: 8, lineHeight: 10.4, bottomGap: 2 });
  });
}

function renderChecklistPage(ctx: PdfContext, formData: BookingApplicationFormData) {
  let cursor = addPage(ctx, 'Page 13 - Checklist confirmation');
  const checklist = [
    'Application Form is completely filled with photographs and duly signed by the Applicant(s).',
    'Specimen signatures have been made by the Applicant(s).',
    'Cheque for booking amount is in proper name and duly signed and dated.',
    'Self-attested copies of PAN card of all applicants are attached with the form.',
    'Self-attested copy of Passport for all foreign Nationals of Indian Origin is attached with the form.',
    'Self-attested copy of Address Proof and other relevant documents are attached with the form.',
  ];
  checklist.forEach((item) => {
    cursor = drawParagraph(ctx, cursor, item, { bullet: '[ ]' });
  });
  cursor = drawAccepted(ctx, cursor, 'Checklist confirmed', formData.checklistAccepted);
}

function renderPaymentInformationPage(ctx: PdfContext, paymentInfo: PaymentStatus | null | undefined) {
  let cursor = addPage(ctx, 'Payment confirmation', 'Booking payment details recorded before identity document attachments.');
  cursor = drawRows(ctx, cursor, [
    ['Payment status', paymentInfo?.status === 'paid' ? 'Paid' : valueOrDash(paymentInfo?.status)],
    ['Amount paid', formatCurrencyINR(paymentInfo?.amount)],
    ['Payment method', formatPaymentMethod(paymentInfo?.method ?? null)],
    ['Paid on', formatDateTimeIN(paymentInfo?.paidAt)],
    ['Payment reference ID', valueOrDash(paymentInfo?.paymentId)],
    ['Razorpay order ID', valueOrDash(paymentInfo?.razorpayOrderId)],
    ['Razorpay payment ID', valueOrDash(paymentInfo?.razorpayPaymentId)],
  ]);
  cursor = drawParagraph(
    ctx,
    cursor,
    'This payment information is displayed before the Aadhaar and PAN attachments as confirmation that the booking payment was completed before document submission.',
  );
}

async function renderReadableApplicationPacket(
  ctx: PdfContext,
  formData: BookingApplicationFormData,
  identityAttachments: IdentityAttachment[],
  hasCoApplicant: boolean,
  paymentInfo?: PaymentStatus | null,
) {
  // Every project has its own branded cover page template (see applicationProjects.ts's
  // templateUrl) - fall back to the plain generated project page only if that template
  // can't actually be loaded/copied in, not based on which project this happens to be.
  try {
    await appendTemplateCoverPage(ctx);
  } catch {
    renderProjectPage(ctx, formData);
  }

  renderFillApplicationPage(ctx, formData);
  renderApplicantPage(ctx, formData);
  if (hasCoApplicant) renderCoApplicantPage(ctx, formData);
  renderPlotPage(ctx, formData);
  renderPricingPage(ctx, formData);
  renderPricingNotesPage(ctx, formData);
  renderChannelPartnerPage(ctx, formData);
  renderApplicantDeclarationPage(ctx, formData);
  renderTermsPage(ctx, formData);
  renderPaymentPlanPage(ctx, formData);
  renderForm60Page(ctx, formData);
  renderChecklistPage(ctx, formData);
  renderPaymentInformationPage(ctx, paymentInfo);
  await appendIdentityAttachmentPages(ctx, identityAttachments);
}

async function embedPhotoOrNull(pdfDoc: PDFDocument, source: string | null | undefined): Promise<PDFImage | null> {
  if (!source) return null;
  try {
    return await embedImageFromSource(pdfDoc, source);
  } catch {
    // A corrupt/unreadable photo shouldn't fail the whole document - the photo box
    // just falls back to its "No photo" placeholder.
    return null;
  }
}

export async function generateApplicationPdf({
  formData,
  applicantSignatureDataUrl,
  coApplicantSignatureDataUrl,
  applicantPhotoSource,
  coApplicantPhotoSource,
  hasCoApplicant,
  identityAttachments = [],
  paymentInfo = null,
}: GenerateApplicationPdfInput): Promise<Blob> {
  if (!formData.projectId) {
    throw new Error('Select the project before generating the application PDF.');
  }
  const project = getApplicationProject(requireProjectId(formData.projectId));
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const applicantSignature = await embedSignature(pdfDoc, applicantSignatureDataUrl);
  // Gated on hasCoApplicant, not just whether a value happens to be cached - unchecking
  // "there is a co-applicant" after already uploading their signature/photo must not
  // leave that leftover data appearing anywhere in the generated PDF.
  const coApplicantSignature = hasCoApplicant && coApplicantSignatureDataUrl ? await embedSignature(pdfDoc, coApplicantSignatureDataUrl) : null;
  const applicantPhoto = await embedPhotoOrNull(pdfDoc, applicantPhotoSource);
  const coApplicantPhoto = hasCoApplicant ? await embedPhotoOrNull(pdfDoc, coApplicantPhotoSource) : null;
  const ctx: PdfContext = {
    pdfDoc,
    font,
    bold,
    applicantSignature,
    coApplicantSignature,
    applicantPhoto,
    coApplicantPhoto,
    pageNumber: 0,
    project,
  };

  await renderReadableApplicationPacket(ctx, formData, identityAttachments, hasCoApplicant, paymentInfo);

  const bytes = await pdfDoc.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read generated PDF.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload] = dataUrl.split(',');
  if (!meta || !payload) throw new Error('Could not open generated PDF.');
  const contentType = meta.match(/^data:([^;]+);base64$/)?.[1] ?? 'application/octet-stream';
  const binary = window.atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

export function openPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openDataUrl(dataUrl: string) {
  openPdfBlob(dataUrlToBlob(dataUrl));
}
