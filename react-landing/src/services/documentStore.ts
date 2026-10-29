import type { PaymentPlan } from './customerProfileApi';
import type { ApplicationProjectId } from '../data/applicationProjects';
import { applicationProjects } from '../data/applicationProjects';

/**
 * Local persistence for the document-upload flow. Aadhar/PAN file storage and
 * e-signature verification have no backend yet, so those stay simulated
 * client-side (file metadata + a status flag). Document *generation* now
 * calls the real POST /documents/generate API (see documentsApi.ts) — this
 * just caches the returned id/signed URL/expiry so a document can be
 * reopened later without hitting the backend again until the link expires.
 */

export interface DocStatus {
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  verified: boolean;
  verifiedAt: string | null;
  dataUrl: string | null;
  /** Set once the file has actually reached storage (POST /documents/pan-photo) - fileName
   * alone can be set optimistically before the upload confirms. */
  documentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  error: string | null;
}

/** Aadhaar verifies against the real UIDAI-backed /kyc/aadhaar/* API, but a
 * failed attempt is only a pending KYC state. Customers can still upload
 * documents and pay while support or the customer retries verification later. */
export interface AadhaarStatus {
  verified: boolean;
  verificationId: string | null;
  /** Authenticated account that received this server verification result. */
  verifiedOwnerId: string | null;
  verifiedAt: string | null;
  method: 'qr' | 'offline_xml' | null;
  maskedAadhaar: string | null;
  name: string | null;
  /** Raw fields from the QR/XML decode, kept around so the booking application form
   * can autofill from them - not shown anywhere as "verified" facts on their own,
   * since only name/maskedAadhaar/verified are covered by the signature check. */
  dob: string | null;
  gender: string | null;
  careOf: string | null;
  address: string | null;
  lastAttemptError: string | null;
}

export function emptyAadhaarStatus(): AadhaarStatus {
  return {
    verified: false,
    verificationId: null,
    verifiedOwnerId: null,
    verifiedAt: null,
    method: null,
    maskedAadhaar: null,
    name: null,
    dob: null,
    gender: null,
    careOf: null,
    address: null,
    lastAttemptError: null,
  };
}

/** A raw Aadhaar front/back photo uploaded straight to storage (POST
 * /documents/aadhaar-photo) for later use in document generation - not
 * parsed or verified, unlike AadhaarStatus above. */
export interface AadhaarPhotoStatus {
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  dataUrl: string | null;
  documentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  error: string | null;
}

export function emptyAadhaarPhotoStatus(): AadhaarPhotoStatus {
  return {
    fileName: null,
    fileSize: null,
    uploadedAt: null,
    dataUrl: null,
    documentId: null,
    signedUrl: null,
    signedUrlExpiresAt: null,
    error: null,
  };
}

export interface GeneratedDocStatus {
  generated: boolean;
  generatedAt: string | null;
  applicantName: string | null;
  signatureVerified: boolean;
  documentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
}

/** A payment (online via Razorpay or cash recorded in person) - "paid" is only ever set
 * after the backend confirms it (gateway server-side confirmation check, or the cash-entry
 * response itself since cash settles immediately), never from client-side say-so. */
export interface PaymentStatus {
  paymentId: string | null;
  amount: number | null;
  status: 'created' | 'paid' | 'failed' | null;
  method: 'razorpay' | 'cash' | 'rtgs_neft' | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  /** Inventory lock outcome the backend returned on this booking payment:
   *  - `pending_kyc_review` — the plot is held while an admin reviews KYC docs
   *  - `booked`   — KYC was approved and the plot is now locked to this customer
   *  - `conflict` — payment succeeded but the plot was already taken; the money
   *                 is safe and under manual review server-side
   *  - `null`     — not a plot-booking payment (or an older record) */
  inventoryStatus?: 'pending_kyc_review' | 'booked' | 'conflict' | null;
  /** Set only when `inventoryStatus === 'conflict'`. */
  inventoryConflictReason?: 'unit_not_available' | 'inventory_update_failed' | null;
  error: string | null;
}

