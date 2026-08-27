import { useEffect, useMemo, useState } from 'react';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout } from '../components/DashboardLayout';
import { IconBadge, FileIcon, RupeeIcon } from '../components/DashboardIcons';
import { loadCustomerDocs } from '../services/documentStore';
import { loadPendingUnit } from '../services/pendingUnit';
import { townshipPricing } from '../data/townshipPricing';
import {
  getCustomerProfile,
  isProfileEndpointMissing,
  shouldFallbackToSavedProfile,
  type CustomerAddress,
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

function formatINR(amount: number): string {
  return `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

export function CustomerProfilePage() {
  const { session, logout, openModal } = useAuth();
  const [downloading, setDownloading] = useState<'allotment' | 'demand' | null>(null);
  const [error, setError] = useState('');

  // Real profile data from the backend. Loosely coupled: the page renders from
  // locally-cached booking-form data immediately, then overlays whatever the API
  // returns. If the endpoint isn't deployed yet the page just keeps the local view.
  const [remote, setRemote] = useState<CustomerProfile | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [remoteError, setRemoteError] = useState('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setRemoteLoading(true);
    setRemoteUnavailable(false);
    setRemoteError('');
    getCustomerProfile(session.token)
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

  const profile = useMemo(() => {
    if (!session) return null;
    const docs = loadCustomerDocs(session.email);
    const form = docs.bookingApplication.formData;
    const aadhaar = docs.aadhar;
    const r = remote ?? {};
    const rb = r.booking ?? {};
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
    const phone = firstText(r.phone, hasRemote ? '' : form.mobile, hasRemote ? '' : form.phone) || unknown;
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

    const localTotal = hasRemote ? null : Number(String(form.totalAmount).replace(/[^0-9.]/g, '')) || null;
    const totalAmount = typeof rb.total_consideration === 'number' ? rb.total_consideration : localTotal;
    const bookingAmount = hasRemote ? 0 : Number(String(form.bookingAmount).replace(/[^0-9.]/g, '')) || 0;
    const paidAmount = !hasRemote && docs.payment.status === 'paid' && docs.payment.amount ? docs.payment.amount : 0;
    const localReceived = Math.max(bookingAmount, paidAmount) || null;
    const receivedAmount = typeof rb.amount_received === 'number' ? rb.amount_received : localReceived;
    const bookingDate = firstText(rb.booking_date, hasRemote ? '' : form.applicationDate);
    const serverSchedule = Array.isArray(rb.payment_schedule) ? rb.payment_schedule : null;
    const paymentSchedule = serverSchedule?.length ? serverScheduleRows(serverSchedule) : localScheduleRows(totalAmount);

    const photo = hasRemote ? null : docs.applicantPhoto.dataUrl;
    const hasBooking =
      typeof rb.has_booking === 'boolean'
        ? rb.has_booking
        : Boolean(loadPendingUnit(session.email) || form.unitNo.trim() || form.projectId || totalAmount);

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
      hasBooking,
      totalAmount,
      receivedAmount,
      paymentSchedule,
      usesServerSchedule: Boolean(serverSchedule?.length),
      pdfInput,
    };
  }, [session, remote]);

  if (!session || !profile) return null;

  const initial = profile.name.charAt(0).toUpperCase();

  const handleDownload = async (kind: 'allotment' | 'demand') => {
    setDownloading(kind);
    setError('');
    try {
      if (kind === 'allotment') {
        const blob = await generateAllotmentLetterPdf(profile.pdfInput);
        downloadBlob(blob, 'Divine-Vision-Allotment-Letter.pdf');
      } else {
        const blob = await generateDemandLetterPdf(profile.pdfInput);
        downloadBlob(blob, 'OPS-Divine-Greens-Demand-Letter.pdf');
      }
    } catch {
      setError('Could not generate the document. Please try again.');
    } finally {
      setDownloading(null);
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
          {profile.photo ? (
            <img
              src={profile.photo}
              alt={profile.name}
              className="h-24 w-24 shrink-0 rounded-full border border-hairline object-cover"
            />
          ) : (
            <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-chrome font-display text-3xl font-bold text-white">
              {initial}
            </span>
          )}
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

      {profile.hasBooking && (
        <section className="mt-12">
          <p className="eyebrow-label text-terracotta">Payment schedule</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink">What you pay, and when</h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-[1.65] text-ink-muted">
            Your plot cost is split across these milestones. Each instalment is a share of the total
            consideration, due within the days shown from your booking date.
          </p>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-hairline bg-surface shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)]">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-hairline bg-bg text-left text-xs uppercase tracking-[0.04em] text-ink-muted">
                  <th className="px-5 py-3 font-semibold">Bifurcation</th>
                  <th className="px-5 py-3 font-semibold">Timeline</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                  {profile.usesServerSchedule && <th className="px-5 py-3 font-semibold">Status</th>}
                </tr>
              </thead>
              <tbody>
                {profile.paymentSchedule.map((row) => (
                  <tr key={row.key} className="border-b border-hairline">
                    <td className="px-5 py-3.5 font-display text-base font-bold text-ink">
                      {row.percent != null ? `${row.percent}%` : '-'}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      <span className="block text-ink">{row.label}</span>
                      {row.timeline && <span className="mt-0.5 block text-xs text-ink-muted">{row.timeline}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-ink">
                      {row.amount}
                    </td>
                    {profile.usesServerSchedule && (
                      <td className="px-5 py-3.5 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">
                        {row.status || '-'}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-bg">
                  <td className="px-5 py-3.5 font-display text-base font-bold text-ink">100%</td>
                  <td className="px-5 py-3.5 font-semibold text-ink">Total consideration</td>
                  <td className="px-5 py-3.5 text-right font-display text-base font-bold text-ink">
                    {profile.totalAmount ? formatINR(profile.totalAmount) : '-'}
                  </td>
                  {profile.usesServerSchedule && <td className="px-5 py-3.5" />}
                </tr>
              </tbody>
            </table>
          </div>

          {!profile.totalAmount && (
            <p className="mt-2 text-xs text-ink-muted">
              Instalment amounts appear once your plot price is on record.
            </p>
          )}
        </section>
      )}

      <p className="eyebrow-label mt-12 text-terracotta">Documents</p>

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
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
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </DashboardLayout>
  );
}
