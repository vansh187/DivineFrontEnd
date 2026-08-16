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
  /** Set once the file has actually reached storage (POST /documents/pan-photo) - fileName
   * alone can be set optimistically before the upload confirms. */
  documentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
  error: string | null;
}

/** Aadhaar now verifies against the real UIDAI-backed /kyc/aadhaar/* API —
 * a single request either verifies or fails outright, so unlike DocStatus
 * there's no "uploaded, pending verification" middle state. */
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
  amount: number | null;
  status: 'created' | 'paid' | 'failed' | null;
  method: 'razorpay' | 'cash' | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  error: string | null;
}

export function emptyPaymentStatus(): PaymentStatus {
  return { amount: null, status: null, method: null, razorpayOrderId: null, razorpayPaymentId: null, paidAt: null, error: null };
}

export interface CustomerDocState {
  aadhar: AadhaarStatus;
  aadharFront: AadhaarPhotoStatus;
  aadharBack: AadhaarPhotoStatus;
  pan: DocStatus;
  generatedDoc: GeneratedDocStatus;
  payment: PaymentStatus;
}

export interface ScheduledVisit {
  id: string;
  customerName: string;
  customerContact: string;
  date: string;
  time: string;
  notes: string;
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

export function loadCustomerDocs(email: string): CustomerDocState {
  try {
    const raw = localStorage.getItem(storageKey('customer', email));
    if (!raw) throw new Error('none');
    // Partial<> because state cached before aadharFront/aadharBack existed won't have
    // them - back-fill defaults rather than trust the cast and hand back `undefined`.
    const parsed = JSON.parse(raw) as Partial<CustomerDocState>;
    return {
      aadhar: parsed.aadhar ?? emptyAadhaarStatus(),
      aadharFront: parsed.aadharFront ?? emptyAadhaarPhotoStatus(),
      aadharBack: parsed.aadharBack ?? emptyAadhaarPhotoStatus(),
      // Spread over the defaults (not just `??`) so state cached before documentId/
      // signedUrl/error existed on DocStatus still back-fills those specific fields.
      pan: { ...emptyDocStatus(), ...parsed.pan },
      generatedDoc: parsed.generatedDoc ?? emptyGeneratedDocStatus(),
      payment: { ...emptyPaymentStatus(), ...parsed.payment },
    };
  } catch {
    return {
      aadhar: emptyAadhaarStatus(),
      aadharFront: emptyAadhaarPhotoStatus(),
      aadharBack: emptyAadhaarPhotoStatus(),
      pan: emptyDocStatus(),
      generatedDoc: emptyGeneratedDocStatus(),
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
      aadharFront: parsed.aadharFront ?? emptyAadhaarPhotoStatus(),
      aadharBack: parsed.aadharBack ?? emptyAadhaarPhotoStatus(),
      visits: parsed.visits ?? [],
    };
  } catch {
    return { aadhar: emptyAadhaarStatus(), aadharFront: emptyAadhaarPhotoStatus(), aadharBack: emptyAadhaarPhotoStatus(), visits: [] };
  }
}

export function saveBrokerDocs(email: string, state: BrokerDocState) {
  localStorage.setItem(storageKey('broker', email), JSON.stringify(state));
}
