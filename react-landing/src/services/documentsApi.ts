import { ApiError, authedRequest as authedRequestBase } from './authApi';

export interface GeneratedDocument {
  id: string;
  owner_id: string;
  owner_role: string;
  document_type: string;
  status: string;
  created_date: string;
  signed_url: string;
  signed_url_expires_in: number;
}

export interface GenerateDocumentInput {
  document_type: string;
  form_data: Record<string, string | number>;
}

export interface UploadGeneratedApplicationPdfInput {
  file: File;
  projectId: string;
  paymentId: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  formData: Record<string, string | number>;
}

export type AadhaarPhotoSide = 'front' | 'back';

function messageForDocumentsError(status: number, detail: unknown): string {
  if (status === 401) {
    if (detail === 'missing_token') return 'Please sign in before uploading the application PDF.';
    if (detail === 'invalid_token') return 'Your session is invalid. Please sign in again.';
    if (detail === 'token_expired') return 'Your session has expired. Please sign in again.';
    return 'Please sign in again to continue.';
  }
  if (status === 403) return 'This payment belongs to a different user. Please use the correct customer account.';
  if (status === 404) return 'That document could not be found.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 400) {
    if (detail === 'empty_file') return 'The generated PDF is empty. Please try generating it again.';
    if (detail === 'file_too_large') return 'The generated PDF is larger than 15 MB. Please contact support.';
    if (detail === 'unsupported_file_type') return 'The generated file is not a valid PDF. Please generate it again.';
    if (detail === 'document_type_required') return 'Document type is missing. Please refresh and try again.';
    if (detail === 'project_id_required') return 'Project is missing. Please select the project and try again.';
    if (detail === 'payment_id_required') return 'Payment reference is missing. Please complete payment again before generating the PDF.';
    if (detail === 'invalid_form_data') return 'Application form data could not be uploaded. Please refresh and try again.';
    if (detail === 'payment_not_found') return 'Payment record was not found. Please complete payment again before generating the PDF.';
    if (detail === 'payment_not_completed') return 'Payment is not completed yet. Please wait for confirmation before generating the PDF.';
    if (detail === 'payment_mismatch') return 'Payment verification details do not match. Please contact support before generating the PDF.';
    if (typeof detail === 'string' && detail.startsWith('documents_incomplete:')) {
      return 'Upload your Aadhaar front, Aadhaar back, and PAN card photos before generating this document.';
    }
  }
  if (typeof detail === 'string' && detail.startsWith('storage_')) {
    if (detail === 'storage_not_configured') return 'Document storage is not configured on the server. Please contact support.';
    if (detail.startsWith('storage_upload_failed:')) return 'Storage upload failed. Please try generating the PDF again.';
    if (detail.startsWith('storage_sign_failed:')) return 'The PDF uploaded, but the download link could not be created. Please try opening it later.';
    return 'Something went wrong uploading your document. Please try again.';
  }
  if (status === 422) return 'Required upload fields are missing. Please refresh and try again.';
  if (status === 502) return 'Document storage is temporarily unavailable. Please try again.';
  if (status === 500) return 'The server could not save the application PDF. Please try again.';
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

/** Uploads a raw Aadhaar front/back photo straight to storage for later use in document
 * generation - no parsing or KYC verification, unlike kycApi's verifyAadhaarQr. */
export function uploadAadhaarPhoto(token: string, file: File, side: AadhaarPhotoSide): Promise<GeneratedDocument> {
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
  formData.append('form_data', JSON.stringify(input.formData));
  if (input.razorpayOrderId) formData.append('razorpay_order_id', input.razorpayOrderId);
  if (input.razorpayPaymentId) formData.append('razorpay_payment_id', input.razorpayPaymentId);
  return authedRequest<GeneratedDocument>('/documents/project-booking-application', token, {
    method: 'POST',
    body: formData,
  });
}
