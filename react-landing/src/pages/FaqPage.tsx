import { useOutletContext } from 'react-router-dom';
import { faqCategories } from '../data/faqContent';
import { contact } from '../data/contact';
import type { SiteOutletContext } from '../components/SiteLayout';

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-terracotta transition-transform duration-200 group-open:rotate-180"
    >
      <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FaqAccordionItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-hairline last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-display text-base font-semibold text-ink marker:hidden sm:text-lg">
        {q}<ChevronIcon />
      </summary>
      <p className="pb-4 text-[15px] leading-[1.75] text-ink-muted">{a}</p>
    </details>
  );
}

export function FaqPage() {
  const { onBookVisit } = useOutletContext<SiteOutletContext>();
  return (
    <main className="bg-bg px-4 pb-20 pt-28 sm:px-10 sm:pt-32">
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqCategories.flatMap((category) => category.items).map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        })}
      </script>
      <section className="mx-auto max-w-6xl">
        <p className="eyebrow-label text-terracotta">Help</p>
        <h1 className="mt-3 font-display text-balance text-4xl font-bold leading-tight text-ink sm:text-6xl">
          Frequently asked questions.
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.8] text-ink-muted">
          Straight answers about booking, payments, KYC and RERA — covering exactly how the process works on this
          site. Can&rsquo;t find what you need? Divine Assist or our sales team can help directly.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-6xl">
        <div className="mt-6 space-y-8">
          {faqCategories.map((category) => (
            <section key={category.id} aria-labelledby={`faq-${category.id}`}>
              <h2 id={`faq-${category.id}`} className="mb-3 font-display text-xl font-bold text-ink">{category.label}</h2>
              <div className="rounded-2xl border border-hairline bg-surface px-5 sm:px-7">
                {category.items.map((item) => <FaqAccordionItem key={item.q} q={item.q} a={item.a} />)}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-6xl rounded-2xl bg-chrome px-6 py-10 text-center text-white sm:px-10">
        <p className="eyebrow-label text-terracotta-light">Still have questions?</p>
        <h2 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Talk to a real person, or book a visit.</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBookVisit}
            className="rounded-none border border-terracotta bg-terracotta px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-white hover:bg-white hover:text-chrome"
          >
            Book a site visit
          </button>
          <a
            href={contact.phoneHref}
            className="rounded-none border border-white/40 px-6 py-3 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-white"
          >
            {contact.phone}
          </a>
        </div>
      </section>
    </main>
  );
}
