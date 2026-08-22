import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { journeyStops } from '../data/journeyStops';
import { townshipLocations } from '../data/locationConnectivity';
import { getProjectDetail } from '../data/projectDetails';
import { contact } from '../data/contact';
import { useAuth } from '../hooks/useAuth';
import { loadSavedTownships, toggleSavedTownship } from '../services/savedTownships';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const { session, openModal } = useAuth();
  const email = session?.email ?? null;

  const [savedIds, setSavedIds] = useState<string[]>(() => (email ? loadSavedTownships(email) : []));
  useEffect(() => {
    setSavedIds(email ? loadSavedTownships(email) : []);
  }, [email]);

  const township = journeyStops.find((stop) => stop.id === id);
  const location = townshipLocations.find((item) => item.id === id);
  const detail = getProjectDetail(id ?? '');

  if (!township || !detail) {
    return <Navigate to="/residences" replace />;
  }

  const saved = savedIds.includes(detail.id);
  const handleToggleSave = () => {
    if (!email) {
      openModal('signin', 'customer');
      return;
    }
    setSavedIds(toggleSavedTownship(email, detail.id));
  };

  const mapSrc = location
    ? `https://www.google.com/maps?q=${encodeURIComponent(location.mapQuery)}&output=embed`
    : undefined;

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />

      <header className="relative flex min-h-[52svh] items-end overflow-hidden pt-24">
        <img src={township.image.src} alt={township.image.alt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(44,62,80,0.35)_0%,rgba(44,62,80,0.2)_40%,rgba(44,62,80,0.86)_100%)]" />
        <div className="relative z-10 px-4 pb-10 sm:px-10 sm:pb-14">
          <div className="flex items-center justify-between gap-4">
            <Link to="/residences" className="text-xs font-semibold text-white/75 hover:text-white">
              ← All projects
            </Link>
            <button
              type="button"
              onClick={handleToggleSave}
              aria-pressed={saved}
              className={`rounded-full border px-4 py-2 text-xs font-semibold backdrop-blur-sm transition-colors ${
                saved
                  ? 'border-terracotta bg-terracotta text-white'
                  : 'border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20'
              }`}
            >
              {saved ? 'Saved' : 'Save township'}
            </button>
          </div>
          <h1 className="mt-4 font-display text-balance text-4xl font-bold leading-tight text-white sm:text-6xl">
            {township.heading} <em className="not-italic">{township.headingEmphasis}</em>
          </h1>
          {township.reraId && (
            <p className="mt-3 text-xs font-semibold tracking-[0.04em] text-white/80">RERA: {township.reraId}</p>
          )}
        </div>
      </header>

      <main className="bg-bg px-4 py-14 sm:px-10 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-[15px] leading-[1.8] text-ink-muted">{township.description}</p>

            <h2 className="mt-10 font-display text-2xl font-bold text-ink">Project details</h2>
            <div className="mt-4 grid grid-cols-1 gap-0 border-t border-hairline sm:grid-cols-2">
              {detail.specs.map((spec) => (
                <div key={spec.label} className="border-b border-hairline py-3.5 sm:odd:border-r sm:odd:pr-4 sm:even:pl-4">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                    {spec.label}
                  </span>
                  <span className="font-display text-lg font-semibold text-ink">{spec.value}</span>
                </div>
              ))}
            </div>

            <h2 className="mt-10 font-display text-2xl font-bold text-ink">Amenities</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full border border-hairline bg-surface px-3.5 py-2 text-sm font-medium text-ink/85"
                >
                  {amenity}
                </span>
              ))}
            </div>

            {location && (
              <>
                <h2 className="mt-10 font-display text-2xl font-bold text-ink">Location & connectivity</h2>
                <p className="mt-1 text-sm text-ink-muted">{location.subtitle}</p>
                <div className="mt-4 divide-y divide-hairline border-t border-hairline">
                  {location.connectivity.map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-ink-muted">{item.label}</span>
                      <span className="font-display text-base font-semibold text-ink">{item.value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-muted/80">
                  Drive times are estimates for reference only — confirm exact routes with the sales desk.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {township.heroSrc && (
              <div className="overflow-hidden rounded-2xl border border-hairline shadow-[0_30px_80px_-40px_rgba(44,62,80,0.2)]">
                <img src={township.heroSrc} alt={township.image.alt} className="h-56 w-full object-cover" />
              </div>
            )}

            {mapSrc && (
              <div className="min-h-[280px] overflow-hidden rounded-2xl border border-hairline shadow-[0_30px_80px_-40px_rgba(44,62,80,0.2)]">
                <iframe
                  title={`${township.heading} ${township.headingEmphasis} location`}
                  src={mapSrc}
                  className="h-full min-h-[280px] w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}

            <div className="rounded-2xl bg-chrome p-6 text-white sm:p-7">
              <p className="font-display text-xl font-bold">Book a site visit</p>
              <p className="mt-2 text-sm text-white/72">
                Walk the layout in person and see the plots still open at {township.heading} {township.headingEmphasis}.
              </p>
              <button
                type="button"
                onClick={() => setSiteVisitOpen(true)}
                className="mt-5 w-full rounded-none border border-terracotta bg-terracotta px-5 py-3 text-sm font-semibold tracking-[0.04em] text-white uppercase transition-colors hover:border-white hover:bg-white hover:text-chrome"
              >
                Book a site visit
              </button>
              <a
                href={contact.phoneHref}
                className="mt-3 block w-full rounded-none border border-white/40 px-5 py-3 text-center text-sm font-semibold tracking-[0.04em] text-white uppercase transition-colors hover:border-white"
              >
                {contact.phone}
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
