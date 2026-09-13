import { useEffect, useRef, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { siteProgressGalleryByTownship } from '../data/siteProgressGallery';
import { journeyStops } from '../data/journeyStops';

type FilterId = 'all' | keyof typeof siteProgressGalleryByTownship;

const townshipLabel: Record<string, string> = Object.fromEntries(
  journeyStops.filter((stop) => stop.heroSrc).map((stop) => [stop.id, `${stop.heading} ${stop.headingEmphasis}`]),
);

const townshipCount = Object.keys(siteProgressGalleryByTownship).length;
const totalPhotoCount = Object.values(siteProgressGalleryByTownship).reduce((sum, list) => sum + list.length, 0);

const filters: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All work' },
  ...(Object.keys(siteProgressGalleryByTownship) as (keyof typeof siteProgressGalleryByTownship)[]).map((id) => ({
    id,
    label: townshipLabel[id] ?? id,
  })),
];

export function OurWorkPage() {
  const heroFilmRef = useRef<HTMLVideoElement>(null);
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [heroFilmMuted, setHeroFilmMuted] = useState(false);

  const entries = Object.entries(siteProgressGalleryByTownship) as [
    keyof typeof siteProgressGalleryByTownship,
    (typeof siteProgressGalleryByTownship)[string],
  ][];

  const allPhotos = entries.flatMap(([townshipId, list]) => list.map((photo) => ({ ...photo, townshipId })));
  const [featured, ...rest] = allPhotos;
  const filteredRest = rest.filter((photo) => activeFilter === 'all' || activeFilter === photo.townshipId);
  const showFeatured = activeFilter === 'all' || activeFilter === featured?.townshipId;

  useEffect(() => {
    const video = heroFilmRef.current;
    if (!video) return;

    video.muted = false;
    setHeroFilmMuted(false);
    video.play().catch(() => {
      video.muted = true;
      setHeroFilmMuted(true);
      video.play().catch(() => {});
    });
  }, []);

  const toggleHeroFilmSound = () => {
    const video = heroFilmRef.current;
    if (!video) return;

    const nextMuted = !video.muted;
    video.volume = 1;
    video.muted = nextMuted;
    setHeroFilmMuted(nextMuted);
    if (!nextMuted) video.play().catch(() => {});
  };

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="bg-bg">
        {/* Hero — full-bleed dark, the same register as the founder page and
            hero video, so "Our Work" reads as a flagship page, not a folder
            of thumbnails. */}
        <section className="relative overflow-hidden bg-chrome px-4 pb-16 pt-28 sm:px-10 sm:pb-20 sm:pt-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_10%,rgba(230,126,34,0.16),transparent_58%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_100%,rgba(230,126,34,0.1),transparent_60%)]" />
          <div className="relative z-10 mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.72fr)] lg:items-center">
            <div>
            <span className="eyebrow-label text-terracotta-light">Our work</span>
            <h1 className="mt-5 max-w-[16ch] font-display text-balance text-5xl font-bold leading-[1.05] text-white sm:text-7xl">
              Proof, not promises.
            </h1>
            <p className="mt-6 max-w-[58ch] text-[15px] leading-[1.85] text-white/72 sm:text-[17px]">
              No renders on this page. Every photograph here is unretouched and on ground — gates
              you can drive through, buildings already occupied, streets already walked. This is
              what &ldquo;delivered&rdquo; actually looks like along the NH-1 corridor.
            </p>

            <div className="mt-10 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/12 bg-white/12">
              {[
                [String(totalPhotoCount), 'photographs'],
                [String(townshipCount), 'townships'],
                ['0', 'renders'],
              ].map(([value, label]) => (
                <div key={label} className="bg-white/6 px-3 py-5 text-center">
                  <p className="font-display text-3xl font-bold text-white">{value}</p>
                  <p className="eyebrow-label mt-1 text-[9px] text-terracotta-light">{label}</p>
                </div>
              ))}
            </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-5 rounded-[2rem] border border-terracotta-light/20 bg-white/[0.03]" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-black shadow-[0_44px_120px_-42px_rgba(0,0,0,0.78)]">
                <video
                  ref={heroFilmRef}
                  className="aspect-[4/5] h-[520px] w-full object-cover"
                  src="/our-work/ops-divine-premium.mp4"
                  poster="/townships/ops-hero.jpg"
                  autoPlay
                  muted={heroFilmMuted}
                  loop
                  playsInline
                  preload="metadata"
                  aria-label="Premium on-site video from OPS Divine Greens"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,31,45,0.08)_0%,rgba(6,31,45,0.2)_52%,rgba(6,31,45,0.78)_100%)]" />
                {/* Covers the AI-generation watermark baked into the corner of the source clip. */}
                <div className="pointer-events-none absolute bottom-0 right-0 h-16 w-32 bg-chrome/40 backdrop-blur-md" />
                <button
                  type="button"
                  onClick={toggleHeroFilmSound}
                  aria-pressed={!heroFilmMuted}
                  className="absolute right-5 top-5 rounded-full border border-white/25 bg-black/45 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/88 backdrop-blur-sm transition-colors hover:border-terracotta-light hover:text-white"
                >
                  {heroFilmMuted ? 'Sound off' : 'Sound on'}
                </button>
                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-5">
                  <div>
                    <p className="eyebrow-label text-terracotta-light">OPS Divine Greens</p>
                    <p className="mt-2 max-w-[20ch] font-display text-2xl font-bold leading-tight text-white">
                      Living proof of craft.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-terracotta-light/45 bg-black/45 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/88 backdrop-blur-sm">
                    Site film
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured — one large, immersive frame before the grid narrows down. */}
        {featured && showFeatured && (
          <section className="mx-auto -mt-10 max-w-6xl px-4 sm:px-10">
            <div className="group relative overflow-hidden rounded-3xl border border-hairline-dark shadow-[0_60px_140px_-50px_rgba(6,31,45,0.65)]">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black sm:aspect-[21/9]">
                <img
                  src={featured.src}
                  alt={featured.alt}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(6,31,45,0.88)_0%,rgba(6,31,45,0.25)_45%,transparent_75%)]" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-10">
                  <span className="eyebrow-label w-fit text-terracotta-light">{featured.label}</span>
                  <h2 className="max-w-[24ch] font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
                    {featured.title}
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-sm leading-[1.7] text-white/78 sm:text-[15px]">{featured.note}</p>
                  <span className="mt-2 w-fit rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/85 backdrop-blur-sm">
                    {townshipLabel[featured.townshipId] ?? featured.townshipId}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-10 sm:mt-20">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface p-2 shadow-[0_18px_50px_-38px_rgba(6,31,45,0.3)] sm:inline-flex">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-chrome text-white shadow-sm'
                    : 'text-ink-muted hover:bg-bg hover:text-ink'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRest.map((photo) => (
              <article
                key={photo.src}
                className="group overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_24px_72px_-50px_rgba(6,31,45,0.38)] transition-shadow duration-300 hover:shadow-[0_34px_90px_-46px_rgba(6,31,45,0.48)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-black">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(6,31,45,0.7)_0%,transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/44 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                    {photo.label}
                  </span>
                  <span className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/85 backdrop-blur-sm">
                    {townshipLabel[photo.townshipId] ?? photo.townshipId}
                  </span>
                </div>
                <div className="p-4 sm:p-5">
                  <h3 className="font-display text-xl font-bold leading-tight text-ink">{photo.title}</h3>
                  <p className="mt-2 text-sm leading-[1.65] text-ink-muted">{photo.note}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Closing — full-bleed dark, mirrors the hero so the page opens and
            closes on the same note. */}
        <section className="relative mt-20 overflow-hidden bg-chrome px-4 py-16 text-center sm:px-10 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_40%,rgba(230,126,34,0.12),transparent_65%)]" />
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center">
            <h2 className="font-display text-balance text-2xl font-bold leading-[1.2] text-white sm:text-4xl">
              Seeing it on a screen only goes so far.
            </h2>
            <p className="mt-3 max-w-[52ch] text-sm leading-[1.75] text-white/70">
              Walk the same streets, inspect the same buildings, and decide with your own eyes.
            </p>
            <button
              type="button"
              onClick={() => setSiteVisitOpen(true)}
              className="mt-7 rounded-none border border-terracotta-light bg-terracotta-light px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-chrome transition-colors hover:border-white hover:bg-white"
            >
              Book a site visit
            </button>
          </div>
        </section>
      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
