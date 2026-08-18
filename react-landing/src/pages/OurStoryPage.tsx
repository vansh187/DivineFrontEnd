import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { deliveredRecords } from '../data/deliveredRecords';
import { company } from '../data/company';

export function OurStoryPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="bg-bg px-4 pb-20 pt-28 sm:px-10 sm:pt-32">
        <section className="mx-auto max-w-6xl">
          <p className="eyebrow-label text-terracotta">Our Story</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.45fr)] lg:items-end">
            <h1 className="font-display text-balance text-4xl font-bold leading-tight text-ink sm:text-6xl">
              Building lived-in townships since {company.foundedYear}.
            </h1>
            <p className="text-[15px] leading-[1.75] text-ink-muted">
              Divine Vision has focused on practical, connected communities across Ganaur,
              Karnal and Kurukshetra, with delivered handovers and approved plotted developments.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
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

        <section className="mx-auto mt-10 max-w-6xl rounded-lg border border-hairline bg-surface p-6 sm:p-8">
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
