import { applicationProjects } from '../data/applicationProjects';
import { ApiError } from './authApi';
import type { GeneratedDocument, UploadGeneratedApplicationPdfInput } from './documentsApi';
import type { InventoryUnit } from './inventoryApi';
import {
  clearBookingUploadCache,
  emptyAadhaarPhotoStatus,
  emptyBookingApplicationFormData,
  emptyBookingApplicationStatus,
  emptyDocStatus,
  emptyPaymentStatus,
  emptySignatureStatus,
  type AadhaarPhotoStatus,
  type CustomerDocState,
  type DocStatus,
  type SignatureStatus,
} from './documentStore';

/**
 * Pure decisions for the per-plot booking flow: every plot booking needs its
 * own Aadhaar verification and its own uploads, and nothing is carried over
 * from a previous booking. Kept out of the page component so it can be tested.
 */

export type IdentityDocKey = 'aadharFront' | 'aadharBack' | 'pan' | 'applicantPhoto' | 'coApplicantPhoto' | 'cancelledCheque';

/** Backend `document_type` of each identity upload, as sent in `kyc_document_ids`. */
export type IdentityDocType = 'aadhaar_front' | 'aadhaar_back' | 'pan_card' | 'applicant_photo' | 'co_applicant_photo' | 'cancelled_cheque';

export interface IdentityDoc {
  key: IdentityDocKey;
  type: IdentityDocType;
  label: string;
  empty: () => AadhaarPhotoStatus | DocStatus | SignatureStatus;
}

/** Single source of truth for the KYC uploads a booking submits. */
export const IDENTITY_DOCS: readonly IdentityDoc[] = [
  { key: 'aadharFront', type: 'aadhaar_front', label: 'Aadhaar front', empty: emptyAadhaarPhotoStatus },
  { key: 'aadharBack', type: 'aadhaar_back', label: 'Aadhaar back', empty: emptyAadhaarPhotoStatus },
  { key: 'pan', type: 'pan_card', label: 'PAN card', empty: emptyDocStatus },
  { key: 'applicantPhoto', type: 'applicant_photo', label: 'Applicant photo', empty: emptyAadhaarPhotoStatus },
  { key: 'coApplicantPhoto', type: 'co_applicant_photo', label: 'Co-applicant photo', empty: emptyAadhaarPhotoStatus },
  { key: 'cancelledCheque', type: 'cancelled_cheque', label: 'Cancelled cheque', empty: emptySignatureStatus },
];

/** The identity uploads this booking must submit. */
export function requiredIdentityDocs(hasCoApplicant: boolean): IdentityDoc[] {
  return IDENTITY_DOCS.filter((doc) => hasCoApplicant || doc.key !== 'coApplicantPhoto');
}

/** `kyc_document_ids` payload for the booking-application upload. */
export function kycDocumentIdsFor(
  docs: CustomerDocState,
  hasCoApplicant: boolean,
): UploadGeneratedApplicationPdfInput['kycDocumentIds'] {
  return Object.fromEntries(
    requiredIdentityDocs(hasCoApplicant).map(({ key, type }) => [type, docs[key].documentId as string]),
  ) as UploadGeneratedApplicationPdfInput['kycDocumentIds'];
}

/** Resets the given uploads to empty so the customer uploads them again. */
export function resetIdentityDocs(docs: CustomerDocState, keys: Iterable<IdentityDocKey>): CustomerDocState {
  const next = { ...docs };
  const wanted = new Set(keys);
  for (const doc of IDENTITY_DOCS) {
    if (wanted.has(doc.key)) Object.assign(next, { [doc.key]: doc.empty() });
  }
  return next;
}

/** A server copy is usable only if it is this account's file of the expected type. */
export function isRemoteDocUsable(remote: GeneratedDocument, expectedId: string, ownerId: string, type: IdentityDocType): boolean {
  return remote.id === expectedId && remote.owner_id === ownerId && remote.document_type === type && !!remote.signed_url;
}

/** 403/404 mean the file is gone or not ours; anything else is a transient failure. */
function isMissingDocumentError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 404);
}

export type FetchDocument = (documentId: string) => Promise<GeneratedDocument>;

/**
 * Confirms every required upload with the server right before submission.
 * Returns the uploads that must be redone. Re-throws 401 so the caller can
 * sign the user out; other network failures become a retryable error.
 */
