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

export interface GeneratedDocStatus {
  generated: boolean;
  generatedAt: string | null;
  applicantName: string | null;
  signatureVerified: boolean;
  documentId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: number | null;
}

export interface CustomerDocState {
  aadhar: AadhaarStatus;
  pan: DocStatus;
  generatedDoc: GeneratedDocStatus;
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
  visits: ScheduledVisit[];
}

export function emptyDocStatus(): DocStatus {
  return { fileName: null, fileSize: null, uploadedAt: null, verified: false, verifiedAt: null };
}

function storageKey(kind: 'customer' | 'broker', email: string) {
  return `dvi_docs_${kind}_${email.toLowerCase()}`;
}

export function loadCustomerDocs(email: string): CustomerDocState {
  try {
    const raw = localStorage.getItem(storageKey('customer', email));
    if (!raw) throw new Error('none');
    return JSON.parse(raw) as CustomerDocState;
  } catch {
    return {
      aadhar: emptyAadhaarStatus(),
      pan: emptyDocStatus(),
      generatedDoc: {
        generated: false,
        generatedAt: null,
        applicantName: null,
        signatureVerified: false,
        documentId: null,
        signedUrl: null,
        signedUrlExpiresAt: null,
      },
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
    return JSON.parse(raw) as BrokerDocState;
  } catch {
    return { aadhar: emptyAadhaarStatus(), visits: [] };
  }
}

export function saveBrokerDocs(email: string, state: BrokerDocState) {
  localStorage.setItem(storageKey('broker', email), JSON.stringify(state));
}