export function emptyPaymentStatus(): PaymentStatus {
  return {
    paymentId: null,
    amount: null,
    status: null,
    method: null,
    razorpayOrderId: null,
    razorpayPaymentId: null,
    paidAt: null,
    inventoryStatus: null,
    inventoryConflictReason: null,
    error: null,
  };
}

/** Resets the Aadhaar verification and every uploaded file so the next plot
 * booking starts from scratch. Server-side booking documents remain available
 * to admins. The booking application and payment are left to the caller. */
export function clearBookingUploadCache(state: CustomerDocState): CustomerDocState {
  return {
    ...state,
    aadhar: emptyAadhaarStatus(),
    aadharFront: emptyAadhaarPhotoStatus(),
    aadharBack: emptyAadhaarPhotoStatus(),
    pan: emptyDocStatus(),
    applicantPhoto: emptyAadhaarPhotoStatus(),
    coApplicantPhoto: emptyAadhaarPhotoStatus(),
    applicantSignature: emptySignatureStatus(),
    coApplicantSignature: emptySignatureStatus(),
    cancelledCheque: emptySignatureStatus(),
    paymentProof: emptySignatureStatus(),
    hasCoApplicant: false,
    generatedDoc: emptyGeneratedDocStatus(),
  };
}

export const AADHAAR_REVERIFY_MESSAGE =
  'Your earlier Aadhaar verification could not be confirmed for this account. Please verify Aadhaar again.';

/** A verification cached under an email is valid only for the account that
 * received the server response. Older cache entries have no owner and expire,
 * with a message so the customer knows why they must verify again. */
export function forAadhaarOwner(state: CustomerDocState, ownerId: string): CustomerDocState {
  if (!state.aadhar.verified || state.aadhar.verifiedOwnerId === ownerId) return state;
  return { ...state, aadhar: { ...emptyAadhaarStatus(), lastAttemptError: AADHAAR_REVERIFY_MESSAGE } };
}

/** Loads this account's booking state with any foreign/ownerless Aadhaar
 * verification dropped (and saved back, so it doesn't reappear). */
export function loadAccountCustomerDocs(email: string, ownerId: string | null | undefined): CustomerDocState {
  const loaded = loadCustomerDocs(email);
  if (!ownerId) return loaded;
  const scoped = forAadhaarOwner(loaded, ownerId);
  if (scoped !== loaded) saveCustomerDocs(email, scoped);
  return scoped;
}

export interface SignatureStatus {
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  dataUrl: string | null;
  documentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  error: string | null;
}

export function emptySignatureStatus(): SignatureStatus {
  return {
    fileName: null,
    fileSize: null,
    uploadedAt: null,
    dataUrl: null,
    documentId: null,
    signedUrl: null,
    signedUrlExpiresAt: null,
    error: null,
  };
}

