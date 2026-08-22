import type { AadhaarExtractedData } from '../services/kycApi';

/** Aadhaar Secure QR dates are DD-MM-YYYY - convert to YYYY-MM-DD for an <input type="date">. */
export function formatAadhaarDob(raw: string | null | undefined): string {
  if (!raw) return '';
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : raw;
}

/** Aadhaar's gender code (M/F/T) mapped onto this app's gender dropdown options. */
export function mapAadhaarGender(raw: string | null | undefined): string {
  if (raw === 'M') return 'Male';
  if (raw === 'F') return 'Female';
  if (raw === 'T') return 'Prefer not to say';
  return '';
}

/** Joins the QR's separate address fields into one address line for the form's
 * free-text "Permanent address" field. */
export function composeAadhaarAddress(data: Partial<AadhaarExtractedData> | null | undefined): string {
  if (!data) return '';
  const parts = [
    data.house,
    data.street,
    data.landmark,
    data.location,
    data.vtc,
    data.postoffice,
    data.subdistrict,
    data.district,
    data.state,
    data.pincode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.join(', ');
}
