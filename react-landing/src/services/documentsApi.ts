import { ApiError, API_BASE_URL, authedRequest as authedRequestBase } from './authApi';
import type { PaymentPlan } from './customerProfileApi';

export interface GeneratedDocument {
  id: string;
  owner_id: string;
  owner_role: string;
  document_type: string;
  status: string;
  created_date: string;
  signed_url: string;
  signed_url_expires_in: number;
  /** Present on a booking-application upload: the derived payment plan
   * (On Booking + 45/90/180/270-day milestones). */
  payment_plan?: PaymentPlan | null;
  /** Booking-application upload only: the inventory unit this booking locked, and
   * the outcome of that lock. `conflict` means the plot was already taken - the
   * document is still saved and the payment is under manual review server-side. */
  inventory_id?: string | null;
  inventory_status?: 'booked' | 'conflict' | null;
}

export interface GenerateDocumentInput {
  document_type: string;
  form_data: Record<string, string | number>;
}

export interface UploadGeneratedApplicationPdfInput {
  file: File;
  projectId: string;
  paymentId: string;
  /** Inventory unit id of the booked plot. Safety-net for the booked lock - a
   * no-op when the booking payment already locked the plot. */
  inventoryId?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  formData: Record<string, string | number>;
}

export type AadhaarPhotoSide = 'front' | 'back';

/** Backend keys used in "documents_incomplete:<key>,<key>,..." — kept in sync
 * with _REQUIRED_PHOTO_DOCUMENT_TYPES in the backend's service_document.py. */
const MISSING_DOCUMENT_LABELS: Record<string, string> = {
  aadhaar_front: 'Aadhaar front photo',
  aadhaar_back: 'Aadhaar back photo',
  pan_card: 'PAN card photo',
  applicant_photo: 'Applicant photo',
  co_applicant_photo: 'Co-Applicant photo',
};

function messageForDocumentsError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
  if (status === 401) {
    if (detail === 'missing_token') return 'Please sign in before uploading documents.';
    if (detail === 'invalid_token') return 'Your session is invalid. Please sign in again.';
    if (detail === 'token_expired') return 'Your session has expired. Please sign in again.';
    return 'Please sign in again to continue.';
  }
  if (status === 403) return 'You can only upload documents for your own account.';
  if (status === 404) {
    if (detail === 'demand_letter_not_available' || detail === 'letter_not_generated')
      return 'The demand letter is not ready for this booking yet. Please try again shortly.';
    return 'That document could not be found.';
  }
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 400) {
    if (detail === 'empty_file') return 'That file is empty. Please choose a different file.';
    if (detail === 'file_too_large') return 'That file is too large. Please upload a file under 15 MB.';
    if (detail === 'unsupported_file_type') return 'Please upload a JPG, PNG, or generated PDF file.';
    if (detail === 'side_required') return 'Please choose whether this is the Aadhaar front or back photo.';
    if (detail === 'invalid_side') return 'Please upload the Aadhaar front and back photos separately.';
    if (detail === 'document_type_required') return 'Document type is missing. Please refresh and try again.';
    if (detail === 'project_id_required') return 'Project is missing. Please select the project and try again.';
    if (detail === 'payment_id_required') return 'Payment reference is missing. Please complete payment again before generating the PDF.';
    if (detail === 'total_amount_required')
      return 'Enter the Total Plot Amount on the Pricing page before generating the application PDF.';
    if (detail === 'booking_amount_exceeds_total')
      return 'The Total Plot Amount is less than the booking amount already paid. Please correct it on the Pricing page.';
    if (detail === 'not_a_booking_application' || detail === 'wrong_document_type')
      return 'A demand letter is only available for a booking application document.';
    if (detail === 'payment_plan_missing' || detail === 'no_payment_plan')
      return 'The payment plan for this booking is not ready yet. Please try again after it is generated.';
    if (detail === 'invalid_form_data') return 'Application form data could not be uploaded. Please refresh and try again.';
    if (detail === 'payment_not_found') return 'Payment record was not found. Please complete payment again before generating the PDF.';
    if (detail === 'payment_not_completed') return 'Payment is not completed yet. Please wait for confirmation before generating the PDF.';
    if (detail === 'payment_mismatch') return 'Payment verification details do not match. Please contact support before generating the PDF.';
    if (typeof detail === 'string' && detail.startsWith('documents_incomplete:')) {
      const missingKeys = detail.slice('documents_incomplete:'.length).split(',').filter(Boolean);
      const labels = missingKeys.map((key) => MISSING_DOCUMENT_LABELS[key] ?? key);
      return `Upload ${labels.join(', ')} before generating this document.`;
    }
  }
  if (typeof detail === 'string' && detail.startsWith('storage_')) {
    if (detail === 'storage_not_configured') return 'Document storage is not configured on the server. Please contact support.';
    if (detail.startsWith('storage_upload_failed:')) return 'Storage upload failed. Please try uploading the file again.';
    if (detail.startsWith('storage_sign_failed:')) return 'The file uploaded, but the download link could not be created. Please try opening it later.';
    return 'Something went wrong uploading your document. Please try again.';
  }
  if (status === 422) return 'Required upload fields are missing. Please refresh and try again.';
  if (status === 502) return 'Document storage is temporarily unavailable. Please try again.';
  if (status === 500) return 'The server could not save the document. Please try again.';
  return 'Something went wrong. Please try again.';
}