export interface BookingApplicationFormData {
  projectId: '' | 'ops-divine-greens' | 'suraksha-enclave';
  applicantName: string;
  guardianName: string;
  dob: string;
  gender: string;
  pan: string;
  email: string;
  aadhaar: string;
  phone: string;
  mobile: string;
  residentialStatus: string;
  permanentAddress: string;
  correspondenceAddress: string;
  correspondenceSameAsPermanent: boolean;
  coApplicantName: string;
  coApplicantGuardianName: string;
  coApplicantDob: string;
  coApplicantGender: string;
  coApplicantPan: string;
  coApplicantAadhaar: string;
  coApplicantPhone: string;
  coApplicantMobile: string;
  coApplicantEmail: string;
  coApplicantResidentialStatus: string;
  coApplicantPermanentAddress: string;
  coApplicantCorrespondenceAddress: string;
  coApplicantCorrespondenceSameAsPermanent: boolean;
  unitNo: string;
  plotAreaSqYd: string;
  plotAreaSqMtr: string;
  unitType: string;
  ratePerSqYd: string;
  basicSalePrice: string;
  plcRatePerSqYd: string;
  plcPrice: string;
  totalAmount: string;
  /** Agreed total plot consideration in rupees. Sent to the backend as
   * `total_amount` and drives the demand / allotment payment plan. Defaults to
   * A + B but the sales team can override it. */
  totalPlotAmount: string;
  amountInFigure: string;
  totalAmountWords: string;
  bookingAmount: string;
  bookingAmountWords: string;
  paymentMode: string;
  bookingMode: string;
  employeeName: string;
  employeeCode: string;
  chequeNo: string;
  chequeDate: string;
  bankName: string;
  channelPartnerName: string;
  channelPartnerCode: string;
  channelPartnerAddress: string;
  channelPartnerMobile: string;
  channelPartnerAuthorizedSignatory: string;
  channelPartnerFirmName: string;
  channelPartnerDeclarationAccepted: boolean;
  pricingNotesAccepted: boolean;
  applicantDeclarationAccepted: boolean;
  termsAccepted: boolean;
  paymentPlanAccepted: boolean;
  form60FullNameAddress: string;
  form60TransactionParticulars: string;
  form60TransactionAmount: string;
  form60AssessedToTax: string;
  form60WardCircleRange: string;
  form60NoPanReason: string;
  form60AddressProofDocument: string;
  form60VerificationName: string;
  form60VerificationDate: string;
  form60VerificationDay: string;
  form60VerificationPlace: string;
  form60Accepted: boolean;
  checklistAccepted: boolean;
  applicationDate: string;
  place: string;
}

export interface BookingApplicationStatus {
  formData: BookingApplicationFormData;
  /** Inventory unit id of the plot being booked. Carried from "Available plots"
   * so the booking payment can lock the plot even after reloads mid-wizard.
   * Null for drafts started before a unit was picked. */
  inventoryId: string | null;
  /** Unit number of that plot, kept only for "Plot A-12 was just booked…" copy. */
  inventoryUnitNumber: string | null;
  generatedAt: string | null;
  pdfFileName: string | null;
  pdfDataUrl: string | null;
  backendDocumentId: string | null;
  /** Set only after the backend confirms this application and its KYC links. */
  bookingId: string | null;
  kycDocumentsAttached: boolean;
  aadhaarVerificationAttached: boolean;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  /** The payment plan the backend derived on the last successful upload — used
   * to fill the demand / allotment letters until GET /customer/profile is live. */
  paymentPlan: PaymentPlan | null;
  error: string | null;
}

export function emptyBookingApplicationFormData(): BookingApplicationFormData {
  return {
    projectId: '',
    applicantName: '',
    guardianName: '',
    dob: '',
    gender: '',
    pan: '',
    email: '',
    aadhaar: '',
    phone: '',
    mobile: '',
    residentialStatus: '',
    permanentAddress: '',
    correspondenceAddress: '',
    correspondenceSameAsPermanent: false,
    coApplicantName: '',
    coApplicantGuardianName: '',
    coApplicantDob: '',
    coApplicantGender: '',
    coApplicantPan: '',
    coApplicantAadhaar: '',
    coApplicantPhone: '',
    coApplicantMobile: '',
    coApplicantEmail: '',
    coApplicantResidentialStatus: '',
    coApplicantPermanentAddress: '',
    coApplicantCorrespondenceAddress: '',
    coApplicantCorrespondenceSameAsPermanent: false,
    unitNo: '',
    plotAreaSqYd: '',
    plotAreaSqMtr: '',
    unitType: '',
    ratePerSqYd: '',
    basicSalePrice: '',
    plcRatePerSqYd: '',
    plcPrice: '',
    totalAmount: '',
    totalPlotAmount: '',
    amountInFigure: '',
    totalAmountWords: '',
    bookingAmount: '',
    bookingAmountWords: '',
    paymentMode: '',
    bookingMode: '',
    employeeName: '',
    employeeCode: '',
    chequeNo: '',
    chequeDate: '',
    bankName: '',
    channelPartnerName: '',
    channelPartnerCode: '',
    channelPartnerAddress: '',
    channelPartnerMobile: '',
    channelPartnerAuthorizedSignatory: '',
    channelPartnerFirmName: '',
    channelPartnerDeclarationAccepted: false,
    pricingNotesAccepted: false,
    applicantDeclarationAccepted: false,
    termsAccepted: false,
    paymentPlanAccepted: false,
    form60FullNameAddress: '',
    form60TransactionParticulars: '',
    form60TransactionAmount: '',
    form60AssessedToTax: '',
    form60WardCircleRange: '',
    form60NoPanReason: '',
    form60AddressProofDocument: '',
    form60VerificationName: '',
    form60VerificationDate: '',
    form60VerificationDay: '',
    form60VerificationPlace: '',
    form60Accepted: false,
    checklistAccepted: false,
    applicationDate: '',
    place: '',
  };
}