export async function findUnusableIdentityDocs(
  docs: CustomerDocState,
  hasCoApplicant: boolean,
  ownerId: string,
  fetchDocument: FetchDocument,
): Promise<IdentityDoc[]> {
  const checked = await Promise.all(
    requiredIdentityDocs(hasCoApplicant).map(async (doc) => {
      const documentId = docs[doc.key].documentId;
      if (!documentId) return { doc, usable: false };
      try {
        return { doc, usable: isRemoteDocUsable(await fetchDocument(documentId), documentId, ownerId, doc.type) };
      } catch (err) {
        if (isMissingDocumentError(err)) return { doc, usable: false };
        if (err instanceof ApiError && err.status === 401) throw err;
        throw new Error('Could not verify your saved documents with the server. Check your connection and try again.');
      }
    }),
  );
  return checked.filter(({ usable }) => !usable).map(({ doc }) => doc);
}

/** True when the upload has no local copy and its signed URL is missing or about to expire. */
export function needsSignedUrlRefresh(
  doc: { documentId: string | null; dataUrl: string | null; signedUrl: string | null; signedUrlExpiresAt: number | null },
  now: number,
): boolean {
  return !!doc.documentId && !doc.dataUrl && (!doc.signedUrl || !doc.signedUrlExpiresAt || doc.signedUrlExpiresAt <= now + 60_000);
}

export const UNAVAILABLE_UPLOAD_MESSAGE = 'This saved upload is not available on this account. Upload it again for this booking.';

export type IdentityDocRefresh =
  | { key: IdentityDocKey; documentId: string; result: 'unavailable' }
  | { key: IdentityDocKey; documentId: string; result: 'refreshed'; signedUrl: string; signedUrlExpiresAt: number };

/**
 * On entering the application page, fetch fresh signed URLs only for uploads
 * that need one (no requests when every link is fresh). A file that turns out
 * to be missing or not this account's is reported as unavailable; transient
 * failures are skipped (submission re-checks every upload anyway).
 */
export async function refreshStaleIdentityDocs(
  docs: CustomerDocState,
  ownerId: string,
  fetchDocument: FetchDocument,
  now: number,
): Promise<IdentityDocRefresh[]> {
  const stale = IDENTITY_DOCS.filter((doc) => needsSignedUrlRefresh(docs[doc.key], now));
  const results = await Promise.all(
    stale.map(async (doc): Promise<IdentityDocRefresh | null> => {
      const documentId = docs[doc.key].documentId as string;
      try {
        const remote = await fetchDocument(documentId);
        if (!isRemoteDocUsable(remote, documentId, ownerId, doc.type)) return { key: doc.key, documentId, result: 'unavailable' };
        return {
          key: doc.key,
          documentId,
          result: 'refreshed',
          signedUrl: remote.signed_url,
          signedUrlExpiresAt: now + remote.signed_url_expires_in * 1000,
        };
      } catch (err) {
        return isMissingDocumentError(err) ? { key: doc.key, documentId, result: 'unavailable' } : null;
      }
    }),
  );
  return results.filter((refresh): refresh is IdentityDocRefresh => refresh !== null);
}

/**
 * Applies refresh results to the *latest* state, skipping any upload the
 * customer replaced while the requests were in flight. Returns null when
 * nothing changed.
 */
export function applyIdentityDocRefresh(docs: CustomerDocState, refreshes: IdentityDocRefresh[]): CustomerDocState | null {
  let next: CustomerDocState | null = null;
  for (const refresh of refreshes) {
    const doc = IDENTITY_DOCS.find(({ key }) => key === refresh.key) as IdentityDoc;
    const current = (next ?? docs)[refresh.key];
    if (current.documentId !== refresh.documentId) continue;
    next = { ...(next ?? docs) };
    Object.assign(next, {
      [refresh.key]:
        refresh.result === 'unavailable'
          ? { ...doc.empty(), error: UNAVAILABLE_UPLOAD_MESSAGE }
          : { ...current, signedUrl: refresh.signedUrl, signedUrlExpiresAt: refresh.signedUrlExpiresAt, error: null },
    });
  }
  return next;
}

/** What to do when "Book Plot" hands a unit to the application wizard. */
export type IncomingUnitDecision =
  /** Same plot (or no booking underway): keep the wizard as it is. */
  | 'continue'
  /** A different plot while a paid booking is not yet submitted: refuse, so the paid one isn't lost. */
  | 'blocked'
  /** A different plot: start a completely fresh booking. */
  | 'new-booking';

