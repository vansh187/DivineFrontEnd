import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout } from '../components/DashboardLayout';
import { CustomerDocuments } from '../components/CustomerDocuments';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { BuildingIcon, CalendarIcon, IconBadge, TagIcon } from '../components/DashboardIcons';
import { townshipPricing } from '../data/townshipPricing';
import { loadSavedTownships, toggleSavedTownship } from '../services/savedTownships';
import { loadPendingUnit, savePendingUnit } from '../services/pendingUnit';
import type { InventoryUnit } from '../services/inventoryApi';
import { PaymentDueBanner } from '../components/PaymentDueBanner';
import { StoriesBar } from '../components/stories/StoriesBar';
import { listMyVisits } from '../services/visitsApi';
import type { VisitRecord } from '../services/visitsApi';
import { getApplicationProject } from '../data/applicationProjects';
import { fetchBookingReceiptPdf, listMyBookings } from '../services/bookingsApi';
import type { BookingRecord } from '../services/bookingsApi';
import { downloadPdfBlob } from '../services/applicationPdf';

const BOOKING_BANNER_DAYS = 15;
const BOOKING_BANNER_MS = BOOKING_BANNER_DAYS * 24 * 60 * 60 * 1000;

function isWithinBookingBannerWindow(booking: BookingRecord): boolean {
  const timestamp = Date.parse(booking.created_at);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= BOOKING_BANNER_MS;
}

interface TownshipCardProps {
  savedIds: string[];
  onToggleSave: (townshipId: string) => void;
}