export function emptyBookingApplicationStatus(): BookingApplicationStatus {
  return {
    formData: emptyBookingApplicationFormData(),
    inventoryId: null,
    inventoryUnitNumber: null,
    generatedAt: null,
    pdfFileName: null,
    pdfDataUrl: null,
    backendDocumentId: null,
    bookingId: null,
    kycDocumentsAttached: false,
    aadhaarVerificationAttached: false,
    signedUrl: null,
    signedUrlExpiresAt: null,
    paymentPlan: null,
    error: null,
  };
}

export interface CustomerDocState {
  aadhar: AadhaarStatus;
  aadharFront: AadhaarPhotoStatus;
  aadharBack: AadhaarPhotoStatus;
  pan: DocStatus;
  applicantPhoto: AadhaarPhotoStatus;
  coApplicantPhoto: AadhaarPhotoStatus;
  applicantSignature: SignatureStatus;
  coApplicantSignature: SignatureStatus;
  /** Mandatory cancelled cheque upload (Page 2 - Fill application form). Also
   * uploaded to backend storage as `cancelled_cheque` for admin KYC approval. */
  cancelledCheque: SignatureStatus;
  /** Optional proof of an offline booking payment - a scan/photo or PDF of the
   * cheque, demand draft, or NEFT/RTGS/UTR receipt entered on Page 2. Client-side
   * only; appended to the generated application PDF. */
  paymentProof: SignatureStatus;
  /** Co-applicant details are optional - this is the single source of truth (set via
   * a checkbox on the PAN card & signatures tile) for whether the co-applicant
   * signature/photo are required and whether the photo upload tile is shown at all. */
  hasCoApplicant: boolean;
  generatedDoc: GeneratedDocStatus;
  bookingApplication: BookingApplicationStatus;
  payment: PaymentStatus;
}

