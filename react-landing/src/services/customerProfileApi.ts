import { authedRequest as authedRequestBase, ApiError } from './authApi';

/**
 * Customer profile — the real personal + booking data shown on
 * `/customer/profile`. Loosely coupled on purpose: every field is optional so
 * the page keeps rendering (falling back to locally-cached booking-form data)
 * whether or not the backend endpoint is live yet, and a partial payload never
 * blanks the screen. Wire the real endpoint by implementing `GET /customer/profile`
 * per the contract in the block comment at the bottom of this file — no page
 * changes needed.
 */

export interface CustomerAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface CustomerBookingInfo {
  /** Whether this customer has a plot booked at all. */
  has_booking?: boolean;
  project_id?: string | null;
  project_name?: string | null;
  /** e.g. "OPS Divine Greens · Karnal" — used verbatim as the Township value. */
  township_label?: string | null;
  unit_number?: string | null;
  /** Numeric plot area in sq. yd., as a string to preserve trailing decimals. */
  plot_area_sq_yd?: string | null;
  unit_type?: string | null;
  /** ISO 8601 date (YYYY-MM-DD) the plot was booked. */
  booking_date?: string | null;
  /** Total plot consideration in whole rupees. */
  total_consideration?: number | null;
  /** Amount already received from the customer, in whole rupees. */
  amount_received?: number | null;
  /** Optional server-computed schedule; the UI falls back to the default
   * 10/15/25/25/25 split against `total_consideration` when this is absent. */
  payment_schedule?: CustomerScheduleRow[] | null;
}

export interface CustomerScheduleRow {
  label: string;
  percent: number;
  due_days?: number | null;
  /** ISO 8601 date, if the server resolves it against the booking date. */
  due_date?: string | null;
  amount?: number | null;
  /** Free text from the backend, for example paid/due/overdue. */
  status?: string | null;
}

export interface CustomerProfile {
  /** Human-facing reference like "ODG-7695". */
  customer_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** Pre-joined display name; the UI uses this before first/last. */
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Free text ("male" / "Female" / "M" …) — the UI title-cases it. */
  gender?: string | null;
  /** ISO 8601 date (YYYY-MM-DD); the UI computes age from it. */
  date_of_birth?: string | null;
  /** Server-computed age in whole years; preferred over `date_of_birth` when present. */
  age?: number | null;
  address?: CustomerAddress | null;
  /** Optional single-line address; used verbatim when present. */
  address_text?: string | null;
  booking?: CustomerBookingInfo | null;
}

function messageForProfileError(status: number, detail: unknown): string {
  if (status === 401) {
    if (detail === 'missing_token') return 'Please sign in again to view your profile.';
    if (detail === 'token_expired') return 'Your session has expired. Please sign in again.';
    if (detail === 'invalid_token') return 'Please sign in again to continue.';
    return 'Please sign in again to continue.';
  }
  if (status === 403) return 'This profile is only available to the signed-in customer.';
  if (status === 404) return 'We could not find your profile details yet.';
  if (status === 429) return 'Too many profile refreshes. Please wait a minute and try again.';
  if (status === 500) return 'Profile details are temporarily unavailable. Showing saved details where possible.';
  if (status === 405 || status === 501) {
    return 'Profile details are not available yet. Please ask the backend team to enable GET /customer/profile.';
  }
  return 'Could not load your profile right now. Please try again.';
}

/** GET /customer/profile — bearer-authed. Returns the customer's real personal
 * and booking data. Throws {@link ApiError} on any non-2xx. */
export function getCustomerProfile(token: string): Promise<CustomerProfile> {
  return authedRequestBase<CustomerProfile>('/customer/profile', token, messageForProfileError);
}

/** True when the failure means "endpoint not built yet" rather than a real
 * error — lets the page fall back silently to locally-derived data. */
export function isProfileEndpointMissing(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501);
}

export function shouldFallbackToSavedProfile(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status === 404 || err.status === 405 || err.status === 500 || err.status === 501);
}

/* -------------------------------------------------------------------------- *
 *  BACKEND CONTRACT — GET /customer/profile
 * -------------------------------------------------------------------------- *
 *
 *  Request
 *  -------
 *  GET /customer/profile
 *  Headers:
 *    Authorization: Bearer <access_token>        (customer JWT from POST /customer/login)
 *  No query params, no body.
 *
 *  Response 200 (application/json) — all fields optional; send what you have.
 *  --------------------------------------------------------------------------
 *  {
 *    "customer_id": "C00042",
 *    "first_name": "Rahul",
 *    "last_name": "Sharma",
 *    "full_name": "Rahul Sharma",
 *    "email": "rahul.sharma@example.com",
 *    "phone": "+91 98765 43210",
 *    "gender": "male",
 *    "date_of_birth": "1990-04-12",
 *    "age": 35,
 *    "address": {
 *      "line1": "Kothi No. 11, Ganeshwar Dham Road",
 *      "line2": "Karol Bagh",
 *      "city": "New Delhi",
 *      "state": "Delhi",
 *      "pincode": "110005"
 *    },
 *    "address_text": "Kothi No. 11, Ganeshwar Dham Road, Karol Bagh, New Delhi, Delhi 110005",
 *    "booking": {
 *      "has_booking": true,
 *      "project_id": "ops-divine-greens",
 *      "project_name": "OPS Divine Greens",
 *      "township_label": "OPS Divine Greens · Karnal",
 *      "unit_number": "204",
 *      "plot_area_sq_yd": "131.43",
 *      "unit_type": "Residential Plot",
 *      "booking_date": "2025-01-10",
 *      "total_consideration": 1774305,
 *      "amount_received": 700000,
 *      "payment_schedule": [
 *        { "label": "On Booking",                "percent": 10, "due_days": 0,   "due_date": "2025-01-10", "amount": 177431, "status": "paid" },
 *        { "label": "Within 45 days of booking", "percent": 15, "due_days": 45,  "due_date": "2025-02-24", "amount": 266146, "status": "paid" },
 *        { "label": "Within 90 days of booking", "percent": 25, "due_days": 90,  "due_date": "2025-04-10", "amount": 443576, "status": "due"  },
 *        { "label": "Within 180 days of booking","percent": 25, "due_days": 180, "due_date": "2025-07-09", "amount": 443576, "status": "due"  },
 *        { "label": "Within 270 days of booking","percent": 25, "due_days": 270, "due_date": "2025-10-07", "amount": 443577, "status": "due"  }
 *      ]
 *    }
 *  }
 *
 *  `booking` is always present. For no booking, send:
 *    "booking": { "has_booking": false }
 *  If payment exists without a booking form, include amount_received there.
 *
 *  Errors (JSON body: { "detail": "<code>" })
 *  --------------------------------------------------------------------------
 *    401  detail: "missing_token" | "token_expired" | "invalid_token" - prompt re-login
 *    403  detail: "customer_only" - non-customer token
 *    404  detail: "profile_not_found" - treated as "not ready", page falls back
 *    429  detail: "rate_limited" - back off
 *    500  detail: "internal_error" - generic error, page falls back
 *    405 / 501 - endpoint not deployed, page falls back
 * -------------------------------------------------------------------------- */
