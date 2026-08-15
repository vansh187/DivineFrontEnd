import { ApiError, API_BASE_URL } from './authApi';

export interface AadhaarExtractedData {
  email_mobile_status: string;
  name: string;
  dob: string;
  gender: string;
  careof: string;
  district: string;
  landmark: string;
  house: string;
  location: string;
  pincode: string;
  postoffice: string;
  state: string;
  street: string;
  subdistrict: string;
  vtc: string;
  aadhaar_last_4_digit: string;
  aadhaar_last_digit: string;
  email: boolean;
  mobile: boolean;
}

export interface AadhaarVerifyResult {
  id: string;
  owner_id: string;
  owner_role: string;
  method: 'qr' | 'offline_xml';
  verified: boolean;
  masked_aadhaar: string;
  extracted_data: AadhaarExtractedData;
  failure_reason: string | null;
  created_date: string;
}

function messageForKycError(status: number, detail: unknown): string {
  if (status === 401) {
    return detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 400) {
    if (detail === 'empty_file') return 'That file is empty. Please choose a different file.';
    if (detail === 'file_too_large') return 'That file is larger than 8 MB. Please choose a smaller file.';
    if (detail === 'unreadable_image') return "We couldn't read that image. Please upload a clear JPG or PNG.";
    if (detail === 'qr_not_found') return "We couldn't find a QR code in that photo. Try a clearer, well-lit photo with the card held flat.";
    if (detail === 'unsupported_qr_format') return "That QR code isn't a valid Aadhaar Secure QR code.";
    if (typeof detail === 'string' && detail.startsWith('qr_parse_failed')) return "We found a QR code but couldn't read it clearly. Please try a different photo.";
    if (detail === 'missing_share_code') return 'Enter your share code.';
    if (typeof detail === 'string' && detail.startsWith('xml_parse_failed')) return 'That share code or file looks incorrect. Please check both and try again.';
    return 'Please check the file you uploaded and try again.';
  }
  if (status === 409) return 'Something went wrong. Please try again.';
  if (status === 422) return 'Please check the details you entered.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 500) {
    if (typeof detail === 'string' && detail.includes('CERT_PEM')) return 'Verification is temporarily unavailable. Please try again later.';
    return 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

async function multipartRequest<T>(path: string, token: string, formData: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      // No Content-Type here — the browser sets the multipart boundary itself.
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch {
    throw new ApiError(0, null, 'Could not reach the server. Check your connection and try again.');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new ApiError(res.status, detail, messageForKycError(res.status, detail));
  }

  return data as T;
}

export function verifyAadhaarQr(token: string, file: File): Promise<AadhaarVerifyResult> {
  const formData = new FormData();
  formData.append('file', file);
  return multipartRequest<AadhaarVerifyResult>('/kyc/aadhaar/qr/verify', token, formData);
}

export function verifyAadhaarXml(token: string, file: File, shareCode: string): Promise<AadhaarVerifyResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('share_code', shareCode);
  return multipartRequest<AadhaarVerifyResult>('/kyc/aadhaar/xml/verify', token, formData);
}
