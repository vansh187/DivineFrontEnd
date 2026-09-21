import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout } from '../components/DashboardLayout';
import { IconBadge, FileIcon, RupeeIcon } from '../components/DashboardIcons';
import { loadCustomerDocs, markInstallmentPaidLocally, saveCustomerDocs, type PaymentStatus } from '../services/documentStore';
import { usePaymentSchedule } from '../hooks/usePaymentSchedule';
import { formatCurrencyINR, formatIndianDate } from '../utils/currency';
import { PAY_WINDOW_DAYS, type MilestoneStatus, type ScheduleMilestone } from '../services/paymentSchedule';
import { createPaymentOrder, recordCashPayment, verifyPayment } from '../services/paymentsApi';
import type { CashPaymentMethod } from '../services/paymentsApi';
import { openZohoCheckout } from '../services/zohoCheckout';
import { townshipPricing } from '../data/townshipPricing';
import {
  getCustomerProfileShared,
  isProfileEndpointMissing,
  shouldFallbackToSavedProfile,
  bookingDocumentId,
  bookingKey,
  bookingLabel,
  profileBookings,
  type CustomerAddress,
  type CustomerBookingInfo,
  type CustomerProfile,
  type CustomerScheduleRow,
} from '../services/customerProfileApi';
import { ApiError } from '../services/authApi';
import {
  downloadBlob,
  generateAllotmentLetterPdf,
  generateDemandLetterPdf,
  PAYMENT_SCHEDULE,
  type ProfilePdfInput,
} from '../services/customerProfilePdf';
import { blobToDataUrl } from '../services/applicationPdf';
import { downloadPdfBlob, generatePaymentReceiptPdf } from '../services/applicationPdf';
import { fetchDemandLetterPdf, getDocument, getLatestDocumentByType, uploadApplicantPhoto } from '../services/documentsApi';
import { listMyBookings, fetchBookingReceiptPdf, type BookingRecord } from '../services/bookingsApi';

const formatINR = formatCurrencyINR;
const formatDate = formatIndianDate;
const formatDateObj = formatIndianDate;

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  paid: 'Paid',
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  upcoming: 'Upcoming',
};

const STATUS_CLASS: Record<MilestoneStatus, string> = {
  paid: 'bg-green/10 text-green',
  overdue: 'bg-red-50 text-red-700',
  'due-soon': 'bg-amber-50 text-amber-800',
  upcoming: 'bg-bg text-ink-muted',
};

function MilestoneStatusPill({ status }: { status: MilestoneStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** First non-empty trimmed string, or '' when none. */
function firstText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function joinAddress(address?: CustomerAddress | null): string {
  if (!address) return '';
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function ageFromYears(age?: number | null): string {
  return typeof age === 'number' && age > 0 && age < 130 ? `${age} years` : '';
}

/** Parse the various date shapes the booking form / Aadhaar decode produce
 * (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) into an age in whole years. */
function ageFromDob(dob: string): string {
  const raw = dob.trim();
  if (!raw) return '—';
  let year: number | undefined;
  let month = 0;
  let day = 1;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]) - 1;
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]) - 1;
    year = Number(dmy[3]);
  }
  if (!year) return '—';
  const birth = new Date(year, month, day);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? `${age} years` : '—';
}

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}

/** Stable pseudo customer reference (e.g. "ODG-0266") derived from the account
 * email — there is no real customer-ID from the backend yet. */
function localScheduleRows(totalAmount: number | null) {
  return PAYMENT_SCHEDULE.map((row) => ({
    key: row.label,
    percent: Math.round(row.share * 100),
    label: row.label,
    timeline: row.days === 0 ? 'On booking' : `${row.days} days`,
    amount: totalAmount ? formatINR(totalAmount * row.share) : '-',
    status: '',
  }));
}

function serverScheduleRows(rows: CustomerScheduleRow[]) {
  return rows.map((row, index) => ({
    key: `${row.label}-${index}`,
    percent: Number.isFinite(row.percent) ? row.percent : null,
    label: row.label,
    timeline: firstText(formatDate(row.due_date), row.due_days != null ? `${row.due_days} days` : ''),
    amount: typeof row.amount === 'number' ? formatINR(row.amount) : '-',
    status: firstText(row.status),
  }));
}

function freshSignedUrl(url: string | null, expiresAt: number | null): string | null {
  if (!url) return null;
  if (expiresAt && expiresAt <= Date.now() + 60_000) return null;
  return url;
}

function selectedBookingFrom(
  bookings: CustomerBookingInfo[],
  selectedKey: string | null,
): CustomerBookingInfo | null {
  if (!bookings.length) return null;
  if (selectedKey) {
    const match = bookings.find((booking, index) => bookingKey(booking, index) === selectedKey);
    if (match) return match;
  }
  return bookings[0];
}

const PROFILE_BOOKINGS_CACHE_PREFIX = 'dvi_profile_bookings_';

function profileBookingsCacheKey(email: string): string {
  return `${PROFILE_BOOKINGS_CACHE_PREFIX}${email.trim().toLowerCase()}`;
}

