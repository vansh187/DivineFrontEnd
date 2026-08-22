import { useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import * as store from '../services/documentStore';
import type { BookingApplicationFormData, CustomerDocState, SignatureStatus } from '../services/documentStore';
import { applicationProjects } from '../data/applicationProjects';
import { uploadGeneratedApplicationPdf } from '../services/documentsApi';
import { ApiError } from '../services/authApi';
import { blobToDataUrl, generateApplicationPdf, openDataUrl, openPdfBlob } from '../services/applicationPdf';
import { createPaymentOrder, recordCashPayment, verifyPayment } from '../services/paymentsApi';
import { openRazorpayCheckout } from '../services/razorpayCheckout';
import { amountToIndianWords } from '../utils/currency';
import { formatAadhaarDob, mapAadhaarGender } from '../utils/aadhaar';

function parseAmount(value: string): number {
  const cleaned = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(cleaned) ? cleaned : 0;
}

type FieldName = keyof BookingApplicationFormData;

function serializeFormData(formData: BookingApplicationFormData): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(formData).map(([key, value]) => [key, typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value]),
  );
}

function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: 'application/pdf' });
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const className = 'mt-1 rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green';
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className={`${className} w-full resize-none`} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} w-full`} />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-hairline bg-surface p-5 shadow-[0_18px_44px_-32px_rgba(6,31,45,0.28)]">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function UndertakingCopy({ projectName }: { projectName: string }) {
  return (
    <div className="sm:col-span-2 rounded-lg border border-hairline bg-bg p-4 text-xs leading-relaxed text-ink-muted">
      <p className="font-semibold text-ink">Dear Sir,</p>
      <p className="mt-3">
        I/we have examined the tentative plan of Residential Township Project named as{' '}
        <span className="font-semibold text-ink">{projectName || 'the selected project'}</span> and understand that this application is for
        booking consideration subject to the terms, approvals, payment plan, allotment letter, buyer agreement, government levies,
        maintenance deposits, stamp duty, registration charges and other applicable charges.
      </p>
      <p className="mt-3">
        I/we understand this application does not constitute an agreement to sell and does not by itself create entitlement to provisional
        or final allotment. If I/we cancel this application or fail to sign/execute the required documents within the prescribed period,
        the company may treat the application as cancelled and the booking/earnest money may be forfeited as per the application terms.
      </p>
      <p className="mt-3">
        I/we agree to pay installments and additional charges as per the payment plan opted by me/us and understand that failure to pay
        may result in cancellation and forfeiture as per the project application terms.
      </p>
    </div>
  );
}

function SignatureUpload({
  label,
  status,
  onUpload,
}: {
  label: string;
  status: SignatureStatus;
  onUpload: (file: File) => void;
}) {
  return (
    <label className="block sm:col-span-2">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
          event.target.value = '';
        }}
        className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none file:mr-3 file:rounded-full file:border-0 file:bg-green file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
      />
      {status.fileName && <span className="mt-2 block text-xs font-semibold text-green">Uploaded: {status.fileName}</span>}
      {status.error && <span className="mt-2 block text-xs text-red-700">{status.error}</span>}
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-hairline bg-bg p-3 text-sm font-semibold text-ink sm:col-span-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-hairline accent-[var(--color-green)]"
      />
      <span>{label}</span>
    </label>
  );
}

function LegalNote({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2 rounded-lg border border-hairline bg-bg p-4 text-sm leading-relaxed text-ink-muted">{children}</div>;
}

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

export function CustomerApplicationPage() {
  const { session, logout, openModal } = useAuth();
  const email = session?.email ?? '';
  const [docs, setDocs] = useState<CustomerDocState>(() => store.loadCustomerDocs(email));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageDirection, setPageDirection] = useState<'forward' | 'back'>('forward');
  const [amountInput, setAmountInput] = useState(() => (docs.payment.amount ? String(docs.payment.amount) : ''));
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [paying, setPaying] = useState(false);
  const [payingCash, setPayingCash] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (!session) return <Navigate to="/" replace />;

  const persist = (next: CustomerDocState) => {
    setDocs(next);
    store.saveCustomerDocs(email, next);
  };

  const updateForm = <T extends FieldName>(field: T, value: BookingApplicationFormData[T]) => {
    persist({
      ...docs,
      bookingApplication: {
        ...docs.bookingApplication,
        formData: { ...docs.bookingApplication.formData, [field]: value },
        error: null,
      },
    });
  };

  const applyFormUpdates = (updates: Partial<BookingApplicationFormData>) => {
    persist({
      ...docs,
      bookingApplication: {
        ...docs.bookingApplication,
        formData: { ...docs.bookingApplication.formData, ...updates },
        error: null,
      },
    });
  };

  // Aadhaar QR verification (Documents page) already extracts name/DOB/gender/guardian/
  // address - autofill from that cached result instead of asking the customer to retype
  // it here. Only overwrites a field when the QR actually had a value for it.
  const handleAutofillFromAadhaar = () => {
    const a = docs.aadhar;
    if (!a.name && !a.dob && !a.maskedAadhaar) {
      setError('Verify the Aadhaar QR on the Documents page first, then come back and autofill.');
      return;
    }
    const updates: Partial<BookingApplicationFormData> = {};
    if (a.name) updates.applicantName = a.name;
    if (a.careOf) updates.guardianName = a.careOf;
    if (a.dob) updates.dob = formatAadhaarDob(a.dob);
    if (a.gender) updates.gender = mapAadhaarGender(a.gender);
    if (a.maskedAadhaar) updates.aadhaar = a.maskedAadhaar;
    if (a.address) updates.permanentAddress = a.address;
    applyFormUpdates(updates);
    setError(null);
  };

  // Only the two Price cells (Basic Sale Price and PLC) are ever typed in - the total,
  // amount-in-figure, and amount-in-words all derive from their sum so they can never
  // drift out of sync with what was actually entered.
  const updatePrice = (field: 'basicSalePrice' | 'plcPrice', value: string) => {
    const nextForm = { ...docs.bookingApplication.formData, [field]: value };
    const total = parseAmount(nextForm.basicSalePrice) + parseAmount(nextForm.plcPrice);
    nextForm.totalAmount = total ? String(total) : '';
    nextForm.amountInFigure = total ? String(total) : '';
    nextForm.totalAmountWords = total ? amountToIndianWords(total) : '';
    persist({
      ...docs,
      bookingApplication: { ...docs.bookingApplication, formData: nextForm, error: null },
    });
  };

  const handleSignatureUpload = async (kind: 'applicant' | 'coApplicant', file: File) => {
    const key = kind === 'applicant' ? 'applicantSignature' : 'coApplicantSignature';
    try {
      const dataUrl = await blobToDataUrl(file);
      persist({
        ...docs,
        [key]: {
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl,
          error: null,
        },
      });
    } catch (err) {
      persist({
        ...docs,
        [key]: {
          ...docs[key],
          error: err instanceof Error ? err.message : 'Could not read signature image.',
        },
      });
    }
  };

  const describePaymentError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        logout();
        openModal('signin', 'customer');
      }
      return err.message;
    }
    return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  };

  const handlePayNow = async () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a valid amount.');
      return;
    }
    setPaying(true);
    setPaymentError(null);
    try {
      const order = await createPaymentOrder(session.token, amount);
      const result = await openRazorpayCheckout({
        keyId: order.razorpay_key_id,
        amountPaise: order.amount_paise,
        currency: order.currency,
        orderId: order.razorpay_order_id,
        name: 'Divine Vision Infratech',
        description: 'Plot booking payment',
        prefillEmail: session.email,
        prefillName: docs.bookingApplication.formData.applicantName,
      });
      const record = await verifyPayment(session.token, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      persist({
        ...docs,
        payment: {
          paymentId: record.id,
          amount: record.amount,
          status: record.verified ? 'paid' : 'failed',
          method: record.method,
          razorpayOrderId: record.razorpay_order_id,
          razorpayPaymentId: record.razorpay_payment_id,
          paidAt: record.verified ? new Date().toISOString() : null,
          error: record.verified ? null : 'Payment could not be verified. Please try again or contact support.',
        },
      });
      if (!record.verified) setPaymentError('Payment could not be verified. Please try again or contact support.');
    } catch (err) {
      setPaymentError(describePaymentError(err));
    } finally {
      setPaying(false);
    }
  };

  const handlePayByCash = async () => {
    const amount = Number(cashAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Enter a valid cash amount.');
      return;
    }
    setPayingCash(true);
    setPaymentError(null);
    try {
      const record = await recordCashPayment(session.token, amount, 'Cash recorded from booking application final page.');
      persist({
        ...docs,
        payment: {
          paymentId: record.id,
          amount: record.amount,
          status: 'paid',
          method: record.method,
          razorpayOrderId: record.razorpay_order_id,
          razorpayPaymentId: record.razorpay_payment_id,
          paidAt: new Date().toISOString(),
          error: null,
        },
      });
    } catch (err) {
      setPaymentError(describePaymentError(err));
    } finally {
      setPayingCash(false);
    }
  };

  const handleGenerate = async () => {
    const applicantSignature = docs.applicantSignature.dataUrl;
    // Whether a co-applicant exists is set via the checkbox on the PAN card & signatures
    // tile (Documents page) - the single source of truth for whether their signature/photo
    // are required, not whatever happens to be typed into the name field below.
    const hasCoApplicant = docs.hasCoApplicant;
    if (docs.payment.status !== 'paid') {
      setError('Complete the plot booking payment before generating the application PDF.');
      return;
    }
    if (!docs.payment.paymentId) {
      setError('Payment reference is missing. Please complete payment again before generating the application PDF.');
      return;
    }
    if (!docs.bookingApplication.formData.projectId) {
      setError('Select the project before generating the application PDF.');
      return;
    }
    if (!docs.aadharFront.documentId || (!docs.aadharFront.dataUrl && !docs.aadharFront.signedUrl)) {
      setError('Upload the Aadhaar front photo before generating the application PDF.');
      return;
    }
    if (!docs.aadharBack.documentId || (!docs.aadharBack.dataUrl && !docs.aadharBack.signedUrl)) {
      setError('Upload the Aadhaar back photo before generating the application PDF.');
      return;
    }
    if (!docs.pan.documentId || (!docs.pan.dataUrl && !docs.pan.signedUrl)) {
      setError('Upload the PAN card photo before generating the application PDF.');
      return;
    }
    if (!docs.applicantPhoto.documentId || (!docs.applicantPhoto.dataUrl && !docs.applicantPhoto.signedUrl)) {
      setError('Upload the applicant photo before generating the application PDF.');
      return;
    }
    if (hasCoApplicant && (!docs.coApplicantPhoto.documentId || (!docs.coApplicantPhoto.dataUrl && !docs.coApplicantPhoto.signedUrl))) {
      setError('Upload the co-applicant photo before generating the application PDF.');
      return;
    }
    if (!applicantSignature) {
      setError('Upload the first applicant signature before generating the application PDF.');
      return;
    }
    if (hasCoApplicant && !docs.coApplicantSignature.dataUrl) {
      setError('Upload the co-applicant signature before generating the application PDF.');
      return;
    }
    if (!docs.bookingApplication.formData.pricingNotesAccepted) {
      setError('Accept the pricing notes before generating the application PDF.');
      return;
    }
    if (!docs.bookingApplication.formData.applicantDeclarationAccepted) {
      setError('Accept the applicant declaration before generating the application PDF.');
      return;
    }
    if (!docs.bookingApplication.formData.termsAccepted) {
      setError('Accept the terms and conditions before generating the application PDF.');
      return;
    }
    if (!docs.bookingApplication.formData.paymentPlanAccepted) {
      setError('Accept the construction linked payment plan before generating the application PDF.');
      return;
    }
    if (!docs.bookingApplication.formData.checklistAccepted) {
      setError('Confirm the application checklist before generating the application PDF.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const blob = await generateApplicationPdf({
        formData: docs.bookingApplication.formData,
        applicantSignatureDataUrl: applicantSignature,
        coApplicantSignatureDataUrl: docs.coApplicantSignature.dataUrl,
        applicantPhotoSource: docs.applicantPhoto.dataUrl || docs.applicantPhoto.signedUrl,
        coApplicantPhotoSource: docs.coApplicantPhoto.dataUrl || docs.coApplicantPhoto.signedUrl,
        paymentInfo: docs.payment,
        identityAttachments: [
          {
            title: 'Aadhaar Card - Front',
            fileName: docs.aadharFront.fileName,
            dataUrl: docs.aadharFront.dataUrl,
            signedUrl: docs.aadharFront.signedUrl,
          },
          {
            title: 'Aadhaar Card - Back',
            fileName: docs.aadharBack.fileName,
            dataUrl: docs.aadharBack.dataUrl,
            signedUrl: docs.aadharBack.signedUrl,
          },
          {
            title: 'PAN Card',
            fileName: docs.pan.fileName,
            dataUrl: docs.pan.dataUrl,
            signedUrl: docs.pan.signedUrl,
          },
        ],
      });
      const fileName = `${docs.bookingApplication.formData.projectId || 'project'}-booking-application-${Date.now()}.pdf`;
      const pdfFile = blobToFile(blob, fileName);
      const pdfDataUrl = await blobToDataUrl(blob);
      try {
        const backendDoc = await uploadGeneratedApplicationPdf(session.token, {
          file: pdfFile,
          projectId: docs.bookingApplication.formData.projectId,
          paymentId: docs.payment.paymentId,
          razorpayOrderId: docs.payment.razorpayOrderId,
          razorpayPaymentId: docs.payment.razorpayPaymentId,
          formData: serializeFormData(docs.bookingApplication.formData),
        });
        persist({
          ...docs,
          bookingApplication: {
            ...docs.bookingApplication,
            generatedAt: new Date().toISOString(),
            pdfFileName: fileName,
            pdfDataUrl,
            backendDocumentId: backendDoc.id,
            signedUrl: backendDoc.signed_url,
            signedUrlExpiresAt: Date.now() + backendDoc.signed_url_expires_in * 1000,
            error: null,
          },
        });
        openPdfBlob(blob);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          openModal('signin', 'customer');
          return;
        }
        throw err;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not generate the application PDF.';
      setError(message);
      persist({ ...docs, bookingApplication: { ...docs.bookingApplication, error: message } });
    } finally {
      setGenerating(false);
    }
  };

  const form = docs.bookingApplication.formData;
  const paymentComplete = docs.payment.status === 'paid';
  const selectedProject = applicationProjects.find((project) => project.id === form.projectId);
  const pageLabels = [
    'Project',
    'Fill application form',
    'First applicant',
    'Co-applicant',
    'Plot',
    'Pricing',
    'Pricing notes',
    'Channel partner',
    'Applicant declaration',
    'Terms',
    'Payment plan',
    'Form 60',
    'Generate',
  ];
  const lastPage = pageLabels.length - 1;
  const goToPage = (nextPage: number) => {
    const bounded = Math.min(Math.max(nextPage, 0), lastPage);
    setPageDirection(bounded >= currentPage ? 'forward' : 'back');
    setCurrentPage(bounded);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DashboardLayout
      eyebrow="Customer application"
      heading="Project booking application"
      subheading="Select the project, fill the applicant and co-applicant details, upload the required signatures, and generate the project-specific application packet."
      contentLayout="full"
    >
      <div className="mb-5 rounded-lg border border-hairline bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="eyebrow-label text-terracotta">
            Page {currentPage + 1} of {pageLabels.length}
          </span>
          <span className="text-sm font-semibold text-ink">{pageLabels[currentPage]}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg">
          <div
            className="h-full rounded-full bg-green transition-all duration-300"
            style={{ width: `${((currentPage + 1) / pageLabels.length) * 100}%` }}
          />
        </div>
      </div>

      <div className={`application-notebook notebook-${pageDirection}`} data-page={currentPage}>
        <Section title="Project">
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-ink">Application form project</span>
            <select
              value={form.projectId}
              onChange={(event) => updateForm('projectId', event.target.value as BookingApplicationFormData['projectId'])}
              className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            >
              <option value="">Select project</option>
              {applicationProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label} - {project.location}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <Section title="Fill application form">
          <UndertakingCopy projectName={selectedProject?.label ?? ''} />
          <Field label="Booking amount remitted (Rs.)" type="number" value={form.bookingAmount} onChange={(value) => updateForm('bookingAmount', value)} />
          <Field label="Amount in words" value={form.bookingAmountWords} onChange={(value) => updateForm('bookingAmountWords', value)} />
          <Field label="Bank draft / cheque / reference no." value={form.chequeNo} onChange={(value) => updateForm('chequeNo', value)} />
          <Field label="Dated" type="date" value={form.chequeDate} onChange={(value) => updateForm('chequeDate', value)} />
          <Field label="Drawn on bank" value={form.bankName} onChange={(value) => updateForm('bankName', value)} />
          <Field label="Payment mode" value={form.paymentMode} onChange={(value) => updateForm('paymentMode', value)} />
          <SignatureUpload
            label="First applicant signature for undertaking"
            status={docs.applicantSignature}
            onUpload={(file) => void handleSignatureUpload('applicant', file)}
          />
        </Section>

        <Section title="Sole / first applicant">
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-bg px-4 py-3">
            <p className="text-xs text-ink-muted">
              Already verified Aadhaar via QR on the Documents page? Autofill name, DOB, gender, guardian, and address from it.
            </p>
            <button
              type="button"
              onClick={handleAutofillFromAadhaar}
              className="shrink-0 rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green"
            >
              Autofill from Aadhaar
            </button>
          </div>
          <Field label="Customer name" value={form.applicantName} onChange={(value) => updateForm('applicantName', value)} />
          <Field label="S/o, W/o, D/o, C/o" value={form.guardianName} onChange={(value) => updateForm('guardianName', value)} />
          <Field label="DOB / DOI" type="date" value={form.dob} onChange={(value) => updateForm('dob', value)} />
          <SelectField label="Gender" value={form.gender} onChange={(value) => updateForm('gender', value)} options={GENDER_OPTIONS} />
          <Field label="PAN" value={form.pan} onChange={(value) => updateForm('pan', value.toUpperCase())} />
          <Field label="Aadhaar no." value={form.aadhaar} onChange={(value) => updateForm('aadhaar', value)} />
          <Field label="Email ID" type="email" value={form.email} onChange={(value) => updateForm('email', value)} />
          <Field label="Mobile no." value={form.mobile} onChange={(value) => updateForm('mobile', value)} />
          <Field label="Residence phone" value={form.phone} onChange={(value) => updateForm('phone', value)} />
          <Field label="Residential status" value={form.residentialStatus} onChange={(value) => updateForm('residentialStatus', value)} />
          <Field label="Permanent address" value={form.permanentAddress} onChange={(value) => updateForm('permanentAddress', value)} multiline />
          <Field label="Correspondence address" value={form.correspondenceAddress} onChange={(value) => updateForm('correspondenceAddress', value)} multiline />
        </Section>

        <Section title="Co-applicant details">
          <p className="sm:col-span-2 text-xs font-semibold italic text-ink-muted">
            To be filled in block letters. Leave a space blank between two consecutive words.
          </p>
          <Field label="Customer name" value={form.coApplicantName} onChange={(value) => updateForm('coApplicantName', value)} />
          <Field label="S/o, W/o, D/o, C/o" value={form.coApplicantGuardianName} onChange={(value) => updateForm('coApplicantGuardianName', value)} />
          <Field label="DOB / DOI" type="date" value={form.coApplicantDob} onChange={(value) => updateForm('coApplicantDob', value)} />
          <SelectField label="Gender" value={form.coApplicantGender} onChange={(value) => updateForm('coApplicantGender', value)} options={GENDER_OPTIONS} />
          <Field label="PAN" value={form.coApplicantPan} onChange={(value) => updateForm('coApplicantPan', value.toUpperCase())} />
          <Field label="Aadhaar no." value={form.coApplicantAadhaar} onChange={(value) => updateForm('coApplicantAadhaar', value)} />
          <Field label="Phone no. (residence)" value={form.coApplicantPhone} onChange={(value) => updateForm('coApplicantPhone', value)} />
          <Field label="Mobile no." value={form.coApplicantMobile} onChange={(value) => updateForm('coApplicantMobile', value)} />
          <Field label="Email ID" type="email" value={form.coApplicantEmail} onChange={(value) => updateForm('coApplicantEmail', value)} />
          <label className="block">
            <span className="text-xs font-semibold text-ink">Residential status</span>
            <select
              value={form.coApplicantResidentialStatus}
              onChange={(event) => updateForm('coApplicantResidentialStatus', event.target.value)}
              className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            >
              <option value="">Select residential status</option>
              <option value="Resident">Resident</option>
              <option value="Non Resident">Non Resident</option>
              <option value="Person of Indian Origin">Person of Indian Origin</option>
              <option value="Foreign National">Foreign National</option>
            </select>
          </label>
          <Field
            label="Permanent address"
            value={form.coApplicantPermanentAddress}
            onChange={(value) => updateForm('coApplicantPermanentAddress', value)}
            multiline
          />
          <Field
            label="Correspondence address"
            value={form.coApplicantCorrespondenceAddress}
            onChange={(value) => updateForm('coApplicantCorrespondenceAddress', value)}
            multiline
          />
          <SignatureUpload
            label="Co-applicant signature image"
            status={docs.coApplicantSignature}
            onUpload={(file) => void handleSignatureUpload('coApplicant', file)}
          />
        </Section>

        <Section title="Details of residential plot">
          <Field label="Unit no." value={form.unitNo} onChange={(value) => updateForm('unitNo', value)} />
          <Field label="In sq yd." type="number" value={form.plotAreaSqYd} onChange={(value) => updateForm('plotAreaSqYd', value)} />
          <Field label="In sq mtr." type="number" value={form.plotAreaSqMtr} onChange={(value) => updateForm('plotAreaSqMtr', value)} />
          <Field label="Unit type" value={form.unitType} onChange={(value) => updateForm('unitType', value)} />
        </Section>

        <Section title="Details of pricing">
          <div className="sm:col-span-2 overflow-hidden rounded-lg border border-hairline">
            <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-green px-3 py-2 text-xs font-bold text-white">
              <span>Basic Cost Of The Residential Plot</span>
              <span>Rate per Sq Yard</span>
              <span>Price</span>
            </div>
            <div className="grid gap-px bg-hairline text-sm">
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-surface p-3">
                <span className="font-semibold text-ink">A. Basic Sale Price (BSP)</span>
                <input value={form.ratePerSqYd} onChange={(event) => updateForm('ratePerSqYd', event.target.value)} className="mx-2 rounded border border-hairline bg-bg px-2 py-1 outline-none focus:border-green" />
                <input value={form.basicSalePrice} onChange={(event) => updatePrice('basicSalePrice', event.target.value)} className="mx-2 rounded border border-hairline bg-bg px-2 py-1 outline-none focus:border-green" />
              </div>
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-surface p-3">
                <span className="font-semibold text-ink">B. PLC Applicable</span>
                <input value={form.plcRatePerSqYd} onChange={(event) => updateForm('plcRatePerSqYd', event.target.value)} className="mx-2 rounded border border-hairline bg-bg px-2 py-1 outline-none focus:border-green" />
                <input value={form.plcPrice} onChange={(event) => updatePrice('plcPrice', event.target.value)} className="mx-2 rounded border border-hairline bg-bg px-2 py-1 outline-none focus:border-green" />
              </div>
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-surface p-3">
                <span className="font-semibold text-ink">Total Amount (A+B)</span>
                <span />
                <input value={form.totalAmount} readOnly className="mx-2 cursor-not-allowed rounded border border-hairline bg-bg px-2 py-1 text-ink-muted outline-none" />
              </div>
              <div className="grid grid-cols-[1.3fr_1fr_1fr] bg-surface p-3">
                <span className="font-semibold text-ink">Amount in Figure</span>
                <span />
                <input value={form.amountInFigure} readOnly className="mx-2 cursor-not-allowed rounded border border-hairline bg-bg px-2 py-1 text-ink-muted outline-none" />
              </div>
              <div className="grid grid-cols-[1.3fr_2fr] bg-surface p-3">
                <span className="font-semibold text-ink">Amount in Words</span>
                <input value={form.totalAmountWords} readOnly className="mx-2 cursor-not-allowed rounded border border-hairline bg-bg px-2 py-1 text-ink-muted outline-none" />
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 rounded-lg bg-green px-4 py-3 font-display text-lg font-bold uppercase tracking-wide text-white">
            Plan Type: Construction Linked Plan
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-ink">Mode of booking</span>
            <select value={form.bookingMode} onChange={(event) => updateForm('bookingMode', event.target.value)} className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green">
              <option value="">Select mode</option>
              <option value="Direct">Direct</option>
              <option value="Channel Partners">Channel Partners</option>
              <option value="Employee Referral">Employee Referral</option>
            </select>
          </label>
          <Field label="Employee name" value={form.employeeName} onChange={(value) => updateForm('employeeName', value)} />
          <Field label="Employee code" value={form.employeeCode} onChange={(value) => updateForm('employeeCode', value)} />
        </Section>

        <Section title="Pricing notes">
          <LegalNote>
            <p className="font-semibold text-ink">NOTE:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Price of plot per sq. meter = Total Price Amount / Area of Plots in Sq. meter.</li>
              <li>Price of plot per sq. yard = Total Price Amount / Area in Sq. yard.</li>
              <li>Conversion of unit of Measurement: 1 Sq. meter = 1.1959 square yd.</li>
              <li>Breakup of the amount i.e. towards charges mentioned above, if any, is calculated on Plot area.</li>
              <li>
                EDC has been included in above price as per rates for EDC applicable on the date of grant of License No. 68 of 2024.
                Any upward/downward revision by the concerned Authority shall be payable/refundable as per the terms and conditions
                of the Agreement for Sale.
              </li>
              <li>
                The cost of Electricity Meter connection and actual electricity consumption is not included in the above price and
                the Applicant shall apply to the competent Authority to get the same at his/her own additional cost.
              </li>
              <li>
                The above mentioned Total Price includes cost of maintenance charges up to the period of 45 days from the date of
                offer of possession. Thereafter, the maintenance security deposit and maintenance charges shall be charged as per the
                terms and conditions of agreement for sale. The Stamp duty, sale/conveyance deed registration charges, retrospective
                revision in currently applicable and/or introduction of new taxes/cess/government charges shall be payable additionally
                as per the terms and conditions of Agreement for Sale.
              </li>
              <li>
                The standard Agreement for Sale format is available on Haryana RERA and Company's web site and the applicant is
                requested to read the same.
              </li>
            </ul>
          </LegalNote>
          <CheckboxField
            label="I/we have read and accept the pricing notes and additional charge conditions."
            checked={form.pricingNotesAccepted}
            onChange={(checked) => updateForm('pricingNotesAccepted', checked)}
          />
        </Section>

        <Section title="Channel partner declaration">
          <Field label="Channel partner name" value={form.channelPartnerName} onChange={(value) => updateForm('channelPartnerName', value)} />
          <Field label="CP code" value={form.channelPartnerCode} onChange={(value) => updateForm('channelPartnerCode', value)} />
          <Field label="CP address" value={form.channelPartnerAddress} onChange={(value) => updateForm('channelPartnerAddress', value)} multiline />
          <Field label="CP contact no." value={form.channelPartnerMobile} onChange={(value) => updateForm('channelPartnerMobile', value)} />
          <Field
            label="Authorized signatory"
            value={form.channelPartnerAuthorizedSignatory}
            onChange={(value) => updateForm('channelPartnerAuthorizedSignatory', value)}
          />
          <Field label="Dealer / firm name" value={form.channelPartnerFirmName} onChange={(value) => updateForm('channelPartnerFirmName', value)} />
          <LegalNote>
            <p className="font-semibold text-ink">CHANNEL PARTNERS DECLARATION:</p>
            <p className="mt-3">
              I, the authorized signatory of the dealer/channel partner, do hereby declare that all particulars filled by the
              Applicant(s) herein and documents/ID proof supplied by the Applicant(s) are personally verified by me and found to be
              genuine. The signatures of the Applicant(s) appended herein are subscribed in my presence.
            </p>
            <p className="mt-3">
              I shall be liable and responsible if the enclosed document/information is found to be forged or faked and results in
              cancellation of the booked Residential Plot by the Company. I shall provide NOC in case of surrender, transfer, or
              assignment of allotment right by the Applicant(s).
            </p>
          </LegalNote>
          <CheckboxField
            label="I confirm the channel partner declaration where this booking is through a channel partner."
            checked={form.channelPartnerDeclarationAccepted}
            onChange={(checked) => updateForm('channelPartnerDeclarationAccepted', checked)}
          />
        </Section>

        <Section title="Applicant declaration">
          <Field label="Application date" type="date" value={form.applicationDate} onChange={(value) => updateForm('applicationDate', value)} />
          <Field label="Place" value={form.place} onChange={(value) => updateForm('place', value)} />
          <LegalNote>
            <p className="font-semibold text-ink">DECLARATION:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              {applicantDeclarationItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </LegalNote>
          <CheckboxField
            label="I/we accept the applicant declaration."
            checked={form.applicantDeclarationAccepted}
            onChange={(checked) => updateForm('applicantDeclarationAccepted', checked)}
          />
        </Section>

        <Section title="Terms and conditions">
          <LegalNote>
            <p className="font-semibold text-ink">TERMS & CONDITIONS:</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {termsAndConditions.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ol>
          </LegalNote>
          <CheckboxField
            label="I/we accept the terms and conditions."
            checked={form.termsAccepted}
            onChange={(checked) => updateForm('termsAccepted', checked)}
          />
        </Section>

        <Section title="Construction linked payment plan">
          <LegalNote>
            <p>
              Cost of stamp duty, registration, documentation charges, government taxes, and other applicable charges are payable by
              the allottee as actuals. The allotment letter is signed separately and overrides conditions mentioned in this note.
              Delayed or missed installments may lead to cancellation or regularization with interest.
            </p>
            <div className="mt-4 grid gap-2 text-xs font-semibold text-ink sm:grid-cols-2">
              <span>On booking: 10% of BSP</span>
              <span>On issuance of Allotment Letter/BBA: 20% of BSP</span>
              <span>On start of drainage work: 25% of BSP + PLC</span>
              <span>On start of underground cabling work: 25% of BSP</span>
              <span>On application of CC: 15% of BSP + IFMS</span>
              <span>On offer of possession: 5% of BSP</span>
            </div>
          </LegalNote>
          <CheckboxField
            label="I/we accept the construction linked payment plan and related notes."
            checked={form.paymentPlanAccepted}
            onChange={(checked) => updateForm('paymentPlanAccepted', checked)}
          />
        </Section>

        <Section title="Annexure - Form 60">
          <LegalNote>
            <p>
              Form 60 is to be filled by a person who does not have PAN/GIR and makes payment in cash for applicable transactions.
            </p>
          </LegalNote>
          <Field
            label="Full name and address of declarant"
            value={form.form60FullNameAddress}
            onChange={(value) => updateForm('form60FullNameAddress', value)}
            multiline
          />
          <Field
            label="Particulars of transaction"
            value={form.form60TransactionParticulars}
            onChange={(value) => updateForm('form60TransactionParticulars', value)}
          />
          <Field
            label="Amount of transaction"
            value={form.form60TransactionAmount}
            onChange={(value) => updateForm('form60TransactionAmount', value)}
          />
          <label className="block">
            <span className="text-xs font-semibold text-ink">Are you assessed to tax?</span>
            <select
              value={form.form60AssessedToTax}
              onChange={(event) => updateForm('form60AssessedToTax', event.target.value)}
              className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </label>
          <Field
            label="Ward / circle / range"
            value={form.form60WardCircleRange}
            onChange={(value) => updateForm('form60WardCircleRange', value)}
          />
          <Field
            label="Reason for not having PAN / GIR"
            value={form.form60NoPanReason}
            onChange={(value) => updateForm('form60NoPanReason', value)}
            multiline
          />
          <Field
            label="Address proof document produced"
            value={form.form60AddressProofDocument}
            onChange={(value) => updateForm('form60AddressProofDocument', value)}
          />
          <Field
            label="Verification name"
            value={form.form60VerificationName}
            onChange={(value) => updateForm('form60VerificationName', value)}
          />
          <Field
            label="Verified date"
            type="date"
            value={form.form60VerificationDate}
            onChange={(value) => updateForm('form60VerificationDate', value)}
          />
          <Field
            label="Verified day"
            value={form.form60VerificationDay}
            onChange={(value) => updateForm('form60VerificationDay', value)}
          />
          <Field
            label="Place"
            value={form.form60VerificationPlace}
            onChange={(value) => updateForm('form60VerificationPlace', value)}
          />
          <CheckboxField
            label="I declare that the Form 60 information stated above is true to the best of my knowledge and belief."
            checked={form.form60Accepted}
            onChange={(checked) => updateForm('form60Accepted', checked)}
          />
        </Section>

        <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-lg border border-hairline bg-surface p-5">
          <div className="basis-full rounded-lg border border-hairline bg-bg p-4 text-sm text-ink-muted">
            <p className="font-semibold text-ink">Checklist confirmation</p>
            <p className="mt-2">
              Confirm that the application is complete, signatures are uploaded, booking payment details are entered, and PAN/address
              proof or applicable Form 60 details are ready for submission.
            </p>
          </div>
          <CheckboxField
            label="I confirm the application checklist is complete."
            checked={form.checklistAccepted}
            onChange={(checked) => updateForm('checklistAccepted', checked)}
          />
          <div className="basis-full rounded-lg border border-hairline bg-bg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">Plot booking payment</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Pay online through Razorpay or record cash received. PDF generation unlocks only after payment is successful.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentComplete ? 'bg-green text-white' : 'bg-hairline text-ink-muted'}`}>
                {paymentComplete ? 'Paid' : 'Payment pending'}
              </span>
            </div>
            {paymentComplete ? (
              <p className="mt-4 text-sm text-ink-muted">
                <span className="font-semibold text-ink">Rs. {docs.payment.amount?.toLocaleString('en-IN')}</span> paid
                {docs.payment.method === 'cash' ? ' in cash' : ' online'}
                {docs.payment.paidAt ? ` on ${new Date(docs.payment.paidAt).toLocaleDateString('en-IN')}` : ''}.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-hairline bg-surface p-4">
                  <p className="text-xs font-semibold text-ink">Online payment</p>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    placeholder="Amount (Rs.)"
                    className="mt-2 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                  />
                  <button
                    type="button"
                    onClick={handlePayNow}
                    disabled={paying}
                    className="mt-3 rounded-full bg-green px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {paying ? 'Processing...' : 'Pay Now'}
                  </button>
                </div>
                <div className="rounded-lg border border-hairline bg-surface p-4">
                  <p className="text-xs font-semibold text-ink">Cash transaction</p>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={cashAmountInput}
                    onChange={(event) => setCashAmountInput(event.target.value)}
                    placeholder="Cash amount received (Rs.)"
                    className="mt-2 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                  />
                  <button
                    type="button"
                    onClick={handlePayByCash}
                    disabled={payingCash}
                    className="mt-3 rounded-full border border-hairline px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {payingCash ? 'Recording...' : 'Record Cash Payment'}
                  </button>
                </div>
              </div>
            )}
            {(paymentError || docs.payment.error) && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {paymentError ?? docs.payment.error}
              </p>
            )}
          </div>
          <div className="basis-full pt-8">
            {!paymentComplete && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Complete the plot booking payment first. After Razorpay verifies the payment, PDF generation will be enabled.
              </p>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !paymentComplete}
              className="rounded-full bg-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? 'Generating...' : 'Generate application PDF'}
            </button>
            {docs.bookingApplication.pdfDataUrl && (
              <button
                type="button"
                onClick={() => openDataUrl(docs.bookingApplication.pdfDataUrl as string)}
                className="ml-3 rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-green hover:text-green"
              >
                Open generated PDF
              </button>
            )}
          </div>
          {docs.bookingApplication.generatedAt && (
            <span className="text-xs text-ink-muted">
              Generated on {new Date(docs.bookingApplication.generatedAt).toLocaleString('en-IN')}
              {docs.bookingApplication.backendDocumentId ? ' and submitted to backend document generation.' : '.'}
            </span>
          )}
          {(error || docs.bookingApplication.error) && (
            <p role="alert" className="basis-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error ?? docs.bookingApplication.error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-4">
        <button
          type="button"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          className="rounded-full border border-hairline px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-45"
        >
          Previous
        </button>
        <div className="hidden min-w-0 flex-1 justify-center gap-1 sm:flex">
          {pageLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => goToPage(index)}
              aria-label={`Go to ${label}`}
              className={`h-2.5 w-8 rounded-full transition-colors ${index === currentPage ? 'bg-green' : 'bg-hairline hover:bg-terracotta-light'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === lastPage}
          className="rounded-full bg-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-45"
        >
          Next
        </button>
      </div>
    </DashboardLayout>
  );
}