export interface ScheduledVisit {
  id: string;
  customerName: string;
  customerContact: string;
  project: ApplicationProjectId;
  date: string;
  time: string;
  notes: string;
  status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface BrokerDocState {
  aadhar: AadhaarStatus;
  aadharFront: AadhaarPhotoStatus;
  aadharBack: AadhaarPhotoStatus;
  profilePhoto: AadhaarPhotoStatus;
  visits: ScheduledVisit[];
}

export function emptyDocStatus(): DocStatus {
  return {
    fileName: null,
    fileSize: null,
    uploadedAt: null,
    verified: false,
    verifiedAt: null,
    dataUrl: null,
    documentId: null,
    signedUrl: null,
    signedUrlExpiresAt: null,
    error: null,
  };
}

function storageKey(kind: 'customer' | 'broker', email: string) {
  return `dvi_docs_${kind}_${email.toLowerCase()}`;
}

function emptyGeneratedDocStatus(): GeneratedDocStatus {
  return {
    generated: false,
    generatedAt: null,
    applicantName: null,
    signatureVerified: false,
    documentId: null,
    signedUrl: null,
    signedUrlExpiresAt: null,
  };
}

function normalizeVisits(visits: Partial<ScheduledVisit>[] | undefined): ScheduledVisit[] {
  return (visits ?? []).map((visit) => ({
    id: visit.id ?? `${Date.now()}`,
    customerName: visit.customerName ?? '',
    customerContact: visit.customerContact ?? '',
    project: visit.project ?? applicationProjects[0].id,
    date: visit.date ?? '',
    time: visit.time ?? '',
    notes: visit.notes ?? '',
    status: visit.status ?? 'scheduled',
    createdAt: visit.createdAt ?? new Date().toISOString(),
  }));
}

export function loadCustomerDocs(email: string): CustomerDocState {
  try {
    const raw = localStorage.getItem(storageKey('customer', email));
    if (!raw) throw new Error('none');
    // Partial<> because state cached before aadharFront/aadharBack existed won't have
    // them - back-fill defaults rather than trust the cast and hand back `undefined`.
    // `signature` is a legacy key from before applicant/co-applicant signatures were
    // split out - fold it into applicantSignature for anyone with an old cached blob.
    const parsed = JSON.parse(raw) as Partial<CustomerDocState> & { signature?: SignatureStatus };
    return {
      aadhar: { ...emptyAadhaarStatus(), ...parsed.aadhar },
      aadharFront: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharFront },
      aadharBack: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharBack },
      // Spread over the defaults (not just `??`) so state cached before documentId/
      // signedUrl/error existed on DocStatus still back-fills those specific fields.
      pan: { ...emptyDocStatus(), ...parsed.pan },
      applicantPhoto: { ...emptyAadhaarPhotoStatus(), ...parsed.applicantPhoto },
      coApplicantPhoto: { ...emptyAadhaarPhotoStatus(), ...parsed.coApplicantPhoto },
      applicantSignature: { ...emptySignatureStatus(), ...(parsed.applicantSignature ?? parsed.signature) },
      coApplicantSignature: { ...emptySignatureStatus(), ...parsed.coApplicantSignature },
      cancelledCheque: { ...emptySignatureStatus(), ...parsed.cancelledCheque },
      paymentProof: { ...emptySignatureStatus(), ...parsed.paymentProof },
      // State cached before this checkbox existed won't have it - infer from whether a
      // co-applicant signature was already on file rather than defaulting everyone to false.
      hasCoApplicant: parsed.hasCoApplicant ?? Boolean(parsed.coApplicantSignature?.fileName),
      generatedDoc: parsed.generatedDoc ?? emptyGeneratedDocStatus(),
      bookingApplication: {
        ...emptyBookingApplicationStatus(),
        ...parsed.bookingApplication,
        formData: {
          ...emptyBookingApplicationFormData(),
          ...parsed.bookingApplication?.formData,
        },
      },
      payment: { ...emptyPaymentStatus(), ...parsed.payment },
    };
  } catch {
    return {
      aadhar: emptyAadhaarStatus(),
      aadharFront: emptyAadhaarPhotoStatus(),
      aadharBack: emptyAadhaarPhotoStatus(),
      pan: emptyDocStatus(),
      applicantPhoto: emptyAadhaarPhotoStatus(),
      coApplicantPhoto: emptyAadhaarPhotoStatus(),
      applicantSignature: emptySignatureStatus(),
      coApplicantSignature: emptySignatureStatus(),
      cancelledCheque: emptySignatureStatus(),
      paymentProof: emptySignatureStatus(),
      hasCoApplicant: false,
      generatedDoc: emptyGeneratedDocStatus(),
      bookingApplication: emptyBookingApplicationStatus(),
      payment: emptyPaymentStatus(),
    };
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014)
  );
}

/**
 * Drop the heavy base64 payloads so the record fits localStorage (~5 MB).
 * `aggressive` also drops the copies that only exist locally — a last resort
 * before giving up. The in-memory React state keeps every `dataUrl`; this only
 * trims what goes to disk, and anything with a `documentId`/`signedUrl` can be
 * re-fetched from the backend on the next load.
 */
function slimDocsForStorage<T>(state: T, aggressive: boolean): T {
  const clone = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;

  const booking = clone.bookingApplication as Record<string, unknown> | undefined;
  if (booking && typeof booking.pdfDataUrl === 'string') booking.pdfDataUrl = null;

  for (const value of Object.values(clone)) {
    if (!value || typeof value !== 'object' || !('dataUrl' in value)) continue;
    const doc = value as { dataUrl?: string | null; documentId?: string | null; signedUrl?: string | null };
    if (typeof doc.dataUrl !== 'string') continue;
    if (aggressive || doc.documentId || doc.signedUrl) doc.dataUrl = null;
  }
  return clone as T;
}