function loadCachedProfileBookings(email: string | null): CustomerBookingInfo[] {
  if (!email) return [];
  try {
    const raw = localStorage.getItem(profileBookingsCacheKey(email));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((booking): booking is CustomerBookingInfo => Boolean(booking) && typeof booking === 'object')
      : [];
  } catch {
    return [];
  }
}

function saveCachedProfileBookings(email: string, bookings: CustomerBookingInfo[]): void {
  if (!bookings.length) return;
  try {
    localStorage.setItem(profileBookingsCacheKey(email), JSON.stringify(bookings));
  } catch {
    /* Storage can be full/disabled; the live profile still renders normally. */
  }
}

function firstPaidScheduleAmount(rows?: CustomerScheduleRow[] | null): number | null {
  const paid = (rows ?? []).find((row) => (row.status ?? '').toLowerCase() === 'paid' && typeof row.amount === 'number');
  return paid?.amount ?? null;
}

export function CustomerProfilePage() {
  const { session, logout, openModal } = useAuth();
  const location = useLocation();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const paymentsRef = useRef<HTMLElement>(null);
  const [downloading, setDownloading] = useState<'application' | 'allotment' | 'demand' | 'receipt' | null>(null);
  const [error, setError] = useState('');
  const [kycBookings, setKycBookings] = useState<BookingRecord[]>([]);
  const [kycBookingsLoading, setKycBookingsLoading] = useState(false);
  const [downloadingBookingReceiptId, setDownloadingBookingReceiptId] = useState<string | null>(null);
  const [bookingReceiptError, setBookingReceiptError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);

  // Real profile data from the backend. Loosely coupled: the page renders from
  // locally-cached booking-form data immediately, then overlays whatever the API
  // returns. If the endpoint isn't deployed yet the page just keeps the local view.
  const [remote, setRemote] = useState<CustomerProfile | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [remoteError, setRemoteError] = useState('');
  const remoteBookings = useMemo(() => profileBookings(remote), [remote]);
  const [cachedBookings, setCachedBookings] = useState<CustomerBookingInfo[]>(() =>
    loadCachedProfileBookings(session?.email ?? null),
  );
  const visibleBookings = remoteBookings.length ? remoteBookings : cachedBookings;
  const [selectedBookingKey, setSelectedBookingKey] = useState<string | null>(null);

  useEffect(() => {
    setCachedBookings(loadCachedProfileBookings(session?.email ?? null));
  }, [session?.email]);

  useEffect(() => {
    if (!session?.email || !remoteBookings.length) return;
    saveCachedProfileBookings(session.email, remoteBookings);
    setCachedBookings(remoteBookings);
  }, [session?.email, remoteBookings]);

  useEffect(() => {
    if (!visibleBookings.length) return;
    setSelectedBookingKey((current) => {
      if (current && visibleBookings.some((booking, index) => bookingKey(booking, index) === current)) return current;
      return bookingKey(visibleBookings[0], 0);
    });
  }, [visibleBookings]);

  // Construction-linked payment plan + the "pay this instalment now" gate.
  const schedule = usePaymentSchedule(selectedBookingKey);
  const [payingNo, setPayingNo] = useState<number | null>(null);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  // Per-milestone payment method choice ('zoho' | 'cash' | 'rtgs_neft') and
  // the UTR number typed for an NEFT/RTGS confirmation - both keyed by
  // milestone.no since every open instalment picks independently.
  const [installmentMethod, setInstallmentMethod] = useState<Record<number, 'zoho' | CashPaymentMethod>>({});
  const [installmentUtr, setInstallmentUtr] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setRemoteLoading(true);
    setRemoteUnavailable(false);
    setRemoteError('');
    getCustomerProfileShared(session.token)
      .then((data) => {
        if (!cancelled) setRemote(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setRemote(null);
        if (shouldFallbackToSavedProfile(err)) setRemoteUnavailable(true);
        if (err instanceof ApiError) {
          if (err.status === 401) {
            logout();
            openModal('signin', 'customer');
          } else if (!isProfileEndpointMissing(err)) {
            setRemoteError(err.message);
          }
        } else {
          setRemoteError('Could not load your profile right now. Showing saved details where possible.');
        }
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, logout, openModal]);

  // KYC review status per booking - drives the "still under review" vs "booked,
  // receipt ready" state below. Fails silently into an empty list so a backend
  // hiccup here never blocks the rest of the profile page from rendering.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setKycBookingsLoading(true);
    listMyBookings(session.token)
      .then((records) => {
        if (!cancelled) setKycBookings(records);
      })
      .catch((err) => {
        if (cancelled) return;
        setKycBookings([]);
        if (err instanceof ApiError && err.status === 401) {
          logout();
          openModal('signin', 'customer');
        }
      })
      .finally(() => {
        if (!cancelled) setKycBookingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, logout, openModal]);

  const handleDownloadBookingReceipt = async (booking: BookingRecord) => {
    if (!session || !booking.can_download_receipt) return;
    setDownloadingBookingReceiptId(booking.id);
    setBookingReceiptError('');
    try {
      const blob = await fetchBookingReceiptPdf(session.token, booking.id);
      downloadPdfBlob(blob, `${booking.project_name || 'booking'}-receipt-${booking.id}.pdf`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        openModal('signin', 'customer');
        return;
      }
      setBookingReceiptError(err instanceof Error ? err.message : 'Could not download the receipt.');
    } finally {
      setDownloadingBookingReceiptId(null);
    }
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getLatestDocumentByType(session.token, 'applicant_photo')
      .then((doc) => {
        if (cancelled) return;
        const docs = loadCustomerDocs(session.email);
        saveCustomerDocs(session.email, {
          ...docs,
          applicantPhoto: {
            ...docs.applicantPhoto,
            dataUrl: docs.applicantPhoto.documentId === doc.id ? docs.applicantPhoto.dataUrl : null,
            uploadedAt: doc.created_date,
            documentId: doc.id,
            signedUrl: doc.signed_url,
            signedUrlExpiresAt: Date.now() + doc.signed_url_expires_in * 1000,
            error: null,
          },
        });
        window.dispatchEvent(new Event('dvi-profile-photo-changed'));
        setPhotoVersion((version) => version + 1);
      })
      .catch(() => {
        /* No uploaded profile photo yet, or storage temporarily unavailable. */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Deep-link from the home "payment due" banner (/customer/profile#payments).
  useEffect(() => {
    if (location.hash !== '#payments' || schedule.loading) return;
    paymentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, schedule.loading]);

  const profile = useMemo(() => {
    if (!session) return null;
    const docs = loadCustomerDocs(session.email);
    const form = docs.bookingApplication.formData;
    const aadhaar = docs.aadhar;
    const r = remote ?? {};
    const bookings = visibleBookings;
    const selectedBooking = selectedBookingFrom(bookings, selectedBookingKey);
    const legacyBooking = !Array.isArray(r.booking) ? r.booking : null;
    const rb = selectedBooking ?? legacyBooking ?? {};
    const hasRemote = remote !== null;
    const unknown = '-';

    // On a successful 200, the backend is authoritative. If it omits KYC fields,
    // they are unknown instead of being backfilled from older browser data.
    const name =
      firstText(
        r.full_name,
        [r.first_name, r.last_name].filter(Boolean).join(' '),
        hasRemote ? '' : form.applicantName,
        hasRemote ? '' : aadhaar.name,
      ) ||
      getDisplayName(session);
    const gender = titleCase(firstText(r.gender, hasRemote ? '' : form.gender, hasRemote ? '' : aadhaar.gender)) || unknown;
    const age =
      ageFromYears(r.age) ||
      (r.date_of_birth ? ageFromDob(r.date_of_birth) : '') ||
      (hasRemote ? unknown : ageFromDob(form.dob || aadhaar.dob || ''));
    const address =
      firstText(
        r.address_text,
        joinAddress(r.address),
        hasRemote ? '' : form.permanentAddress,
        hasRemote ? '' : form.correspondenceAddress,
        hasRemote ? '' : aadhaar.address,
      ) || unknown;
    const email = firstText(r.email) || session.email;
    // Unlike name/address/etc., the phone has no KYC-derived source (Aadhaar QR
    // doesn't carry it) to fall back to once the backend is authoritative - the
    // locally cached application form is the *only* other place a customer ever
    // typed their number, so use it even when hasRemote is true rather than
    // showing "-" for a number we actually have on this device.
    const phone = firstText(r.phone, form.mobile, form.phone) || unknown;
    const customerId = firstText(r.customer_id) || (hasRemote ? unknown : session.userId || unknown);
    const township =
      firstText(rb.township_label, rb.project_name) ||
      (hasRemote
        ? unknown
        : townshipPricing.find((t) => t.id === form.projectId)?.label || (form.projectId ? form.projectId : unknown));
    const unitNo = firstText(rb.unit_number, hasRemote ? '' : form.unitNo) || unknown;
    const plotAreaSqYd = firstText(rb.plot_area_sq_yd, hasRemote ? '' : form.plotAreaSqYd);
    const plotArea = plotAreaSqYd ? `${plotAreaSqYd} sq. yd.` : unknown;
    const unitType = firstText(rb.unit_type, hasRemote ? '' : form.unitType) || unknown;

    // The payment plan the backend derived on the last application upload — used
    // as a fallback for the letters and schedule until GET /customer/profile is live.
    const storedPlan = docs.bookingApplication.paymentPlan;
    const localTotalPlot = hasRemote
      ? null
      : Number(String(form.totalPlotAmount || form.totalAmount).replace(/[^0-9.]/g, '')) || null;
    const totalAmount =
      typeof rb.total_consideration === 'number'
        ? rb.total_consideration
        : typeof storedPlan?.total_receivable === 'number'
          ? storedPlan.total_receivable
          : localTotalPlot;
    const bookingAmount = hasRemote ? 0 : Number(String(form.bookingAmount).replace(/[^0-9.]/g, '')) || 0;
    const paidAmount = !hasRemote && docs.payment.status === 'paid' && docs.payment.amount ? docs.payment.amount : 0;
    const localReceived = Math.max(bookingAmount, paidAmount) || null;
    const receivedAmount =
      typeof rb.amount_received === 'number'
        ? rb.amount_received
        : typeof storedPlan?.total_received === 'number'
          ? storedPlan.total_received
          : localReceived;
    const bookingDate = firstText(rb.booking_date, storedPlan?.booking_date ?? '', hasRemote ? '' : form.applicationDate);
    const serverSchedule = Array.isArray(rb.payment_schedule) ? rb.payment_schedule : null;
    // Rows for the letters: live profile schedule first, then the stored upload plan.
    const letterScheduleRows: CustomerScheduleRow[] | null = serverSchedule?.length
      ? serverSchedule
      : storedPlan?.rows?.length
        ? storedPlan.rows
        : null;
    const paymentSchedule = letterScheduleRows?.length
      ? serverScheduleRows(letterScheduleRows)
      : localScheduleRows(totalAmount);

    const photo = docs.applicantPhoto.dataUrl || freshSignedUrl(docs.applicantPhoto.signedUrl, docs.applicantPhoto.signedUrlExpiresAt);
    const backendDocumentId = bookingDocumentId(selectedBooking) ?? docs.bookingApplication.backendDocumentId;
    const receiptPaymentId = firstText(rb.booking_payment_id, rb.payment_id);
    const receiptAmount =
      typeof rb.booking_payment_amount === 'number'
        ? rb.booking_payment_amount
        : firstPaidScheduleAmount(serverSchedule) ?? (hasRemote ? null : docs.payment.amount);
    const remoteProjectId = firstText(rb.project_id);
    const receiptProjectId =
      remoteProjectId && townshipPricing.some((township) => township.id === remoteProjectId)
        ? remoteProjectId
        : form.projectId;
    const receiptFormData = {
      ...form,
      projectId: receiptProjectId as typeof form.projectId,
      unitNo,
      plotAreaSqYd,
      unitType,
      totalPlotAmount: totalAmount != null ? String(totalAmount) : form.totalPlotAmount,
      totalAmount: totalAmount != null ? String(totalAmount) : form.totalAmount,
      applicantName: name,
      mobile: phone === unknown ? '' : phone,
      // The visible profile page shows the merged `address` (backend text/KYC/
      // form, whichever resolved) - the receipt must use the same value rather
      // than the raw, possibly-never-filled-in wizard fields, or it can show
      // blank even when the profile page itself displays a real address.
      correspondenceAddress: address === unknown ? '' : address,
      email,
      applicationDate: bookingDate || form.applicationDate,
    };
    const receiptPayment: PaymentStatus | null =
      receiptPaymentId && receiptAmount != null
        ? {
            paymentId: receiptPaymentId,
            amount: receiptAmount,
            status: 'paid',
            // rb.payment_method is a raw backend string, not the narrower PaymentStatus
            // union - 'razorpay' is preserved rather than folded into 'zoho' so a
            // pre-migration booking's receipt still names the gateway it actually used.
            method:
              rb.payment_method === 'cash'
                ? 'cash'
                : rb.payment_method === 'rtgs_neft'
                  ? 'rtgs_neft'
                  : rb.payment_method === 'razorpay'
                    ? 'razorpay'
                    : 'zoho',
            zohoPaymentsSessionId: rb.zoho_payments_session_id ?? null,
            zohoPaymentId: rb.zoho_payment_id ?? null,
            paidAt: rb.payment_created_date ?? rb.booking_date ?? null,
            inventoryStatus: null,
            inventoryConflictReason: null,
            error: null,
          }
        : !hasRemote && docs.payment.status === 'paid'
          ? docs.payment
          : null;

    const pdfInput: ProfilePdfInput = {
      name,
      gender,
      age,
      address,
      email,
      phone,
      township,
      unitNo,
      plotArea,
      plotAreaSqYd,
      unitType,
      customerId,
      totalAmount,
      receivedAmount,
      bookingDate,
      scheduleRows: letterScheduleRows,
      outstandingWords: storedPlan?.total_outstanding_words ?? null,
    };

    return {
      name,
      gender,
      age,
      address,
      email,
      phone,
      photo,
      customerId,
      township,
      totalAmount,
      receivedAmount,
      paymentSchedule,
      usesServerSchedule: Boolean(letterScheduleRows?.length),
      bookingOptions: bookings.map((booking, index) => ({
        key: bookingKey(booking, index),
        label: bookingLabel(booking, index),
      })),
      selectedBooking,
      selectedBookingKey: selectedBooking ? bookingKey(selectedBooking, bookings.indexOf(selectedBooking)) : null,
      backendDocumentId,
      receiptFormData,
      receiptPayment,
      pdfInput,
    };
  }, [session, remote, visibleBookings, selectedBookingKey, photoVersion]);

  if (!session || !profile) return null;

  // The filled application packet is a KYC artifact, not just a payment
  // receipt (see CustomerApplicationPage's pdfHeldForKyc) - this page must
  // hold it back the same way, or a customer could bypass that gate simply by
  // visiting their profile instead of the application wizard. `kycBookings`
  // is the same `/bookings/mine` source of truth used there; a booking record
  // is created for every backend-tracked payment (online/cash/rtgs_neft), so
  // no match here means either KYC review hasn't produced a record yet, or
  // this document predates booking tracking - lock it either way.
  const selectedUnitNumber = profile.selectedBooking?.unit_number ?? null;
  const applicationKycVerified = kycBookings.some(
    (booking) =>
      booking.status === 'booked' &&
      booking.kyc_status === 'verified' &&
      (selectedUnitNumber ? booking.unit_number === selectedUnitNumber : true),
  );
  const applicationPdfLocked = !!profile.backendDocumentId && !applicationKycVerified;

  const initial = profile.name.charAt(0).toUpperCase();
  const handleBookingChange = (value: string) => {
    setSelectedBookingKey(value || null);
    setPayError('');
    setPaySuccess('');
    setError('');
  };
  const renderBookingSelector = (id: string) =>
    profile.bookingOptions.length > 1 ? (
      <div className="max-w-xl">
        <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
          Selected plot booking
        </label>
        <select
          id={id}
          value={profile.selectedBookingKey ?? ''}
          onChange={(event) => handleBookingChange(event.target.value)}
          className="mt-2 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-green"
        >
          {profile.bookingOptions.map((booking) => (
            <option key={booking.key} value={booking.key}>
              {booking.label}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  const handlePhotoUpload = async (file: File | null) => {
    if (!session || !file) return;
    setPhotoError('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Please upload a JPG or PNG photo.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Please upload a photo under 8 MB.');
      return;
    }

    setPhotoUploading(true);
    try {
      const dataUrl = await blobToDataUrl(file);
      const docs = loadCustomerDocs(session.email);
      const optimistic = {
        ...docs,
        applicantPhoto: {
          ...docs.applicantPhoto,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl,
          documentId: null,
          signedUrl: null,
          signedUrlExpiresAt: null,
          error: null,
        },
      };
      saveCustomerDocs(session.email, optimistic);
      window.dispatchEvent(new Event('dvi-profile-photo-changed'));
      setPhotoVersion((version) => version + 1);

      try {
        const uploaded = await uploadApplicantPhoto(session.token, file);
        const fresh = loadCustomerDocs(session.email);
        saveCustomerDocs(session.email, {
          ...fresh,
          applicantPhoto: {
            ...fresh.applicantPhoto,
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: uploaded.created_date,
            dataUrl,
            documentId: uploaded.id,
            signedUrl: uploaded.signed_url,
            signedUrlExpiresAt: Date.now() + uploaded.signed_url_expires_in * 1000,
            error: null,
          },
        });
        window.dispatchEvent(new Event('dvi-profile-photo-changed'));
        setPhotoVersion((version) => version + 1);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Photo saved locally, but upload failed. Please try again.';
        const fresh = loadCustomerDocs(session.email);
        saveCustomerDocs(session.email, {
          ...fresh,
          applicantPhoto: { ...fresh.applicantPhoto, error: message },
        });
        setPhotoError(message);
        if (err instanceof ApiError && err.status === 401) {
          logout();
          openModal('signin', 'customer');
        }
      }
    } catch {
      setPhotoError('Could not read that photo. Please choose another file.');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDownload = async (kind: 'allotment' | 'demand' | 'application') => {
    if (!session) return;
    setDownloading(kind);
    setError('');
    try {
      if (kind === 'application') {
        if (!profile.backendDocumentId) {
          setError('The booking application form is not available for the selected plot yet.');
          return;
        }
        if (applicationPdfLocked) {
          setError('The filled application PDF unlocks for download once our team verifies your KYC documents.');
          return;
        }
        const doc = await getDocument(session.token, profile.backendDocumentId);
        window.open(doc.signed_url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (kind === 'allotment') {
        const blob = await generateAllotmentLetterPdf(profile.pdfInput);
        downloadBlob(blob, 'Divine-Vision-Allotment-Letter.pdf');
        return;
      }

      // Demand letter: prefer the server-rendered PDF; fall back to the
      // client-side render only for recoverable failures.
      let blob: Blob | null = null;
      if (profile.backendDocumentId) {
        try {
          blob = await fetchDemandLetterPdf(session.token, profile.backendDocumentId);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            logout();
            openModal('signin', 'customer');
            return;
          }
          // Ownership / wrong-type errors are real - surface them, don't paper
          // over with a locally-rendered letter for a document they can't access.
          if (err instanceof ApiError && (err.status === 403 || err.detail === 'not_a_booking_application')) {
            setError(err.message);
            return;
          }
          // 404 / not-ready / 5xx / network / empty / non-PDF → fall through to
          // the local render so the customer still gets a usable letter.
        }
      }
      if (!blob) blob = await generateDemandLetterPdf(profile.pdfInput);
      downloadBlob(blob, 'OPS-Divine-Greens-Demand-Letter.pdf');
    } catch {
      setError('Could not generate the document. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!profile.receiptPayment) {
      setError('A payment receipt is not available for the selected booking yet.');
      return;
    }
    setDownloading('receipt');
    setError('');
    try {
      const blob = await generatePaymentReceiptPdf({
        formData: profile.receiptFormData,
        paymentInfo: profile.receiptPayment,
      });
      const projectId = profile.receiptFormData.projectId || 'project';
      const paymentId = profile.receiptPayment.paymentId || Date.now();
      downloadPdfBlob(blob, `${projectId}-payment-receipt-${paymentId}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the payment receipt.');
    } finally {
      setDownloading(null);
    }
  };

  const handlePayInstallmentOnline = async (milestone: ScheduleMilestone) => {
    if (!session || milestone.amount == null) return;
    const order = await createPaymentOrder(session.token, milestone.amount, {
      purpose: 'installment',
      inventoryId: profile.selectedBooking?.inventory_id ?? null,
      installmentNo: milestone.no,
      dueDate: milestone.dueDateISO,
    });
    const result = await openZohoCheckout({
      accountId: order.zoho_account_id,
      amount: order.amount,
      currency: order.currency,
      paymentsSessionId: order.zoho_payments_session_id,
      name: 'Divine Vision Infratech',
      description: `Instalment ${milestone.no} · ${milestone.label}`,
    });
    const record = await verifyPayment(session.token, {
      zoho_payments_session_id: result.zoho_payments_session_id,
      zoho_payment_id: result.zoho_payment_id,
    });
    if (!record.verified) {
      setPayError('Payment could not be verified. Please try again or contact support.');
      return;
    }
    return record.amount;
  };

  // Cash and a confirmed NEFT/RTGS transfer both settle immediately server-side
  // via the same endpoint (see recordCashPayment) - only the method label and,
  // for rtgs_neft, the UTR number differ from the online (Zoho Pay) path above.
  const handlePayInstallmentOffline = async (milestone: ScheduleMilestone, method: CashPaymentMethod, utrNumber?: string) => {
    if (!session || milestone.amount == null) return;
    const record = await recordCashPayment(
      session.token,
      milestone.amount,
      `${method === 'cash' ? 'Cash' : 'NEFT/RTGS'} recorded for instalment ${milestone.no} from the profile page.`,
      {
        purpose: 'installment',
        inventoryId: profile.selectedBooking?.inventory_id ?? null,
        installmentNo: milestone.no,
        dueDate: milestone.dueDateISO,
      },
      method,
      utrNumber,
    );
    return record.amount;
  };

  const handlePayInstallment = async (milestone: ScheduleMilestone) => {
    if (!session || milestone.amount == null || milestone.amount <= 0) return;
    const method = installmentMethod[milestone.no] ?? 'zoho';
    const utrNumber = installmentUtr[milestone.no]?.trim() ?? '';
    if (method === 'rtgs_neft' && !utrNumber) {
      setPayError('Enter the NEFT / RTGS UTR number before confirming.');
      return;
    }
    setPayingNo(milestone.no);
    setPayError('');
    setPaySuccess('');
    try {
      const paidAmount =
        method === 'zoho'
          ? await handlePayInstallmentOnline(milestone)
          : await handlePayInstallmentOffline(milestone, method, method === 'rtgs_neft' ? utrNumber : undefined);
      if (paidAmount == null) return;
      markInstallmentPaidLocally(session.email, milestone.no, paidAmount);
      setPaySuccess(`Instalment ${milestone.no} paid — ${formatINR(paidAmount)} received.`);
      setInstallmentUtr((prev) => ({ ...prev, [milestone.no]: '' }));
      schedule.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        openModal('signin', 'customer');
        return;
      }
      setPayError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setPayingNo(null);
    }
  };

  const details: Array<[string, string]> = [
    ['Name', profile.name],
    ['Age', profile.age],
    ['Gender', profile.gender],
    ['Address', profile.address],
    ['Email', profile.email],
    ['Phone', profile.phone],
    ['Customer ID', profile.customerId],
    ['Township', profile.township],
    ['Amount received', profile.receivedAmount != null ? formatINR(profile.receivedAmount) : '-'],
  ];

  return (
    <DashboardLayout
      eyebrow="Customer workspace"
      heading={<>My profile</>}
      subheading="Your personal details and the documents for your plot booking."
      contentLayout="full"
    >
      <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-2">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt={profile.name}
                className="h-24 w-24 rounded-full border border-hairline object-cover"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-chrome font-display text-3xl font-bold text-white">
                {initial}
              </span>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => void handlePhotoUpload(event.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                className="rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
              >
                {photoUploading ? 'Uploading...' : profile.photo ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
            {photoError && <p role="alert" className="max-w-40 text-center text-xs text-red-700">{photoError}</p>}
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <p className="font-display text-2xl font-bold text-ink">{profile.name}</p>
            <p className="eyebrow-label mt-1 text-terracotta">{session.role}</p>
            <p className="mt-1 text-sm text-ink-muted">{profile.email}</p>
            {remoteLoading ? (
              <p className="mt-1 text-xs text-ink-muted">Loading your details…</p>
            ) : remoteError ? (
              <p role="alert" className="mt-1 text-xs text-red-700">{remoteError}</p>
            ) : remoteUnavailable ? (
              <p className="mt-1 text-xs text-ink-muted">Showing saved details while live profile data is unavailable.</p>
            ) : null}
          </div>
        </div>

        {profile.bookingOptions.length > 1 && <div className="mt-8">{renderBookingSelector('profile-booking-summary')}</div>}

        <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-hairline py-3.5">
              <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                {label}
              </dt>
              <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {schedule.hasBooking && (
        <section ref={paymentsRef} id="payments" className="mt-12 scroll-mt-24">
          <p className="eyebrow-label text-terracotta">Payment schedule</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">What you pay, and when</h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-[1.65] text-ink-muted">
            Your plot cost is split across these milestones. Payment for the next instalment opens {PAY_WINDOW_DAYS} days
            before its due date — once it does, choose to pay online, in cash, or by NEFT/RTGS transfer.
          </p>
          {profile.bookingOptions.length > 1 && <div className="mt-5">{renderBookingSelector('profile-booking-payments')}</div>}

          {(payError || paySuccess) && (
            <p
              role="alert"
              className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
                payError ? 'border-red-200 bg-red-50 text-red-700' : 'border-green/30 bg-green/10 text-green'
              }`}
            >
              {payError || paySuccess}
            </p>
          )}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-hairline bg-surface shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-hairline bg-bg text-left text-xs uppercase tracking-[0.04em] text-ink-muted">
                  <th className="px-5 py-3 font-semibold">Share</th>
                  <th className="px-5 py-3 font-semibold">Milestone</th>
                  <th className="px-5 py-3 font-semibold">Due date</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {schedule.milestones.map((milestone) => {
                  const opensOn =
                    milestone.dueDate && !milestone.payable && milestone.isNext && milestone.status !== 'paid'
                      ? new Date(milestone.dueDate.getTime() - PAY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
                      : null;
                  return (
                    <tr key={`${milestone.no}-${milestone.label}`} className="border-b border-hairline align-top">
                      <td className="px-5 py-3.5 font-display text-base font-bold text-ink">
                        {milestone.percent != null ? `${milestone.percent}%` : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="block text-ink">{milestone.label}</span>
                        {milestone.isNext && milestone.status !== 'paid' && (
                          <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.04em] text-terracotta">
                            Next payment
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {milestone.dueDate ? formatDateObj(milestone.dueDate) : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink">
                        {milestone.amount != null ? formatINR(milestone.amount) : '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        <MilestoneStatusPill status={milestone.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {milestone.status === 'paid' ? (
                          <span className="text-xs font-semibold text-green">Paid</span>
                        ) : !milestone.payable ? (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              disabled
                              title={opensOn ? `Opens ${formatDateObj(opensOn)}` : 'Available closer to the due date'}
                              className="cursor-not-allowed rounded-full bg-green px-4 py-2 text-xs font-semibold text-white opacity-50"
                            >
                              Pay {milestone.amount != null ? formatINR(milestone.amount) : 'now'}
                            </button>
                            {opensOn && <span className="text-[11px] text-ink-muted">Opens {formatDateObj(opensOn)}</span>}
                          </div>
                        ) : (
                          (() => {
                            const method = installmentMethod[milestone.no] ?? 'zoho';
                            const paying = payingNo === milestone.no;
                            const amountLabel = milestone.amount != null ? formatINR(milestone.amount) : 'now';
                            const actionLabel = paying
                              ? 'Processing…'
                              : method === 'cash'
                                ? `Record ${amountLabel} (Cash)`
                                : method === 'rtgs_neft'
                                  ? `Confirm ${amountLabel} (NEFT/RTGS)`
                                  : `Pay ${amountLabel}`;
                            return (
                              <div className="flex flex-col items-end gap-1.5">
                                <select
                                  value={method}
                                  onChange={(event) =>
                                    setInstallmentMethod((prev) => ({
                                      ...prev,
                                      [milestone.no]: event.target.value as 'zoho' | CashPaymentMethod,
                                    }))
                                  }
                                  disabled={payingNo !== null}
                                  className="rounded-lg border border-hairline bg-bg px-2 py-1.5 text-xs text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <option value="zoho">Online (Zoho Pay)</option>
                                  <option value="cash">Cash</option>
                                  <option value="rtgs_neft">NEFT / RTGS</option>
                                </select>
                                {method === 'rtgs_neft' && (
                                  <input
                                    type="text"
                                    value={installmentUtr[milestone.no] ?? ''}
                                    onChange={(event) =>
                                      setInstallmentUtr((prev) => ({ ...prev, [milestone.no]: event.target.value }))
                                    }
                                    placeholder="UTR number"
                                    disabled={payingNo !== null}
                                    className="w-32 rounded-lg border border-hairline bg-bg px-2 py-1.5 text-xs text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handlePayInstallment(milestone)}
                                  disabled={payingNo !== null}
                                  className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {actionLabel}
                                </button>
                              </div>
                            );
                          })()
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-bg">
                  <td className="px-5 py-3.5 font-display text-base font-bold text-ink">100%</td>
                  <td className="px-5 py-3.5 font-semibold text-ink" colSpan={2}>
                    Total consideration
                  </td>
                  <td className="px-5 py-3.5 text-right font-display text-base font-bold text-ink">
                    {schedule.totalAmount ? formatINR(schedule.totalAmount) : '-'}
                  </td>
                  <td className="px-5 py-3.5" colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>

          {!schedule.totalAmount && (
            <p className="mt-2 text-xs text-ink-muted">
              Instalment amounts appear once your plot price is on record.
            </p>
          )}
          {schedule.source === 'local' && (
            <p className="mt-2 text-xs text-ink-muted">
              Showing your saved plan. Live status updates once the booking is confirmed on the server.
            </p>
          )}
        </section>
      )}

      {(kycBookingsLoading || kycBookings.length > 0) && (
        <section className="mt-12">
          <p className="eyebrow-label text-terracotta">Booking status</p>
          {kycBookingsLoading && kycBookings.length === 0 ? (
            <p className="mt-4 text-xs text-ink-muted">Loading your booking status…</p>
          ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {kycBookings.map((booking) => {
              const statusStyle =
                booking.status === 'booked'
                  ? 'border-green/30 bg-green/10 text-green'
                  : booking.status === 'rejected'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : booking.status === 'cancelled'
                      ? 'border-hairline bg-bg text-ink-muted'
                      : 'border-terracotta/30 bg-terracotta/10 text-terracotta';
              const statusLabel =
                booking.status === 'pending_kyc_review'
                  ? 'Under KYC review'
                  : booking.status === 'booked'
                    ? 'Booked'
                    : booking.status === 'rejected'
                      ? 'Rejected'
                      : 'Cancelled';
              return (
                <div key={booking.id} className="rounded-2xl border border-hairline bg-surface p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold text-ink">
                        {booking.project_name}
                        {booking.unit_number ? ` · Plot ${booking.unit_number}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">{formatINR(booking.amount)} paid</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}>
                      {statusLabel}
                    </span>
                  </div>
                  {booking.status === 'pending_kyc_review' && (
                    <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                      We&rsquo;re verifying your KYC documents. You&rsquo;ll be notified once your booking is confirmed.
                    </p>
                  )}
                  {booking.admin_note && (
                    <p className="mt-3 rounded-lg border border-hairline bg-bg px-3 py-2 text-xs leading-relaxed text-ink-muted">
                      {booking.admin_note}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDownloadBookingReceipt(booking)}
                    disabled={!booking.can_download_receipt || downloadingBookingReceiptId === booking.id}
                    className="mt-4 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingBookingReceiptId === booking.id
                      ? 'Preparing…'
                      : booking.can_download_receipt
                        ? 'Download receipt'
                        : 'Receipt unlocks once booked'}
                  </button>
                </div>
              );
            })}
          </div>
          )}
          {bookingReceiptError && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {bookingReceiptError}
            </p>
          )}
        </section>
      )}

      <p className="eyebrow-label mt-12 text-terracotta">Documents</p>
      {profile.bookingOptions.length > 1 && <div className="mt-4">{renderBookingSelector('profile-booking-documents')}</div>}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
          <IconBadge icon={<FileIcon />} accent="terracotta" interactive />
          <h3 className="mt-4 font-display text-lg font-bold text-ink">Application form</h3>
          <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
            Full booking application packet with the uploaded documents for the selected plot.
          </p>
          <button
            type="button"
            onClick={() => handleDownload('application')}
            disabled={downloading !== null || !profile.backendDocumentId || applicationPdfLocked}
            title={applicationPdfLocked ? 'Unlocks once our team verifies your KYC documents.' : undefined}
            className="mt-4 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading === 'application'
              ? 'Preparing...'
              : applicationPdfLocked
                ? 'Unlocks once KYC verified'
                : 'Download application form'}
          </button>
        </div>

        <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
          <IconBadge icon={<FileIcon />} accent="green" interactive />
          <h3 className="mt-4 font-display text-lg font-bold text-ink">Allotment letter</h3>
          <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
            Your provisional allotment letter for the booked plot, with the indicative payment schedule.
          </p>
          <button
            type="button"
            onClick={() => handleDownload('allotment')}
            disabled={downloading !== null}
            className="mt-4 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading === 'allotment' ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>

        <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
          <IconBadge icon={<RupeeIcon />} accent="terracotta" interactive />
          <h3 className="mt-4 font-display text-lg font-bold text-ink">Demand letter</h3>
          <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
            Instalments due and outstanding amount, in the OPS Divine Greens format.
          </p>
          <button
            type="button"
            onClick={() => handleDownload('demand')}
            disabled={downloading !== null}
            className="mt-4 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading === 'demand' ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>

        <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
          <IconBadge icon={<RupeeIcon />} accent="green-soft" interactive />
          <h3 className="mt-4 font-display text-lg font-bold text-ink">Payment receipt</h3>
          <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
            Receipt for the booking payment recorded against the selected plot.
          </p>
          <button
            type="button"
            onClick={() => void handleDownloadReceipt()}
            disabled={downloading !== null || remoteLoading || !profile.receiptPayment}
            title={remoteLoading ? 'Waiting for your profile to finish loading...' : undefined}
            className="mt-4 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading === 'receipt' ? 'Preparing…' : remoteLoading ? 'Loading…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </DashboardLayout>
  );
}
