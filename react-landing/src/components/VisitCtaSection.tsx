import { contact } from '../data/contact';

type VisitCtaSectionProps = {
  /** Opens the site-visit concierge drawer (same flow as "Book a site visit"). */
  onRequestPlan?: () => void;
};

/** Full-bleed prompt that sits directly above the delivered-record section,
 *  colour-matched to the footer so the page closes on a consistent dark note. */
export function VisitCtaSection({ onRequestPlan }: VisitCtaSectionProps) {
  return (
    <section className="relative overflow-hidden border-y border-hairline-dark bg-chrome px-6 py-16 text-center sm:px-10 sm:py-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <h2 className="font-display text-balance text-4xl font-bold leading-tight text-white sm:text-6xl">
          Walk the plot before you book it.
        </h2>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.75] text-white/70">
          Site visits run seven days a week at both townships. Our consultant will show you the
          layout, the approvals and the plots still open.
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <a
            href={contact.phoneHref}
            className="rounded-none border border-terracotta-light bg-terracotta-light px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-chrome transition-colors hover:border-white hover:bg-white sm:px-8"
          >
            Call {contact.phone}
          </a>
          <button
            type="button"
            onClick={onRequestPlan}
            className="rounded-none border border-white/45 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-white hover:bg-white/10 sm:px-8"
          >
            Request the layout plan
          </button>
        </div>
      </div>
    </section>
  );
}