/** Free space by dropping doc caches for accounts other than the current one. */
function purgeStaleDocCaches(currentKey: string) {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('dvi_docs_') && k !== currentKey) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** localStorage.setItem that never throws: always slims base64 payloads that are
 * already backed up server-side (documentId/signedUrl set) before writing, so
 * synced copies of Aadhaar/PAN/signature/cheque images and the generated PDF
 * don't linger on disk once the backend has them. On a quota error it purges
 * stale caches and falls back to progressively slimmer payloads; if nothing
 * fits it leaves the previously stored value untouched. No-ops when storage is off. */
function persistDocs(key: string, state: unknown) {
  const tryWrite = (payload: string): boolean | 'quota' => {
    try {
      localStorage.setItem(key, payload);
      return true;
    } catch (err) {
      return isQuotaError(err) ? 'quota' : false;
    }
  };

  const slim = JSON.stringify(slimDocsForStorage(state, false));
  if (tryWrite(slim) === true) return;

  purgeStaleDocCaches(key);
  if (tryWrite(slim) === true) return;

  tryWrite(JSON.stringify(slimDocsForStorage(state, true)));
  // If even that failed, the last good value stays in place.
}

export function saveCustomerDocs(email: string, state: CustomerDocState) {
  persistDocs(storageKey('customer', email), state);
}

/** Clears the on-disk cache of uploaded documents (Aadhaar/PAN/signature/cheque
 * images, the generated booking PDF) for one account. Called on logout so this
 * data doesn't linger in localStorage on a shared/public device after sign-out;
 * the in-memory copy for the current tab is unaffected. */
export function clearCustomerDocsCache(email: string) {
  try {
    localStorage.removeItem(storageKey('customer', email));
    localStorage.removeItem(profilePhotoKey(email));
    localStorage.removeItem(applicantContactKey(email));
  } catch {
    /* ignore */
  }
}

function profilePhotoKey(email: string) {
  return `dvi_profile_photo_customer_${email.toLowerCase()}`;
}

/** The customer's avatar (header menu / profile page). Kept apart from the
 * booking's `applicantPhoto` so a profile photo is never reused as KYC for a
 * new plot booking — every booking uploads its own. Reads only ever flow
 * booking → avatar (a one-time copy of an avatar stored by older builds),
 * never avatar → booking. */
export function loadCustomerProfilePhoto(email: string): AadhaarPhotoStatus {
  try {
    const raw = localStorage.getItem(profilePhotoKey(email));
    if (raw) return { ...emptyAadhaarPhotoStatus(), ...(JSON.parse(raw) as Partial<AadhaarPhotoStatus>) };
  } catch {
    return emptyAadhaarPhotoStatus();
  }
  // Older builds kept the avatar in the booking's applicantPhoto — copy it once
  // so a photo whose upload never finished (dataUrl only) isn't lost.
  const legacy = loadCustomerDocs(email).applicantPhoto;
  if (!legacy.dataUrl && !legacy.documentId) return emptyAadhaarPhotoStatus();
  const migrated = { ...legacy, error: null };
  saveCustomerProfilePhoto(email, migrated);
  return migrated;
}

export function saveCustomerProfilePhoto(email: string, photo: AadhaarPhotoStatus) {
  // Drop the base64 copy once the backend holds the file; the signed URL is re-fetched.
  const slim = photo.documentId || photo.signedUrl ? { ...photo, dataUrl: null } : photo;
  try {
    localStorage.setItem(profilePhotoKey(email), JSON.stringify(slim));
  } catch {
    try {
      localStorage.setItem(profilePhotoKey(email), JSON.stringify({ ...slim, dataUrl: null }));
    } catch {
      /* ignore */
    }
  }
}

function applicantContactKey(email: string) {
  return `dvi_applicant_contact_${email.toLowerCase()}`;
}

