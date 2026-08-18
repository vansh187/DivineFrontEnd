import { useRef, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { deliveredRecords } from '../data/deliveredRecords';
import { company } from '../data/company';

function SpeakerMutedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
      <path
        fill="currentColor"
        d="M4 9v6h4l5 5V4L8 9H4Zm12.7-.3 1.4 1.4-2.9 2.9 2.9 2.9-1.4 1.4-2.9-2.9-2.9 2.9-1.4-1.4 2.9-2.9-2.9-2.9 1.4-1.4 2.9 2.9 2.9-2.9Z"
      />
    </svg>
  );
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
      <path
        fill="currentColor"
        d="M4 9v6h4l5 5V4L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z"
      />
    </svg>
  );
}

export function OurStoryPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.volume = 1;
    video.muted = nextMuted;
    setMuted(nextMuted);
    if (!nextMuted) video.play().catch(() => {});
  };

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="bg-bg pb-20">
        <section className="relative flex min-h-[min(760px,92svh)] overflow-hidden px-4 pt-28 text-white sm:px-10 sm:pt-32">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src="/our-story/our-story-hero.mp4"
            poster="/our-story/our-story-hero-poster.jpg"
            autoPlay
            muted={muted}
            loop
            playsInline
            aria-label="Cinematic OPS Divine Greens story video with optional background sound"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.24)_45%,rgba(0,0,0,0.72)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" />
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={!muted}
            aria-label={muted ? 'Turn on story video sound' : 'Mute story video sound'}
            className="absolute right-4 top-28 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/65 sm:right-10 sm:top-32"
          >
            {muted ? <SpeakerMutedIcon /> : <SpeakerOnIcon />}
          </button>

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-end pb-20">
            <p className="eyebrow-label text-terracotta-light">Our Story</p>
            <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.45fr)] lg:items-end">
              <h1 className="font-display text-balance text-4xl font-bold leading-tight sm:text-6xl">
                Building lived-in townships since {company.foundedYear}.
              </h1>
              <p className="text-[15px] leading-[1.75] text-white/82 [text-shadow:0_1px_14px_rgba(0,0,0,0.45)]">
                Divine Vision has focused on practical, connected communities across Ganaur,
                Karnal and Kurukshetra, with delivered handovers and approved plotted developments.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-6xl gap-5 px-4 sm:px-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-chrome p-6 text-white sm:p-8">
            <p className="eyebrow-label text-terracotta-light">The record</p>
            <p className="mt-4 font-display text-5xl font-bold">20+</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/72">
              Years on the NH-1 corridor, with five delivered townships and two active plotted
              communities now selling.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {company.locations.map((location) => (
                <span key={location} className="rounded-lg border border-white/12 bg-white/8 px-3 py-3 text-sm font-semibold">
                  {location}
                </span>
              ))}
              <span className="rounded-lg border border-white/12 bg-white/8 px-3 py-3 text-sm font-semibold">
                {company.compliance.join(' & ')}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
            {deliveredRecords.map((record, index) => (
              <div
                key={`${record.name}-${record.location}`}
                className={`grid gap-2 px-5 py-5 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center ${
                  index > 0 ? 'border-t border-hairline' : ''
                }`}
              >
                <span className="eyebrow-label text-terracotta">{record.year}</span>
                <div>
                  <h2 className="text-lg font-bold text-ink">{record.name}</h2>
                  <p className="mt-1 text-sm text-ink-muted">{record.location}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-4 mt-10 max-w-6xl rounded-lg border border-hairline bg-surface p-6 sm:mx-10 sm:p-8 lg:mx-auto">
          <p className="eyebrow-label text-terracotta">Today</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-ink">Two more communities are selling now.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-[1.75] text-ink-muted">
            Suraksha Enclave Phase 2 and OPS Divine Greens continue the same corridor-first
            approach: reachable sites, clear approvals and community infrastructure planned around daily life.
          </p>
          <button
            type="button"
            onClick={() => setSiteVisitOpen(true)}
            className="mt-6 rounded-full bg-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-soft"
          >
            Book a site visit
          </button>
        </section>
      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