export function decideIncomingUnit(docs: CustomerDocState, unit: Pick<InventoryUnit, 'id' | 'unit_number'>): IncomingUnitDecision {
  const booking = docs.bookingApplication;
  const incomingUnitLabel = unit.unit_number ?? '';
  const currentUnitLabel = booking.inventoryUnitNumber ?? booking.formData.unitNo ?? '';
  const isSamePlot =
    (!!unit.id && !!booking.inventoryId && unit.id === booking.inventoryId) ||
    (!!incomingUnitLabel && incomingUnitLabel === currentUnitLabel);
  const hasActiveBooking = !!booking.inventoryId || !!booking.formData.projectId;
  if (!hasActiveBooking || isSamePlot) return 'continue';
  // Paid but never submitted: the application isn't on the server yet, so
  // wiping it would strand the payment. Once submitted (backendDocumentId set),
  // the server holds the booking and the customer may start another plot.
  if (docs.payment.status === 'paid' && !booking.backendDocumentId) return 'blocked';
  return 'new-booking';
}

export const BLOCKED_NEW_PLOT_MESSAGE =
  'You have a paid plot booking that has not been submitted yet. Generate and submit its application (last page) before booking another plot.';

/**
 * A brand-new booking for `unit`: Aadhaar verification, every upload,
 * signatures, payment and all application details are cleared. Only the
 * chosen plot's own details are filled in.
 */
export function startNewPlotBooking(
  docs: CustomerDocState,
  unit: Pick<InventoryUnit, 'id' | 'project_name' | 'unit_number' | 'area_sqyd' | 'area_sqmt' | 'unit_type'>,
): CustomerDocState {
  const matchedProject = applicationProjects.find(
    (project) => unit.project_name && project.label.toLowerCase().includes(unit.project_name.toLowerCase()),
  );
  return {
    ...clearBookingUploadCache(docs),
    bookingApplication: {
      ...emptyBookingApplicationStatus(),
      formData: {
        ...emptyBookingApplicationFormData(),
        ...(matchedProject ? { projectId: matchedProject.id } : {}),
        unitNo: unit.unit_number ?? '',
        plotAreaSqYd: unit.area_sqyd != null ? String(unit.area_sqyd) : '',
        plotAreaSqMtr: unit.area_sqmt != null ? String(unit.area_sqmt) : '',
        unitType: unit.unit_type ?? '',
      },
      inventoryId: unit.id ?? null,
      inventoryUnitNumber: unit.unit_number ?? null,
    },
    payment: emptyPaymentStatus(),
  };
}

export const KYC_LINK_WARNING =
  'Your application was submitted, but the server could not link all KYC documents and the Aadhaar verification to this booking. Please do not submit it again â€” our team will follow up, or contact support.';

/**
 * Records a booking-application upload the server accepted. The submission is
 * always persisted (so it is never re-uploaded for the same payment); if the
 * server reports the KYC links failed, a warning is returned for display.
 */
export function applySubmissionResult(
  docs: CustomerDocState,
  backendDoc: GeneratedDocument,
  submitted: { fileName: string; pdfDataUrl: string; now: number },
): { state: CustomerDocState; warning: string | null } {
  const bookingId = backendDoc.booking_id ?? null;
  const kycDocumentsAttached = backendDoc.kyc_documents_attached === true && !!bookingId;
  const aadhaarVerificationAttached = backendDoc.aadhaar_verification_attached === true && !!bookingId;
  const linkFailed = backendDoc.kyc_documents_attached === false || backendDoc.aadhaar_verification_attached === false;
  const state: CustomerDocState = {
    ...docs,
    bookingApplication: {
      ...docs.bookingApplication,
      generatedAt: new Date(submitted.now).toISOString(),
      pdfFileName: submitted.fileName,
      pdfDataUrl: submitted.pdfDataUrl,
      backendDocumentId: backendDoc.id,
      bookingId,
      kycDocumentsAttached,
      aadhaarVerificationAttached,
      signedUrl: backendDoc.signed_url,
      signedUrlExpiresAt: submitted.now + backendDoc.signed_url_expires_in * 1000,
      paymentPlan: backendDoc.payment_plan ?? docs.bookingApplication.paymentPlan,
      error: linkFailed ? KYC_LINK_WARNING : null,
    },
    payment: backendDoc.inventory_status ? { ...docs.payment, inventoryStatus: backendDoc.inventory_status } : docs.payment,
  };
  return { state, warning: linkFailed ? KYC_LINK_WARNING : null };
}

/** Aadhaar must be verified for this booking by the signed-in account. */
export function hasCurrentAadhaarVerification(docs: CustomerDocState, ownerId: string | null | undefined): boolean {
  return !!ownerId && docs.aadhar.verified && !!docs.aadhar.verificationId && docs.aadhar.verifiedOwnerId === ownerId;
}