/** Display-only copy of the applicant details from the last submitted
 * application, for the profile page's fallbacks once a new booking has cleared
 * the form. Never read back into a booking. */
export interface ApplicantContactSnapshot {
  applicantName: string;
  gender: string;
  dob: string;
  mobile: string;
  phone: string;
  address: string;
}

export function emptyApplicantContactSnapshot(): ApplicantContactSnapshot {
  return { applicantName: '', gender: '', dob: '', mobile: '', phone: '', address: '' };
}

export function saveApplicantContactSnapshot(email: string, docs: CustomerDocState) {
  const form = docs.bookingApplication.formData;
  const snapshot: ApplicantContactSnapshot = {
    applicantName: form.applicantName || docs.aadhar.name || '',
    gender: form.gender || docs.aadhar.gender || '',
    dob: form.dob || docs.aadhar.dob || '',
    mobile: form.mobile,
    phone: form.phone,
    address: form.permanentAddress || form.correspondenceAddress || docs.aadhar.address || '',
  };
  try {
    localStorage.setItem(applicantContactKey(email), JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadApplicantContactSnapshot(email: string): ApplicantContactSnapshot {
  try {
    const raw = localStorage.getItem(applicantContactKey(email));
    return raw
      ? { ...emptyApplicantContactSnapshot(), ...(JSON.parse(raw) as Partial<ApplicantContactSnapshot>) }
      : emptyApplicantContactSnapshot();
  } catch {
    return emptyApplicantContactSnapshot();
  }
}

export function clearBrokerDocsCache(email: string) {
  try {
    localStorage.removeItem(storageKey('broker', email));
  } catch {
    /* ignore */
  }
}

/**
 * Optimistically mark one construction-linked-plan milestone paid in the locally
 * cached plan so the payment schedule updates immediately after a successful
 * instalment payment, before `GET /customer/profile` re-confirms it. `installmentNo`
 * is 1-based. No-op when there is no stored plan or the row is already paid.
 */
export function markInstallmentPaidLocally(email: string, installmentNo: number, amountPaid: number): void {
  const docs = loadCustomerDocs(email);
  const plan = docs.bookingApplication.paymentPlan;
  if (!plan || !Array.isArray(plan.rows) || installmentNo < 1 || installmentNo > plan.rows.length) return;
  const idx = installmentNo - 1;
  if ((plan.rows[idx].status ?? '').toLowerCase() === 'paid') return;

  const rows = plan.rows.map((row, i) => (i === idx ? { ...row, status: 'paid' } : row));
  const received = (typeof plan.total_received === 'number' ? plan.total_received : 0) + Math.round(amountPaid);
  const receivable = typeof plan.total_receivable === 'number' ? plan.total_receivable : null;

  saveCustomerDocs(email, {
    ...docs,
    bookingApplication: {
      ...docs.bookingApplication,
      paymentPlan: {
        ...plan,
        rows,
        total_received: received,
        total_outstanding: receivable != null ? Math.max(0, receivable - received) : plan.total_outstanding ?? null,
      },
    },
  });
}

export function loadBrokerDocs(email: string): BrokerDocState {
  try {
    const raw = localStorage.getItem(storageKey('broker', email));
    if (!raw) throw new Error('none');
    const parsed = JSON.parse(raw) as Partial<BrokerDocState>;
    return {
      aadhar: { ...emptyAadhaarStatus(), ...parsed.aadhar },
      aadharFront: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharFront },
      aadharBack: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharBack },
      profilePhoto: { ...emptyAadhaarPhotoStatus(), ...parsed.profilePhoto },
      visits: normalizeVisits(parsed.visits),
    };
  } catch {
    return {
      aadhar: emptyAadhaarStatus(),
      aadharFront: emptyAadhaarPhotoStatus(),
      aadharBack: emptyAadhaarPhotoStatus(),
      profilePhoto: emptyAadhaarPhotoStatus(),
      visits: [],
    };
  }
}

export function saveBrokerDocs(email: string, state: BrokerDocState) {
  persistDocs(storageKey('broker', email), state);
}
