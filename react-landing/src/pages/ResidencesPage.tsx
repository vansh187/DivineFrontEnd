import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';
import { townshipPricing } from '../data/townshipPricing';
import { journeyStops } from '../data/journeyStops';
import { contact } from '../data/contact';

const activeTownships = journeyStops.filter((stop) => stop.chips?.some((chip) => chip.includes('sq yd')));

export function ResidencesPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="bg-bg px-4 pb-20 pt-28 sm:px-10 sm:pt-32">
        <section className="mx-auto max-w-6xl">
          <p className="eyebrow-label text-terracotta">Residences</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.45fr)] lg:items-end">
            <h1 className="font-display text-balance text-4xl font-bold leading-tight text-ink sm:text-6xl">
              Township plots on the NH-1 corridor.
            </h1>
            <p className="text-[15px] leading-[1.75] text-ink-muted">
              Explore Divine Vision's current plotted townships in Ganaur and Karnal, with
              plot sizes, approvals and location highlights ready for a site visit.
            </p>
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-2">
          {activeTownships.map((township) => {
            const pricing = townshipPricing.find((item) => item.id === township.id);
            return (
              <article
                key={township.id}
                className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[0_20px_54px_-34px_rgba(6,31,45,0.3)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/9]">
                  <img src={township.image.src} alt={township.image.alt} className="h-full w-full object-cover" />
                  <span className="eyebrow-label absolute left-4 top-4 rounded bg-bg/95 px-2.5 py-1.5 text-[10px] text-ink/80 shadow-sm">
                    {township.reraId ? `RERA: ${township.reraId}` : township.image.tag}
                  </span>
                </div>
                <div className="p-5 sm:p-7">
                  <p className="eyebrow-label text-terracotta">{township.eyebrow}</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                    {township.heading} <em className="text-green not-italic">{township.headingEmphasis}</em>
                  </h2>
                  <p className="mt-3 text-sm leading-[1.7] text-ink-muted">{township.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {township.chips?.map((chip) => (
                      <span key={chip} className="rounded-full border border-hairline bg-bg px-3 py-2 text-xs font-semibold text-ink/80">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-semibold text-ink">
                      {pricing ? `From ${pricing.minSqYd}-${pricing.maxSqYd} sq yd` : 'Site visit available'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSiteVisitOpen(true)}
                      className="rounded-full bg-green px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-soft"
                    >
                      Book a site visit
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mx-auto mt-8 max-w-6xl rounded-lg bg-chrome px-5 py-6 text-white sm:px-7">
          <p className="font-display text-2xl font-bold">Prefer to speak first?</p>
          <p className="mt-2 text-sm text-white/72">Call the sales team and choose a convenient site visit slot.</p>
          <a href={contact.phoneHref} className="mt-5 inline-flex rounded-none border border-white bg-white px-5 py-3 text-sm font-semibold tracking-[0.04em] text-chrome uppercase transition-colors hover:bg-terracotta hover:border-terracotta hover:text-white">
            {contact.phone}
          </a>
        </section>
      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