function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return authedRequestBase<T>(path, token, messageForDocumentsError, init);
}

export function generateDocument(token: string, input: GenerateDocumentInput): Promise<GeneratedDocument> {
  return authedRequest<GeneratedDocument>('/documents/generate', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getDocument(token: string, documentId: string): Promise<GeneratedDocument> {
  return authedRequest<GeneratedDocument>(`/documents/${documentId}`, token);
}

export function getLatestDocumentByType(token: string, documentType: string): Promise<GeneratedDocument> {
  return authedRequest<GeneratedDocument>(`/documents/latest/${encodeURIComponent(documentType)}`, token);
}

/** Uploads a raw Aadhaar front/back photo straight to storage for later use in document
 * generation - no parsing or KYC verification, unlike kycApi's verifyAadhaarQr. */
export function uploadAadhaarPhoto(token: string, file: File, side: AadhaarPhotoSide): Promise<GeneratedDocument> {
  if (!file.size) throw new ApiError(400, 'empty_file', messageForDocumentsError(400, 'empty_file'));
  if (file.size > 15 * 1024 * 1024) throw new ApiError(400, 'file_too_large', messageForDocumentsError(400, 'file_too_large'));
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new ApiError(400, 'unsupported_file_type', messageForDocumentsError(400, 'unsupported_file_type'));
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('side', side);
  return authedRequest<GeneratedDocument>('/documents/aadhaar-photo', token, {
    method: 'POST',
    // No Content-Type here - the browser sets the multipart boundary itself.
    body: formData,
  });
}

/** Uploads a raw PAN card photo straight to storage for later use in document generation -
 * no parsing or verification, same storage-only pattern as uploadAadhaarPhoto. */
export function uploadPanPhoto(token: string, file: File): Promise<GeneratedDocument> {
  const formData = new FormData();
  formData.append('file', file);
  return authedRequest<GeneratedDocument>('/documents/pan-photo', token, {
    method: 'POST',
    body: formData,
  });
}

const MAX_APPLICANT_PHOTO_BYTES = 8 * 1024 * 1024; // matches the backend's MAX_PHOTO_UPLOAD_BYTES

function validatePhotoFile(file: File) {
  if (!file.size) throw new ApiError(400, 'empty_file', messageForDocumentsError(400, 'empty_file'));
  if (file.size > MAX_APPLICANT_PHOTO_BYTES) throw new ApiError(400, 'file_too_large', messageForDocumentsError(400, 'file_too_large'));
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new ApiError(400, 'unsupported_file_type', messageForDocumentsError(400, 'unsupported_file_type'));
  }
}

/** Uploads the applicant's own photo - placed on the right-hand side of the "Applicant
 * Details" page of the generated booking application PDF. Required (along with the
 * co-applicant photo, Aadhaar front/back, and PAN) before /documents/generate will
 * render a booking_application document. */
// async so a validatePhotoFile() rejection is delivered through the returned
// promise's .catch (callers attach .then/.catch/.finally) rather than thrown
// synchronously before the chain is built.
export async function uploadApplicantPhoto(token: string, file: File): Promise<GeneratedDocument> {
  validatePhotoFile(file);
  const formData = new FormData();
  formData.append('file', file);
  return authedRequest<GeneratedDocument>('/documents/applicant-photo', token, {
    method: 'POST',
    body: formData,
  });
}

/** Same as uploadApplicantPhoto, for the co-applicant's photo (placed on the
 * "Co-Applicant Details" page). */
export async function uploadCoApplicantPhoto(token: string, file: File): Promise<GeneratedDocument> {
  validatePhotoFile(file);
  const formData = new FormData();
  formData.append('file', file);
  return authedRequest<GeneratedDocument>('/documents/co-applicant-photo', token, {
    method: 'POST',
    body: formData,
  });
}

/** Uploads the customer-generated booking application PDF to backend storage.
 * Backend should persist this file in Supabase Storage and return the document row
 * with a signed URL, matching the other document endpoints. */
export function uploadGeneratedApplicationPdf(token: string, input: UploadGeneratedApplicationPdfInput): Promise<GeneratedDocument> {
  if (!input.paymentId) throw new ApiError(400, 'payment_id_required', messageForDocumentsError(400, 'payment_id_required'));
  if (!input.file.size) throw new ApiError(400, 'empty_file', messageForDocumentsError(400, 'empty_file'));
  if (input.file.size > 15 * 1024 * 1024) throw new ApiError(400, 'file_too_large', messageForDocumentsError(400, 'file_too_large'));
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('document_type', 'project_booking_application');
  formData.append('project_id', input.projectId);
  formData.append('payment_id', input.paymentId);
  if (input.inventoryId) formData.append('inventory_id', input.inventoryId);
  formData.append('form_data', JSON.stringify(input.formData));
  if (input.razorpayOrderId) formData.append('razorpay_order_id', input.razorpayOrderId);
  if (input.razorpayPaymentId) formData.append('razorpay_payment_id', input.razorpayPaymentId);
  return authedRequest<GeneratedDocument>('/documents/project-booking-application', token, {
    method: 'POST',
    body: formData,
  });
}

/** Best-effort extraction of a FastAPI-style `{ detail }` from a non-OK response
 *  whose body may be JSON, plain text, or HTML. */
async function readErrorDetail(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    return parsed?.detail ?? null;
  } catch {
    return null;
  }
}