function TownshipCard({ savedIds, onToggleSave }: TownshipCardProps) {
  return (
    <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
      <IconBadge icon={<BuildingIcon />} accent="green" interactive />
      <h3 className="mt-4 font-display text-lg font-bold text-ink">Township</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">Open a township's detail view, or save it for later.</p>
      <div className="mt-4 flex flex-col gap-2">
        {townshipPricing.map((township) => {
          const saved = savedIds.includes(township.id);
          return (
            <div key={township.id} className="flex items-center gap-2">
              <Link
                to={`/residences/${township.id}`}
                className="flex-1 rounded-full bg-green px-4 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-green-soft"
              >
                {township.label}
              </Link>
              <button
                type="button"
                onClick={() => onToggleSave(township.id)}
                aria-pressed={saved}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  saved
                    ? 'border-terracotta bg-terracotta/10 text-terracotta'
                    : 'border-hairline text-ink-muted hover:border-terracotta hover:text-terracotta'
                }`}
              >
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvailablePlotsCard({ onView }: { onView: () => void }) {
  return (
    <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
      <IconBadge icon={<TagIcon />} accent="terracotta" interactive />
      <h3 className="mt-4 font-display text-lg font-bold text-ink">Available plots</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">Browse plots currently available and start a booking.</p>
      <div className="mt-4">
        <button
          type="button"
          onClick={onView}
          className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
        >
          View plots
        </button>
      </div>
    </div>
  );
}

const visitStatusStyle: Record<VisitRecord['status'], string> = {
  requested: 'border-terracotta/30 bg-terracotta/10 text-terracotta',
  scheduled: 'border-chrome/30 bg-chrome/10 text-chrome',
  completed: 'border-green/30 bg-green/10 text-green',
  cancelled: 'border-hairline bg-bg text-ink-muted',
};

const visitStatusLabel: Record<VisitRecord['status'], string> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatVisitWhen(visit: VisitRecord) {
  if (!visit.date) return 'Time to be confirmed';
  const when = visit.time ? new Date(`${visit.date}T${visit.time}`) : new Date(`${visit.date}T00:00`);
  if (Number.isNaN(when.getTime())) return 'Time to be confirmed';
  return when.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(visit.time ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

interface SiteVisitsCardProps {
  visits: VisitRecord[];
  loading: boolean;
  onAddVisit: () => void;
}

// Cards render inside a CSS grid whose rows aren't full-page-width, so once a
// customer accumulates several visits this card is the only thing tall enough
// to push the "after" content below the grid (application form, document
// upload) further down the page — the more visits, the more scrolling before
// they can even reach those sections. Cap what's shown up front and let the
// customer expand in place instead of growing the card unbounded.
const SITE_VISITS_COLLAPSED_COUNT = 3;

function SiteVisitsCard({ visits, loading, onAddVisit }: SiteVisitsCardProps) {
  const [showAll, setShowAll] = useState(false);
  const hasOverflow = visits.length > SITE_VISITS_COLLAPSED_COUNT;
  const visibleVisits = showAll ? visits : visits.slice(0, SITE_VISITS_COLLAPSED_COUNT);

  return (
    <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
      <IconBadge icon={<CalendarIcon />} accent="green-soft" interactive />
      <h3 className="mt-4 font-display text-lg font-bold text-ink">Site visits</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">Track upcoming visits and revisit past ones with your broker.</p>

      <div className="mt-4">
        {loading ? (
          <p className="text-xs text-ink-muted">Loading your visits...</p>
        ) : visits.length === 0 ? (
          <p className="eyebrow-label text-terracotta">No site visits yet</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {visibleVisits.map((visit) => (
                <div key={visit.id} className="rounded-lg border border-hairline bg-bg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{getApplicationProject(visit.project).label}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visitStatusStyle[visit.status]}`}>
                      {visitStatusLabel[visit.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{formatVisitWhen(visit)}</p>
                </div>
              ))}
            </div>
            {hasOverflow && (
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="mt-2 text-xs font-semibold text-green hover:text-green-soft"
              >
                {showAll ? 'Show less' : `Show all ${visits.length} visits`}
              </button>
            )}
          </>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={onAddVisit}
          className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
        >
          Plan site visit
        </button>
      </div>
    </div>
  );
}

interface ConfirmedBookingBannerProps {
  bookings: BookingRecord[];
  downloadingBookingId: string | null;
  error: string | null;
  onDownload: (booking: BookingRecord) => void;
}

function ConfirmedBookingBanner({
  bookings,
  downloadingBookingId,
  error,
  onDownload,
}: ConfirmedBookingBannerProps) {
  const pieces = Array.from({ length: 14 }, (_, index) => index);
  const hasMany = bookings.length > 1;

  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-green/30 bg-green/10 px-5 py-5 shadow-[0_18px_42px_-30px_rgba(6,31,45,0.45)]">
      <style>{`
        @keyframes booking-confetti-burst {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          18% { opacity: 1; }
          100% { transform: translate3d(var(--x), var(--y), 0) rotate(220deg); opacity: 0; }
        }
        .booking-confetti-piece {
          animation: booking-confetti-burst 1.8s ease-out infinite;
          animation-delay: var(--delay);
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        {pieces.map((piece) => (
          <span
            key={piece}
            className="booking-confetti-piece absolute left-1/2 top-7 h-2 w-1 rounded-sm"
            style={
              {
                '--x': `${(piece % 2 === 0 ? 1 : -1) * (36 + piece * 9)}px`,
                '--y': `${32 + (piece % 5) * 18}px`,
                '--delay': `${piece * 0.08}s`,
                backgroundColor: piece % 3 === 0 ? '#C47A2C' : piece % 3 === 1 ? '#1D7F58' : '#3E6EA8',
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-green">Congratulations</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">
            {hasMany ? 'Your plots are booked and KYC is verified.' : 'Your plot is booked and KYC is verified.'}
          </h2>
          <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1">
            {bookings.map((booking) => {
              const downloadingReceipt = downloadingBookingId === booking.id;
              return (
                <div
                  key={booking.id}
                  className="flex flex-col gap-3 rounded-lg border border-green/20 bg-surface/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm leading-relaxed text-ink-muted">
                    Plot <span className="font-semibold text-ink">{booking.unit_number || '-'}</span>
                    {booking.project_name ? ` in ${booking.project_name}` : ''} is confirmed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onDownload(booking)}
                      disabled={downloadingReceipt || !booking.can_download_receipt}
                      className="shrink-0 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingReceipt ? 'Preparing receipt...' : 'Download receipt'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function CustomerPage() {
  const { session, openModal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const name = session ? getDisplayName(session) : 'there';
  const email = session?.email ?? null;

  const [savedIds, setSavedIds] = useState<string[]>(() => (email ? loadSavedTownships(email) : []));
  const [pendingUnit, setPendingUnit] = useState<InventoryUnit | null>(() => (email ? loadPendingUnit(email) : null));

  useEffect(() => {
    setSavedIds(email ? loadSavedTownships(email) : []);
    setPendingUnit(email ? loadPendingUnit(email) : null);
  }, [email]);

  // "Book Plot" on the Available Plots listing lands here (not straight on the
  // application form) so the customer completes Aadhaar/PAN/photo uploads
  // first. Persist the chosen unit so it survives a reload during that, then
  // hand it to CustomerDocuments to carry forward once they click through.
  useEffect(() => {
    const unit = (location.state as { unit?: InventoryUnit } | null)?.unit;
    if (!unit || !email) return;
    savePendingUnit(email, unit);
    setPendingUnit(unit);
    navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleToggleSave = (townshipId: string) => {
    if (!email) {
      openModal('signin', 'customer');
      return;
    }
    setSavedIds(toggleSavedTownship(email, townshipId));
  };

  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [downloadingBookingId, setDownloadingBookingId] = useState<string | null>(null);
  const [bookingReceiptError, setBookingReceiptError] = useState<string | null>(null);

  const refreshVisits = useCallback(() => {
    if (!session) {
      setVisits([]);
      return;
    }
    setVisitsLoading(true);
    listMyVisits(session.token)
      .then(setVisits)
      .catch(() => setVisits([]))
      .finally(() => setVisitsLoading(false));
  }, [session]);

  useEffect(() => {
    refreshVisits();
  }, [refreshVisits]);

  const refreshBookings = useCallback(() => {
    if (!session) {
      setBookings([]);
      return;
    }
    listMyBookings(session.token)
      .then(setBookings)
      .catch(() => {
        setBookings([]);
      });
  }, [session]);

  useEffect(() => {
    refreshBookings();
  }, [refreshBookings]);

  const confirmedBookings = bookings.filter(
    (booking) =>
      booking.status === 'booked' &&
      booking.kyc_status === 'verified' &&
      booking.can_download_receipt &&
      isWithinBookingBannerWindow(booking),
  );
  const hasConfirmedBookings = confirmedBookings.length > 0;

  const handleDownloadBookingReceipt = async (booking: BookingRecord) => {
    if (!session) return;
    setDownloadingBookingId(booking.id);
    setBookingReceiptError(null);
    try {
      const blob = await fetchBookingReceiptPdf(session.token, booking.id);
      downloadPdfBlob(blob, `${booking.project_name || 'booking'}-receipt-${booking.id}.pdf`);
    } catch (err) {
      setBookingReceiptError(err instanceof Error ? err.message : 'Could not download the booking receipt.');
    } finally {
      setDownloadingBookingId(null);
    }
  };

  return (
    <>
      <DashboardLayout
        eyebrow="Customer workspace"
        heading={<>Welcome back, {name}.</>}
        subheading="Your shortlist and site visits will live here as we build out the customer portal — documents are ready below."
        before={
          <>
            <div className="mt-6">
              <StoriesBar />
            </div>
            {hasConfirmedBookings && (
              <ConfirmedBookingBanner
                bookings={confirmedBookings}
                downloadingBookingId={downloadingBookingId}
                error={bookingReceiptError}
                onDownload={handleDownloadBookingReceipt}
              />
            )}
            {pendingUnit && (
              <p className="mt-6 truncate rounded-lg border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs font-semibold text-terracotta">
                Booking {pendingUnit.project_name}
                {pendingUnit.unit_number ? ` · Plot ${pendingUnit.unit_number}` : ''} — complete Aadhaar, PAN &amp; photo uploads below to continue.
              </p>
            )}
            <PaymentDueBanner />
          </>
        }
      >
        <TownshipCard savedIds={savedIds} onToggleSave={handleToggleSave} />
        <AvailablePlotsCard onView={() => navigate('/customer/plots')} />
        <SiteVisitsCard visits={visits} loading={visitsLoading} onAddVisit={() => setSiteVisitOpen(true)} />
        {/* Full-width grid row right after Site visits, instead of a separate
            "after" section with its own large top margin — keeps document
            upload one short scroll from Site visits rather than a whole
            extra page section down. */}
        <div className="sm:col-span-2 lg:col-span-3">
          <CustomerDocuments pendingUnit={pendingUnit} />
        </div>
      </DashboardLayout>
      <SiteVisitDrawer
        open={siteVisitOpen}
        onClose={() => {
          setSiteVisitOpen(false);
          refreshVisits();
        }}
      />
    </>
  );
}
