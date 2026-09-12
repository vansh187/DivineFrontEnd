import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { deliveredRecords } from '../data/deliveredRecords';
import { company } from '../data/company';

function StandardIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d={path} />
    </svg>
  );
}

const pinPath = 'M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z';
const shieldPath = 'M12 3l7 3v5.5c0 4.7-3 8.9-7 10-4-1.1-7-5.3-7-10V6l7-3Zm-1.1 10.6L8.5 11l-1.2 1.2 3.6 3.6 6-6-1.2-1.2-4.8 4.8Z';
const buildingPath = 'M5 21V6l7-3 7 3v15M9 21v-5h6v5M9 10h.01M9 13h.01M15 10h.01M15 13h.01';
const compassPath = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z';

/** Standing plotted-township standard, told the way a founder would say it to
 *  a buyer's face — not as a service menu. */
const standards = [
  {
    icon: pinPath,
    title: 'Location discipline',
    text: 'Every township sits on the NH-1 growth corridor itself, not two districts from an announced expressway — plots you can drive to today.',
  },
  {
    icon: shieldPath,
    title: 'Approval clarity',
    text: 'RERA compliance, plot documentation and buyer paperwork are settled before launch, not fixed after a booking is made.',
  },
  {
    icon: buildingPath,
    title: 'Refined handover',
    text: 'Landscape, internal roads and common areas are planned to still look considered five years after the last plot sells.',
  },
];

const goals = [
  {
    title: 'Approval-led, always',
    text: 'No township is announced before its compliance is settled — buyer confidence starts before the brochure does.',
  },
  {
    title: 'Site-first, not brochure-first',
    text: 'Progress is meant to be walked and photographed on ground, so a buyer never has to take a rendering on faith.',
  },
  {
    title: 'Built to mature',
    text: 'Infrastructure and landscape are planned for the fifth year of a neighbourhood, not just the ribbon-cutting.',
  },
];

/** Founder-first narrative, in the order the family actually lived it —
 *  Jawahar Luthra's first venture, Himashu Luthra taking Divine Vision
 *  forward from 2005, and the corridor record that followed. Facts pulled
 *  from the group's own brochure so this reads as history, not marketing. */
const timeline = [
  {
    eyebrow: 'How it started',
    title: "A father's belief that ordinary land deserved better",
    text: 'In 1985, Jawahar Luthra left Indri for Delhi to trade electronic parts in Lajpat Rai Market. Two decades later, in 2004, that same discipline turned toward real estate with Divine City on NH-1 — one plotted township that has since grown into 5 million+ sq. ft. delivered.',
  },
  {
    eyebrow: 'How we are growing',
    title: 'A second generation, trained on trust rather than scale',
    text: 'Himashu Luthra joined Divine Vision Infratech in 2005 after years in global electronics trade across five countries, choosing to build value the slower way: through approvals, plot planning and a name families in Ganaur, Karnal and Kurukshetra were willing to bet on.',
  },
  {
    eyebrow: 'Where we are headed',
    title: 'A corridor legacy, handed to the next family in line',
    text: 'Suraksha Enclave and OPS Divine Greens carry that same standard forward — RERA-approved, club-amenitied, and planned for people who intend to actually live there, not just hold the paperwork.',
  },
];