/**
 * Downloads the server-rendered demand letter for a booking-application
 * document: `GET /documents/{id}/demand-letter` → application/pdf.
 * Throws a typed `ApiError` for every failure mode (network, auth, ownership,
 * not-found / not-ready, rate limit, server error, empty or non-PDF body) so
 * the caller can decide whether to surface it or fall back to a local render.
 */
export async function fetchDemandLetterPdf(token: string, documentId: string): Promise<Blob> {
  const id = documentId?.trim();
  if (!id) {
    throw new ApiError(400, 'document_id_required', 'This booking has not been submitted yet, so a demand letter is not available.');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(id)}/demand-letter`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      redirect: 'follow',
    });
  } catch {
    throw new ApiError(0, null, messageForDocumentsError(0, null));
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new ApiError(res.status, detail, messageForDocumentsError(res.status, detail));
  }

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const blob = await res.blob().catch(() => null);

  if (!blob || blob.size === 0) {
    throw new ApiError(502, 'empty_pdf', 'The demand letter came back empty. Please try again in a moment.');
  }
  // A 200 that isn't a PDF is usually an error page or JSON that slipped through.
  if (contentType && !contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
    const detail = await blob.text().then((t) => {
      try {
        return (JSON.parse(t) as { detail?: unknown }).detail ?? null;
      } catch {
        return null;
      }
    });
    throw new ApiError(502, detail ?? 'unexpected_response', messageForDocumentsError(502, detail));
  }

  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
}
