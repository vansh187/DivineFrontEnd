import { useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';
import { journeyStops } from '../data/journeyStops';
import { townshipLocations } from '../data/locationConnectivity';
import { ConnectivityList } from '../components/ConnectivityList';
import { getProjectDetail } from '../data/projectDetails';
import { townshipVideoFor } from '../data/townshipVideos';
import { siteProgressGalleryFor } from '../data/siteProgressGallery';
import { contact } from '../data/contact';
import { brochureByTownshipId } from '../data/brochures';
import { useAuth } from '../hooks/useAuth';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { loadSavedTownships, toggleSavedTownship } from '../services/savedTownships';
import type { SiteOutletContext } from '../components/SiteLayout';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { onBookVisit } = useOutletContext<SiteOutletContext>();
  const { session, openModal } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
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

  // Same township walkthrough reel used on the landing "Now selling" card.
  const detailVideo = reducedMotion ? undefined : townshipVideoFor(id);
  const [featuredProgressPhoto, ...progressPhotos] = siteProgressGalleryFor(detail.id);
  const brochure = brochureByTownshipId[detail.id];

  return (
    <>
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
                <ConnectivityList items={location.connectivity} className="mt-4" />
                <p className="mt-3 text-xs leading-relaxed text-ink-muted/80">
                  Drive times are estimates for reference only — confirm exact routes with the sales desk.
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col gap-6">
            {township.heroSrc && (
              <div className="overflow-hidden rounded-2xl border border-hairline shadow-[0_30px_80px_-40px_rgba(44,62,80,0.2)]">
                {detailVideo ? (
                  <video
                    key={detailVideo}
                    className="h-56 w-full object-cover"
                    src={detailVideo}
                    poster={township.heroSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-label={township.image.alt}
                  />
                ) : (
                  <img src={township.heroSrc} alt={township.image.alt} className="h-56 w-full object-cover" />
                )}
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
                onClick={onBookVisit}
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

            {brochure && (
              <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_30px_80px_-40px_rgba(44,62,80,0.2)] sm:p-7">
                <p className="font-display text-xl font-bold text-ink">{brochure.label}</p>
                <p className="mt-2 text-sm text-ink-muted">{brochure.meta}</p>
                <a
                  href={brochure.href}
                  download={brochure.fileName}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-none border border-chrome bg-chrome px-5 py-3 text-sm font-semibold tracking-[0.04em] text-white uppercase transition-colors hover:border-terracotta hover:bg-terracotta"
                >
                  Download brochure
                  <span aria-hidden>↓</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {(featuredProgressPhoto || progressPhotos.length > 0) && (
          <section className="mx-auto mt-16 max-w-6xl border-t border-hairline pt-12 sm:mt-20 sm:pt-16">
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-px w-12 bg-terracotta" />
                  <p className="eyebrow-label text-terracotta">Our work</p>
                </div>
                <h2 className="mt-4 max-w-[11ch] font-display text-5xl font-bold leading-[0.95] text-ink sm:text-6xl">
                  Real ground, real township.
                </h2>
              </div>
              <div className="max-w-3xl border-l border-hairline pl-5">
                <p className="font-display text-2xl font-bold leading-tight text-ink">
                  A curated look at the township and everything already standing around it.
                </p>
                <p className="mt-4 text-sm leading-[1.85] text-ink-muted sm:text-[15px]">
                  From the entrance and internal roads to the commercial and residential blocks
                  already delivered nearby, these are unretouched photographs — turning the
                  neighbourhood into something a buyer can see before they visit.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
              {featuredProgressPhoto && (
                <div className="grid self-start gap-5">
                  <article className="group overflow-hidden rounded-2xl border border-hairline bg-chrome text-white shadow-[0_34px_100px_-54px_rgba(6,31,45,0.62)]">
                    <div className="relative aspect-[4/3] overflow-hidden bg-black">
                      <img
                        src={featuredProgressPhoto.src}
                        alt={featuredProgressPhoto.alt}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(6,31,45,0.86),transparent)]" />
                      <div className="absolute bottom-5 left-5 right-5">
                        <p className="eyebrow-label text-terracotta-light">{featuredProgressPhoto.label}</p>
                        <h3 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">{featuredProgressPhoto.title}</h3>
                      </div>
                    </div>
                    <div className="bg-[linear-gradient(180deg,#263d51_0%,#203548_100%)] p-5 sm:p-6">
                      <p className="text-sm leading-[1.75] text-white/74">{featuredProgressPhoto.note}</p>
                      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/12 bg-white/12 text-center">
                        {['Actual photos', 'On ground', 'Visit ready'].map((item) => (
                          <span key={item} className="bg-white/6 px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/82">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>

                  <div className="rounded-2xl border border-hairline bg-[linear-gradient(135deg,#ffffff_0%,#f7f2e8_58%,#eef4ef_100%)] p-5 shadow-[0_24px_72px_-52px_rgba(6,31,45,0.42)] sm:p-6">
                    <p className="eyebrow-label text-terracotta">See it in person</p>
                    <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-ink">
                      Walk the street, inspect the build, then choose with confidence.
                    </h3>
                    <p className="mt-3 text-sm leading-[1.7] text-ink-muted">
                      A site visit lets you compare plot frontage, construction quality, road width and neighbourhood progress on ground.
                    </p>
                    <button
                      type="button"
                      onClick={onBookVisit}
                      className="mt-5 w-full rounded-none border border-chrome bg-chrome px-5 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-terracotta hover:bg-terracotta"
                    >
                      Book a site visit
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {progressPhotos.map((photo) => (
                  <article
                    key={photo.src}
                    className="group overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_24px_72px_-50px_rgba(6,31,45,0.38)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-black">
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/44 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                        {photo.label}
                      </span>
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="font-display text-xl font-bold leading-tight text-ink">{photo.title}</h3>
                      <p className="mt-2 text-sm leading-[1.65] text-ink-muted">{photo.note}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
