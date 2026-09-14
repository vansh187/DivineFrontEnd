import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout } from '../components/DashboardLayout';
import { CustomerDocuments } from '../components/CustomerDocuments';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { BookmarkIcon, BuildingIcon, CalendarIcon, IconBadge, TagIcon } from '../components/DashboardIcons';
import { townshipPricing } from '../data/townshipPricing';
import { loadSavedTownships, toggleSavedTownship } from '../services/savedTownships';
import { loadPendingUnit, savePendingUnit } from '../services/pendingUnit';
import type { InventoryUnit } from '../services/inventoryApi';
import { PaymentDueBanner } from '../components/PaymentDueBanner';
import { StoriesBar } from '../components/stories/StoriesBar';
import { listMyVisits } from '../services/visitsApi';
import type { VisitRecord } from '../services/visitsApi';
import { getApplicationProject } from '../data/applicationProjects';

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

interface SavedTownshipsCardProps {
  savedIds: string[];
  onToggleSave: (townshipId: string) => void;
}

function SavedTownshipsCard({ savedIds, onToggleSave }: SavedTownshipsCardProps) {
  const saved = townshipPricing.filter((township) => savedIds.includes(township.id));

  return (
    <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
      <IconBadge icon={<BookmarkIcon />} accent="terracotta" interactive />
      <h3 className="mt-4 font-display text-lg font-bold text-ink">Saved townships</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">Bookmark plots along the corridor and compare them side by side.</p>
      {saved.length === 0 ? (
        <p className="eyebrow-label mt-4 text-terracotta">No townships saved yet</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {saved.map((township) => (
            <div key={township.id} className="flex items-center gap-2">
              <Link
                to={`/residences/${township.id}`}
                className="flex-1 rounded-full border border-hairline px-4 py-2 text-center text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green"
              >
                {township.label}
              </Link>
              <button
                type="button"
                onClick={() => onToggleSave(township.id)}
                className="shrink-0 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:border-red-300 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
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

function SiteVisitsCard({ visits, loading, onAddVisit }: SiteVisitsCardProps) {
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
          <div className="flex flex-col gap-2">
            {visits.map((visit) => (
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
            {pendingUnit && (
              <p className="mt-6 truncate rounded-lg border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs font-semibold text-terracotta">
                Booking {pendingUnit.project_name}
                {pendingUnit.unit_number ? ` · Plot ${pendingUnit.unit_number}` : ''} — complete Aadhaar, PAN &amp; photo uploads below to continue.
              </p>
            )}
            <PaymentDueBanner />
          </>
        }
        after={<CustomerDocuments pendingUnit={pendingUnit} />}
      >
        <TownshipCard savedIds={savedIds} onToggleSave={handleToggleSave} />
        <SavedTownshipsCard savedIds={savedIds} onToggleSave={handleToggleSave} />
        <AvailablePlotsCard onView={() => navigate('/customer/plots')} />
        <SiteVisitsCard visits={visits} loading={visitsLoading} onAddVisit={() => setSiteVisitOpen(true)} />
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
