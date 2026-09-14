import { ApiError, API_BASE_URL, authedRequest as authedRequestBase } from './authApi';

export type BookingStatus = 'pending_kyc_review' | 'booked' | 'rejected' | 'cancelled';
export type BookingKycStatus = 'pending' | 'verified' | 'needs_resubmission' | 'rejected';

export interface BookingRecord {
  id: string;
  project_name: string;
  unit_number: string;
  amount: number;
  status: BookingStatus;
  kyc_status: BookingKycStatus;
  /** The admin's note from their decision - null until one is made (still
   *  `pending_kyc_review`), not a missing-data bug. Show it to the customer,
   *  especially on `rejected`, so they know why. */
  admin_note: string | null;
  /** Use this directly to enable/disable the receipt button - true only once
   *  status is "booked". Don't re-derive it from status/kyc_status. */
  can_download_receipt: boolean;
  created_at: string;
  last_activity_at: string;
}

function messageForBookingsError(status: number, detail: unknown): string {
  if (status === 0) return 'Could not reach the server. Check your connection and try again.';
  if (status === 401) {
    return detail === 'token_expired'
      ? 'Your session has expired. Please sign in again.'
      : 'Please sign in again to continue.';
  }
  if (status === 403) return 'That booking belongs to a different account.';
  if (status === 404) return 'That booking could not be found.';
  if (status === 400 && detail === 'kyc_not_approved') {
    return 'Your booking is still under KYC review — the receipt unlocks once it is approved.';
  }
  if (status === 429) return 'Too many requests. Please wait a minute and try again.';
  return 'Something went wrong loading your booking. Please try again.';
}

/** A signed-in customer's own bookings, across every status - the source of
 *  truth for what to show while a plot-booking payment is held for KYC review. */
export function listMyBookings(token: string): Promise<BookingRecord[]> {
  return authedRequestBase<BookingRecord[]>('/bookings/mine', token, messageForBookingsError);
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

/** Downloads the booking receipt PDF: `GET /bookings/{id}/receipt`. Only
 *  meaningful once `can_download_receipt` is true - the button calling this
 *  should already be disabled before then, but every failure mode still
 *  throws a typed ApiError so the caller can show a clear message either way. */
export async function fetchBookingReceiptPdf(token: string, bookingId: string): Promise<Blob> {
  const id = bookingId?.trim();
  if (!id) {
    throw new ApiError(400, 'booking_id_required', 'This booking is not available yet, so a receipt cannot be downloaded.');
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/bookings/${encodeURIComponent(id)}/receipt`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      redirect: 'follow',
    });
  } catch {
    throw new ApiError(0, null, messageForBookingsError(0, null));
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    throw new ApiError(res.status, detail, messageForBookingsError(res.status, detail));
  }

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const blob = await res.blob().catch(() => null);

  if (!blob || blob.size === 0) {
    throw new ApiError(502, 'empty_pdf', 'The receipt came back empty. Please try again in a moment.');
  }
  if (contentType && !contentType.includes('application/pdf') && !contentType.includes('octet-stream')) {
    const detail = await blob.text().then((t) => {
      try {
        return (JSON.parse(t) as { detail?: unknown }).detail ?? null;
      } catch {
        return null;
      }
    });
    throw new ApiError(502, detail ?? 'unexpected_response', messageForBookingsError(502, detail));
  }

  return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
}
