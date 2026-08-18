import { useRef } from 'react';
import { HeroMedia } from './HeroMedia';
import { useHeroScrollTimeline } from '../hooks/useHeroScrollTimeline';
import { company } from '../data/company';

type HeroSectionProps = {
  onBookVisit?: () => void;
};

export function HeroSection({ onBookVisit }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useHeroScrollTimeline({ sectionRef, canvasWrapRef, copyRef });

  return (
    <header
      ref={sectionRef}
      className="relative flex min-h-[max(100svh,700px)] flex-col items-center justify-center overflow-x-hidden px-4 pb-10 pt-24 text-center sm:min-h-svh sm:px-6 sm:pb-0 sm:pt-20"
    >
      <div ref={canvasWrapRef} className="absolute inset-0 overflow-hidden">
        <HeroMedia />
        {/*
          Full-bleed darkening pass — never dips light in the middle, so
          copy stays AA-legible whether the crop underneath is bright sky
          or dark foliage. Nav itself is opaque (bg-chrome) so this isn't
          load-bearing for the logo/links, just the hero copy below it.
        */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.26)_42%,rgba(0,0,0,0.72)_100%)]" />
        {/* Vignette reinforces contrast directly behind the centred copy column. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,rgba(9,16,11,0.4),transparent_72%)]" />
        {/* Bottom fade blends the hero into the cream section below. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-bg via-bg/25 to-transparent" />
      </div>

      <div ref={copyRef} className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-5 sm:gap-6">
        <span className="eyebrow-label max-w-full rounded-full border border-white/35 bg-black/25 px-3 py-1.5 text-[10px] text-white backdrop-blur-sm sm:px-4 sm:text-xs">
          Divine Vision · Est. {company.foundedYear} · NH-1 corridor
        </span>

        <h1 className="max-w-[11ch] font-display text-balance text-[clamp(34px,10.8vw,76px)] font-bold leading-[1.05] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.55)] sm:max-w-[13ch]">
          Divine Vision townships{' '}
          <em className="rounded-lg bg-black/50 px-2 text-green-soft not-italic [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
            built to be lived in.
          </em>
        </h1>

        <p className="max-w-[60ch] text-balance text-[15px] leading-[1.65] text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-[17px] sm:leading-[1.75]">
          Five delivered communities, two active plotted townships, and one corridor you can
          drive today across Ganaur, Karnal and Kurukshetra.
        </p>

        <div className="mt-1 flex w-full max-w-[340px] flex-col items-stretch justify-center gap-3 sm:mt-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={onBookVisit}
            className="rounded-full bg-green px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_-14px_rgba(56,142,60,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-soft hover:shadow-[0_20px_44px_-14px_rgba(56,142,60,0.75)] sm:px-7"
          >
            Book a site visit
          </button>
          <a
            href="/residences"
            className="eyebrow-label rounded-full border border-white/55 bg-black/25 px-5 py-3.5 text-center text-white backdrop-blur-sm transition-colors duration-200 hover:border-white hover:bg-black/40 sm:px-7"
          >
            Explore residences
          </a>
        </div>

        <div className="mt-2 hidden flex-wrap items-center justify-center gap-x-9 gap-y-3 rounded-2xl border border-white/15 bg-black/45 px-8 py-4 text-white/90 backdrop-blur-sm sm:flex">
          <span className="text-sm">
            <strong className="font-display font-bold text-white">20</strong> yrs on the corridor
          </span>
          <span className="text-sm">
            <strong className="font-display font-bold text-white">5</strong> townships delivered
          </span>
          <span className="text-sm">{company.compliance.join(' & ')} approved</span>
        </div>
      </div>
    </header>
  );
}
