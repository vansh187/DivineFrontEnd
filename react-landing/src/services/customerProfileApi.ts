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
  /** Stable booking/document reference, when the backend has one. */
  id?: string | null;
  booking_id?: string | null;
  document_id?: string | null;
  backend_document_id?: string | null;
  /** Inventory unit id for this booked plot. */
  inventory_id?: string | null;
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
  /** Booking-payment reference, used for receipt downloads when supplied. */
  payment_id?: string | null;
  booking_payment_id?: string | null;
  booking_payment_amount?: number | null;
  payment_method?: 'razorpay' | 'cash' | string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  payment_created_date?: string | null;
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
  /** Milestone state: `paid` | `due` | `overdue` | `upcoming` (free text — the
   * UI also re-derives it from `due_date` so older values stay safe). */
  status?: string | null;
  /** Stable id for this milestone. Sent back as `installment_no` context when the
   * customer pays it. Optional — the UI falls back to the 1-based row position. */
  id?: string | null;
  /** ISO date the "Pay now" button unlocks (backend convention: due_date − 5
   * days). Optional — the UI derives the same 5-day window itself. */
  pay_enabled_from?: string | null;
}

/**
 * The derived booking payment plan the backend returns on
 * `POST /documents/generate` (upload_booking_application). Rows share the shape
 * of `CustomerScheduleRow`. Milestones: On Booking (= amount paid), then
 * +45 / +90 / +180 / +270 days splitting the outstanding equally.
 */
export interface PaymentPlan {
  total_receivable?: number | null;
  total_received?: number | null;
  total_outstanding?: number | null;
  total_outstanding_words?: string | null;
  booking_date?: string | null;
  rows: CustomerScheduleRow[];
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
  /** One or more booked plots. Newer backends should send this when a customer
   * has multiple plot bookings; older backends can keep sending `booking`. */
  bookings?: CustomerBookingInfo[] | null;
  customer_bookings?: CustomerBookingInfo[] | null;
  booked_plots?: CustomerBookingInfo[] | null;
  plots?: CustomerBookingInfo[] | null;
  booked_units?: CustomerBookingInfo[] | null;
  units?: CustomerBookingInfo[] | null;
  data?: {
    bookings?: CustomerBookingInfo[] | null;
    customer_bookings?: CustomerBookingInfo[] | null;
    booked_plots?: CustomerBookingInfo[] | null;
    plots?: CustomerBookingInfo[] | null;
    booked_units?: CustomerBookingInfo[] | null;
    units?: CustomerBookingInfo[] | null;
    booking?: CustomerBookingInfo | CustomerBookingInfo[] | null;
  } | null;
  /** Legacy / single-booking payload. */
  booking?: CustomerBookingInfo | CustomerBookingInfo[] | null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function bookingKey(booking: CustomerBookingInfo, index = 0): string {
  const stableKey = firstNonEmpty(
    booking.id,
    booking.booking_id,
    booking.document_id,
    booking.backend_document_id,
    booking.inventory_id,
    [booking.project_id, booking.unit_number, booking.booking_date].filter(Boolean).join(':'),
  );
  return stableKey ? `${stableKey}:${index}` : `booking-${index}`;
}

export function bookingDocumentId(booking: CustomerBookingInfo | null | undefined): string | null {
  return firstNonEmpty(booking?.document_id, booking?.backend_document_id, booking?.id) || null;
}

export function bookingLabel(booking: CustomerBookingInfo, index = 0): string {
  const project = firstNonEmpty(booking.township_label, booking.project_name, booking.project_id) || `Booking ${index + 1}`;
  const unit = firstNonEmpty(booking.unit_number);
  const date = firstNonEmpty(booking.booking_date);
  return [project, unit ? `Plot ${unit}` : '', date ? `Booked ${date}` : ''].filter(Boolean).join(' · ');
}

export function profileBookings(profile: CustomerProfile | null | undefined): CustomerBookingInfo[] {
  const rawProfile = profile as Record<string, unknown> | null | undefined;
  const rawBooking = rawProfile?.booking;
  const rawData = rawProfile?.data && typeof rawProfile.data === 'object' ? (rawProfile.data as Record<string, unknown>) : null;
  const candidates = [
    profile?.bookings,
    profile?.customer_bookings,
    profile?.booked_plots,
    profile?.plots,
    profile?.booked_units,
    profile?.units,
    rawData?.bookings,
    rawData?.customer_bookings,
    rawData?.booked_plots,
    rawData?.plots,
    rawData?.booked_units,
    rawData?.units,
    Array.isArray(rawBooking) ? rawBooking : null,
    Array.isArray(rawData?.booking) ? rawData.booking : null,
    nestedBookingArray(profile?.booking, 'bookings'),
    nestedBookingArray(profile?.booking, 'customer_bookings'),
    nestedBookingArray(profile?.booking, 'booked_plots'),
    nestedBookingArray(profile?.booking, 'plots'),
    nestedBookingArray(profile?.booking, 'booked_units'),
    nestedBookingArray(profile?.booking, 'units'),
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate.filter((booking): booking is CustomerBookingInfo => Boolean(booking) && typeof booking === 'object');
    }
  }
  if (rawData?.booking && !Array.isArray(rawData.booking) && typeof rawData.booking === 'object') {
    return [rawData.booking as CustomerBookingInfo];
  }
  return profile?.booking && !Array.isArray(profile.booking) ? [profile.booking] : [];
}

