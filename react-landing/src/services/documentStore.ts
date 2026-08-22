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
  verifiedAt: string | null;
  method: 'qr' | 'offline_xml' | null;
  maskedAadhaar: string | null;
  name: string | null;
  lastAttemptError: string | null;
}

export function emptyAadhaarStatus(): AadhaarStatus {
  return { verified: false, verifiedAt: null, method: null, maskedAadhaar: null, name: null, lastAttemptError: null };
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

/** A payment (online via Razorpay, or cash recorded in person) - "paid" is only ever set
 * after the backend confirms it (Razorpay's signature check, or the cash-entry response
 * itself since cash settles immediately), never from client-side say-so. */
export interface PaymentStatus {
  paymentId: string | null;
  amount: number | null;
  status: 'created' | 'paid' | 'failed' | null;
  method: 'razorpay' | 'cash' | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  error: string | null;
}

export function emptyPaymentStatus(): PaymentStatus {
  return { paymentId: null, amount: null, status: null, method: null, razorpayOrderId: null, razorpayPaymentId: null, paidAt: null, error: null };
}

export interface SignatureStatus {
  fileName: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  dataUrl: string | null;
  error: string | null;
}

export function emptySignatureStatus(): SignatureStatus {
  return { fileName: null, fileSize: null, uploadedAt: null, dataUrl: null, error: null };
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
  unitNo: string;
  plotAreaSqYd: string;
  plotAreaSqMtr: string;
  unitType: string;
  ratePerSqYd: string;
  basicSalePrice: string;
  plcRatePerSqYd: string;
  plcPrice: string;
  totalAmount: string;
  amountInFigure: string;
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
  generatedAt: string | null;
  pdfFileName: string | null;
  pdfDataUrl: string | null;
  backendDocumentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
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
    unitNo: '',
    plotAreaSqYd: '',
    plotAreaSqMtr: '',
    unitType: '',
    ratePerSqYd: '',
    basicSalePrice: '',
    plcRatePerSqYd: '',
    plcPrice: '',
    totalAmount: '',
    amountInFigure: '',
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
    generatedAt: null,
    pdfFileName: null,
    pdfDataUrl: null,
    backendDocumentId: null,
    signedUrl: null,
    signedUrlExpiresAt: null,
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
  generatedDoc: GeneratedDocStatus;
  bookingApplication: BookingApplicationStatus;
  payment: PaymentStatus;
}

export interface ScheduledVisit {
  id: string;
  customerName: string;
  customerContact: string;
  date: string;
  time: string;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface BrokerDocState {
  aadhar: AadhaarStatus;
  aadharFront: AadhaarPhotoStatus;
  aadharBack: AadhaarPhotoStatus;
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
      aadhar: parsed.aadhar ?? emptyAadhaarStatus(),
      aadharFront: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharFront },
      aadharBack: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharBack },
      // Spread over the defaults (not just `??`) so state cached before documentId/
      // signedUrl/error existed on DocStatus still back-fills those specific fields.
      pan: { ...emptyDocStatus(), ...parsed.pan },
      applicantPhoto: { ...emptyAadhaarPhotoStatus(), ...parsed.applicantPhoto },
      coApplicantPhoto: { ...emptyAadhaarPhotoStatus(), ...parsed.coApplicantPhoto },
      applicantSignature: { ...emptySignatureStatus(), ...(parsed.applicantSignature ?? parsed.signature) },
      coApplicantSignature: { ...emptySignatureStatus(), ...parsed.coApplicantSignature },
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
      generatedDoc: emptyGeneratedDocStatus(),
      bookingApplication: emptyBookingApplicationStatus(),
      payment: emptyPaymentStatus(),
    };
  }
}

export function saveCustomerDocs(email: string, state: CustomerDocState) {
  localStorage.setItem(storageKey('customer', email), JSON.stringify(state));
}

export function loadBrokerDocs(email: string): BrokerDocState {
  try {
    const raw = localStorage.getItem(storageKey('broker', email));
    if (!raw) throw new Error('none');
    const parsed = JSON.parse(raw) as Partial<BrokerDocState>;
    return {
      aadhar: parsed.aadhar ?? emptyAadhaarStatus(),
      aadharFront: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharFront },
      aadharBack: { ...emptyAadhaarPhotoStatus(), ...parsed.aadharBack },
      visits: normalizeVisits(parsed.visits),
    };
  } catch {
    return { aadhar: emptyAadhaarStatus(), aadharFront: emptyAadhaarPhotoStatus(), aadharBack: emptyAadhaarPhotoStatus(), visits: [] };
  }
}

export function saveBrokerDocs(email: string, state: BrokerDocState) {
  localStorage.setItem(storageKey('broker', email), JSON.stringify(state));
}
