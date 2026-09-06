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

  const pillars = [
    {
      label: 'Vision',
      title: 'To shape landmark communities with lasting pride.',
      text:
        'Divine Vision is built around a simple belief: a township should feel considered from the entrance gate to the evening walk home. Our vision is to create plotted communities that carry elegance, order and everyday comfort without losing the warmth of a real neighbourhood.',
    },
    {
      label: 'Goal',
      title: 'To make premium land ownership transparent and reachable.',
      text:
        'Our goal is to keep every decision clear for families and investors: connected locations, approval-led development, practical plot sizes and a site experience that shows exactly what is being built. Luxury, for us, begins with confidence.',
    },
    {
      label: 'Promise',
      title: 'To deliver places that mature beautifully over time.',
      text:
        'We measure success by handovers, habitability and long-term value. Every new community continues the standard set across our delivered record: thoughtful planning, dependable infrastructure and environments people are proud to call their own.',
    },
  ];

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="bg-bg pb-20">
        <section className="relative overflow-hidden border-b border-hairline bg-bg px-4 pb-10 pt-24 text-ink sm:px-10 sm:pb-12 sm:pt-28">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#f5f2ea_58%,#ece7d9_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.45] [background-image:linear-gradient(rgba(6,31,45,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(6,31,45,0.06)_1px,transparent_1px)] [background-size:88px_88px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-chrome" />

          <div className="relative z-10 mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(340px,0.9fr)_minmax(260px,360px)_minmax(340px,0.95fr)] lg:items-start">
            <div className="flex max-w-xl flex-col pt-2">
              <p className="eyebrow-label text-terracotta">Founder's Page</p>
              <h1 className="mt-4 max-w-[12ch] font-display text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl xl:text-6xl">
                The founder's blueprint for better communities.
              </h1>
              <p className="mt-5 max-w-[48ch] text-[15px] leading-[1.78] text-ink-muted sm:text-[16px]">
                A clear founder message on building refined, approval-led townships with
                disciplined planning, trusted delivery and long-term value for families who want
                confidence before they invest, comfort when they visit and pride when the
                community begins to mature.
              </p>
              <div className="mt-7 h-px w-24 bg-terracotta" />
              <p className="mt-5 max-w-[48ch] text-sm leading-[1.85] text-ink-muted">
                The page reflects the leadership standard behind the brand: measured growth,
                transparent approvals and communities that should feel complete, calm and
                premium from the first visit. Every project is presented with the same focus:
                clear land planning, thoughtful amenities, dependable infrastructure and a
                neighbourhood experience that can support real everyday life, not only a promise
                on paper.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline shadow-[0_22px_54px_-38px_rgba(6,31,45,0.34)]">
                {[
                  ['20+', 'years'],
                  ['5', 'delivered'],
                  ['2', 'active'],
                ].map(([value, label]) => (
                  <div key={label} className="bg-surface px-3 py-4 text-center">
                    <p className="font-display text-2xl font-bold text-chrome">{value}</p>
                    <p className="eyebrow-label mt-1 text-[9px] text-terracotta">{label}</p>
                  </div>
                ))}
              </div>
              <figure className="mt-5 rounded-xl bg-chrome p-6 text-white shadow-[0_30px_82px_-48px_rgba(6,31,45,0.62)]">
                <figcaption className="eyebrow-label text-terracotta-light">Signature Goal</figcaption>
                <blockquote className="mt-3 font-display text-3xl font-bold leading-tight">
                  Clear on paper. Confident on site. Valuable over time.
                </blockquote>
                <div className="mt-5 h-px w-20 bg-terracotta" />
                <p className="mt-4 text-sm leading-[1.75] text-white/72">
                  A founder-led standard for every buyer conversation, every township plan and every delivery milestone.
                </p>
              </figure>
              <div className="mt-7 rounded-xl border border-hairline bg-white/72 p-5 shadow-[0_22px_58px_-42px_rgba(6,31,45,0.34)] backdrop-blur-sm">
                <p className="eyebrow-label text-chrome">Founder's Principles</p>
                <div className="mt-4 grid gap-3">
                  {[
                    ['Approval-led', 'Every township begins with clear compliance and buyer confidence.'],
                    ['Site-first', 'Progress should be visible on ground before it becomes a promise.'],
                    ['Built to mature', 'Planning, landscape and infrastructure must hold value over time.'],
                  ].map(([title, text]) => (
                    <div key={title} className="border-t border-hairline pt-3 first:border-t-0 first:pt-0">
                      <p className="font-display text-lg font-bold leading-tight text-ink">{title}</p>
                      <p className="mt-1 text-sm leading-[1.65] text-ink-muted">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-[360px] gap-5">
              <div className="relative overflow-hidden rounded-xl border border-white/20 bg-black shadow-[0_34px_90px_-44px_rgba(6,31,45,0.72)]">
                <video
                  ref={videoRef}
                  className="block aspect-[9/16] w-full object-cover"
                  src="/our-story/founders-desk.mp4"
                  autoPlay
                  muted={muted}
                  loop
                  playsInline
                  aria-label="Founder desk message about the Divine Vision story with optional sound"
                />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/16" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(6,31,45,0.45),transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(0deg,rgba(6,31,45,0.34),transparent)]" />
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={!muted}
                  aria-label={muted ? 'Turn on story video sound' : 'Mute story video sound'}
                  className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/52 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/72"
                >
                  {muted ? <SpeakerMutedIcon /> : <SpeakerOnIcon />}
                </button>
              </div>
              <div className="rounded-xl border border-hairline bg-white/82 p-5 text-center shadow-[0_20px_58px_-42px_rgba(6,31,45,0.42)]">
                <p className="eyebrow-label text-terracotta">Founder's Desk</p>
                <p className="mt-3 font-display text-2xl font-bold leading-tight text-ink">
                  Leadership you can hear. Delivery you can verify.
                </p>
                <div className="mx-auto mt-4 h-px w-20 bg-terracotta" />
                <p className="mt-4 text-sm leading-[1.7] text-ink-muted">
                  A direct message on the discipline behind every Divine Vision township.
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-[linear-gradient(180deg,#ffffff_0%,#f2efe6_100%)] p-5 shadow-[0_20px_58px_-42px_rgba(6,31,45,0.34)]">
                <p className="eyebrow-label text-chrome">Corridor Legacy</p>
                <div className="mt-4 grid gap-3">
                  {[
                    ['2005', 'Started with a long-term view of the NH-1 growth corridor.'],
                    ['2007-17', 'Delivered communities across Kurukshetra and Karnal.'],
                    ['Today', 'Active plotted townships shaped for premium family ownership.'],
                  ].map(([year, text]) => (
                    <div key={year} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-t border-hairline pt-3 first:border-t-0 first:pt-0">
                      <span className="font-display text-xl font-bold text-terracotta">{year}</span>
                      <p className="text-sm leading-[1.65] text-ink-muted">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:pt-2">
              <div className="flex min-h-[332px] flex-col justify-between rounded-xl border border-hairline bg-[linear-gradient(135deg,#ffffff_0%,#f7f2e8_58%,#eef4ef_100%)] p-5 shadow-[0_28px_74px_-48px_rgba(6,31,45,0.36)] lg:p-7">
                <div>
                  <span className="eyebrow-label text-chrome">Leadership Message</span>
                  <h2 className="mt-4 max-w-[12ch] font-display text-4xl font-bold leading-tight text-ink xl:text-5xl">
                    Disciplined leadership. Delivered communities.
                  </h2>
                  <div className="mt-6 h-px w-20 bg-terracotta" />
                </div>
                <div className="mt-8">
                  <p className="max-w-3xl text-sm leading-[1.85] text-ink-muted">
                    The founder's message sets the tone for how Divine Vision wants every buyer
                    to experience the brand: with clarity, respect for timelines and a premium
                    township environment that feels practical, composed and future-ready.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline text-center">
                    {['Approval-led', 'Site-first', 'Premium planning', 'Long-term value'].map((item) => (
                      <span key={item} className="bg-white/82 px-3 py-4 text-xs font-semibold uppercase tracking-[0.08em] text-chrome">
                        {item}
                      </span>
                    ))}
                  </div>
                  <span className="mt-6 block text-right text-xs font-semibold text-ink-muted">
                    Divine Vision Infratech Pvt. Ltd.
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-hairline bg-surface p-5 shadow-[0_18px_48px_-36px_rgba(6,31,45,0.28)] lg:p-7">
                <p className="eyebrow-label text-terracotta">Today</p>
                <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-ink">
                  The next chapter is more refined, more connected and more deliberate.
                </h2>
                <p className="mt-3 text-sm leading-[1.75] text-ink-muted">
                  Suraksha Enclave and OPS Divine Greens carry the brand forward with a
                  premium township experience: reachable locations, clear approvals, landscape-led
                  planning, club amenities and community infrastructure designed around graceful daily life.
                </p>
                <button
                  type="button"
                  onClick={() => setSiteVisitOpen(true)}
                  className="mt-5 rounded-full bg-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-soft"
                >
                  Book a site visit
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-hairline bg-white/78 shadow-[0_18px_54px_-40px_rgba(6,31,45,0.28)]">
                <div className="border-b border-hairline px-5 py-4 sm:px-6">
                  <p className="eyebrow-label text-terracotta">The Divine Standard</p>
                </div>
                <div className="grid gap-px bg-hairline">
                  {[
                    ['Location discipline', 'Projects chosen around real access, daily movement and visible corridor value.'],
                    ['Approval clarity', 'Compliance, plot planning and buyer documentation kept central from the start.'],
                    ['Refined handover', 'Infrastructure, landscape and common spaces planned to feel complete over time.'],
                  ].map(([title, text]) => (
                    <div key={title} className="bg-white/78 p-5 sm:p-6">
                      <h3 className="font-display text-xl font-bold leading-tight text-ink">{title}</h3>
                      <p className="mt-3 text-sm leading-[1.7] text-ink-muted">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-6xl gap-px overflow-hidden rounded-lg border border-hairline bg-hairline px-0 sm:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.label} className="bg-surface p-6 sm:p-7">
              <p className="eyebrow-label text-terracotta">{pillar.label}</p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-ink">{pillar.title}</h2>
              <p className="mt-4 text-sm leading-[1.75] text-ink-muted">{pillar.text}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-10 grid max-w-6xl gap-5 px-4 sm:px-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg bg-chrome p-6 text-white sm:p-8">
            <p className="eyebrow-label text-terracotta-light">The record</p>
            <p className="mt-4 font-display text-5xl font-bold">20+</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/72">
              Years on the NH-1 corridor, guided by a clear goal: deliver refined plotted
              communities with credible approvals, visible progress and long-term value.
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
      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