function nestedBookingArray(
  value: CustomerBookingInfo | CustomerBookingInfo[] | null | undefined,
  key: string,
): CustomerBookingInfo[] | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const maybe = (value as Record<string, unknown>)[key];
  return Array.isArray(maybe) ? (maybe as CustomerBookingInfo[]) : null;
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

/**
 * The profile page and the `usePaymentSchedule` hook both need this payload on
 * the same render. Firing two identical requests races the (cold-start / rate-
 * limited) backend: one can 200 while the other errors, so the on-screen
 * schedule table and the letter PDFs end up disagreeing about amounts and due
 * dates. This de-dupes concurrent callers onto one in-flight request and serves
 * a short-lived cached result to near-simultaneous mounts. Rejections are never
 * cached, and {@link clearCustomerProfileCache} forces the next call to refetch.
 */
const PROFILE_CACHE_TTL_MS = 30_000;
let profileCache: { token: string; at: number; promise: Promise<CustomerProfile> } | null = null;

export function getCustomerProfileShared(token: string, force = false): Promise<CustomerProfile> {
  const now = Date.now();
  if (!force && profileCache && profileCache.token === token && now - profileCache.at < PROFILE_CACHE_TTL_MS) {
    return profileCache.promise;
  }
  const promise = getCustomerProfile(token);
  const entry = { token, at: now, promise };
  profileCache = entry;
  promise.catch(() => {
    // Don't hold on to a rejected promise — let the next caller retry.
    if (profileCache === entry) profileCache = null;
  });
  return promise;
}

export function clearCustomerProfileCache(): void {
  profileCache = null;
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
 *        { "id": "m1", "label": "On Booking",                "percent": 10, "due_days": 0,   "due_date": "2025-01-10", "amount": 177431, "status": "paid",    "pay_enabled_from": "2025-01-05" },
 *        { "id": "m2", "label": "Within 45 days of booking", "percent": 15, "due_days": 45,  "due_date": "2025-02-24", "amount": 266146, "status": "paid",    "pay_enabled_from": "2025-02-19" },
 *        { "id": "m3", "label": "Within 90 days of booking", "percent": 25, "due_days": 90,  "due_date": "2025-04-10", "amount": 443576, "status": "due",     "pay_enabled_from": "2025-04-05" },
 *        { "id": "m4", "label": "Within 180 days of booking","percent": 25, "due_days": 180, "due_date": "2025-07-09", "amount": 443576, "status": "upcoming", "pay_enabled_from": "2025-07-04" },
 *        { "id": "m5", "label": "Within 270 days of booking","percent": 25, "due_days": 270, "due_date": "2025-10-07", "amount": 443577, "status": "upcoming", "pay_enabled_from": "2025-10-02" }
 *      ]
 *      // Instalment payments + the 20-day due reminder / email: see
 *      // docs/plot-booking-inventory/BACKEND-payment-plan-reminders.md
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