export function OurStoryPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="bg-bg">
        {/* Hero — full-bleed dark, founder portrait carrying the weight the
            copy alone can't: this is a name behind the brand, not a logo. */}
        <section className="relative overflow-hidden bg-chrome px-4 pb-10 pt-24 sm:px-10 sm:pb-14 sm:pt-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_18%_10%,rgba(230,126,34,0.14),transparent_58%)]" />
          <div className="relative z-10 mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <span className="eyebrow-label text-terracotta-light">Our story</span>
              <h1 className="mt-4 max-w-[14ch] font-display text-balance text-4xl font-bold leading-[1.08] text-white sm:text-6xl">
                We don&rsquo;t sell plots. We deliver on a director&rsquo;s word.
              </h1>
              <p className="mt-6 max-w-[54ch] text-[15px] leading-[1.85] text-white/72 sm:text-[16px]">
                Divine Vision Infratech has spent {new Date().getFullYear() - company.foundedYear}+ years turning
                NH-1 corridor land into {company.compliance.join(' & ')}-approved townships families actually
                live in — Ganaur to Karnal to Kurukshetra, five delivered, two more taking shape.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSiteVisitOpen(true)}
                  className="rounded-none border border-terracotta bg-terracotta px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-white hover:bg-white hover:text-chrome"
                >
                  Book a site visit
                </button>
                <a
                  href="/residences"
                  className="rounded-none border border-white/40 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-white"
                >
                  Explore residences
                </a>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/12 bg-white/12 max-w-md">
                {[
                  [`${new Date().getFullYear() - company.foundedYear}+`, 'years'],
                  ['5', 'delivered'],
                  ['2', 'active'],
                ].map(([value, label]) => (
                  <div key={label} className="bg-white/6 px-3 py-4 text-center">
                    <p className="font-display text-2xl font-bold text-white">{value}</p>
                    <p className="eyebrow-label mt-1 text-[9px] text-terracotta-light">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto w-full max-w-[400px]">
              <div className="overflow-hidden rounded-2xl border border-white/18 bg-white/[0.04] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.7)]">
                <div className="relative aspect-square w-full overflow-hidden bg-black">
                  <img
                    src="/founder/himashu-luthra.jpg"
                    alt="Himashu Luthra, Director of Divine Vision Infratech"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,31,45,0.05)_0%,transparent_30%,rgba(6,31,45,0.25)_100%)]" />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/12 bg-white/[0.06] px-5 py-4">
                  <div>
                    <p className="text-sm font-bold text-white">Himashu Luthra</p>
                    <p className="mt-0.5 text-xs text-white/62">Director, Divine Vision Infratech</p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta text-xs font-bold text-white">
                    HL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Director's vision — quote on the left, the family's own
            three-beat history on the right, in the order it actually happened. */}
        <section className="border-b border-hairline bg-surface px-4 pb-16 pt-10 sm:px-10 sm:pb-24 sm:pt-14">
          <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <span className="eyebrow-label text-terracotta">Director&rsquo;s vision</span>
              <h2 className="mt-4 max-w-[20ch] font-display text-balance text-3xl font-bold leading-[1.12] text-ink sm:text-4xl">
                A township should feel complete before a family ever moves in.
              </h2>
              <div className="mt-8 border-l-4 border-terracotta pl-5">
                <p className="text-[15px] leading-[1.85] text-ink-muted">
                  Divine Vision is built around a simple belief: land ownership should feel as solid as the
                  family behind it. Every decision — location, approvals, plot size, amenities — is made so a
                  buyer can verify it, not just trust it.
                </p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-chrome">
                  Himashu Luthra, Director
                </p>
              </div>
            </div>

            <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline">
                {timeline.map((stop) => (
                  <div key={stop.eyebrow} className="bg-surface p-6 sm:p-7">
                    <p className="eyebrow-label text-terracotta">{stop.eyebrow}</p>
                    <h3 className="mt-2.5 font-display text-xl font-bold leading-tight text-ink sm:text-2xl">
                      {stop.title}
                    </h3>
                    <p className="mt-3 text-sm leading-[1.75] text-ink-muted">{stop.text}</p>
                  </div>
                ))}
              </div>
            </div>
        </section>

        {/* The Divine standard — the same three commitments the old page
            listed, now given room and an icon each. */}
        <section className="bg-bg px-4 py-16 sm:px-10 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <span className="eyebrow-label text-terracotta">The Divine standard</span>
              <h2 className="mt-4 max-w-[18ch] font-display text-balance text-3xl font-bold leading-[1.12] text-ink sm:text-5xl">
                What every township is built to deliver.
              </h2>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {standards.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-hairline bg-surface p-6 shadow-[0_22px_58px_-46px_rgba(6,31,45,0.34)] sm:p-7"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-terracotta/12 text-terracotta">
                    <StandardIcon path={item.icon} />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-bold leading-tight text-ink">{item.title}</h3>
                  <p className="mt-3 text-sm leading-[1.75] text-ink-muted">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Our goals — numbered, the way a promise reads better than a
            service list. */}
        <section className="border-y border-hairline bg-surface px-4 py-16 sm:px-10 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-chrome/8 text-chrome">
                <StandardIcon path={compassPath} />
              </span>
              <span className="eyebrow-label mt-5 block text-terracotta">Our goals</span>
              <h2 className="mt-3 max-w-[14ch] font-display text-balance text-3xl font-bold leading-[1.12] text-ink sm:text-4xl">
                Growth measured in handovers, not headlines.
              </h2>
            </div>
            <div className="grid gap-0">
              {goals.map((goal, index) => (
                <div
                  key={goal.title}
                  className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 border-t border-hairline py-6 first:border-t-0 first:pt-0 sm:grid-cols-[72px_minmax(0,1fr)]"
                >
                  <span className="font-display text-2xl font-bold text-terracotta sm:text-3xl">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold leading-tight text-ink sm:text-xl">{goal.title}</h3>
                    <p className="mt-2 text-sm leading-[1.75] text-ink-muted">{goal.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Corridor legacy + delivered record — the receipts. */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-10 sm:py-24">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative overflow-hidden rounded-xl bg-chrome p-6 text-white sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_0%,rgba(230,126,34,0.14),transparent_65%)]" />
              <div className="relative">
                <p className="eyebrow-label text-terracotta-light">The record</p>
                <p className="mt-4 font-display text-5xl font-bold">
                  {new Date().getFullYear() - company.foundedYear}+
                </p>
                <p className="mt-2 text-sm leading-[1.7] text-white/72">
                  Years on the NH-1 corridor, guided by a clear goal: deliver refined plotted communities with
                  credible approvals, visible progress and long-term value.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {company.locations.map((location) => (
                    <span key={location} className="rounded-lg border border-white/12 bg-white/8 px-3 py-3 text-sm font-semibold">
                      {location}
                    </span>
                  ))}
                  <span className="rounded-lg border border-white/12 bg-white/8 px-3 py-3 text-sm font-semibold">
                    {company.compliance.join(' & ')}-approved
                  </span>
                </div>

                <div className="mt-8 border-t border-white/12 pt-8">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-terracotta-light/50 text-terracotta-light">
                    <StandardIcon path={compassPath} />
                  </span>
                  <p className="eyebrow-label mt-4 text-terracotta-light">Our vision</p>
                  <h2 className="mt-3 font-display text-balance text-2xl font-bold leading-[1.2] sm:text-3xl">
                    To make land ownership along NH-1 something a family is proud to inherit.
                  </h2>
                  <p className="mt-3 text-sm leading-[1.75] text-white/70">
                    Not a plot number on a certificate — a place the next generation points to and says their
                    family built it, on purpose, on this road.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSiteVisitOpen(true)}
                    className="mt-6 rounded-none border border-terracotta-light bg-terracotta-light px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-chrome transition-colors hover:border-white hover:bg-white"
                  >
                    Book a site visit
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
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
                    {record.detail && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{record.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
