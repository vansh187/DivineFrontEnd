import { useRef } from 'react';
import { HeroMedia } from './HeroMedia';
import { useHeroScrollTimeline } from '../hooks/useHeroScrollTimeline';
import { company } from '../data/company';

type HeroSectionProps = {
  onBookVisit?: () => void;
};

/** Headline proof points for the hero stat band. */
const heroStats = [
  { value: '2005', label: 'Established' },
  { value: '7', label: 'Townships' },
  { value: '3', label: 'Districts' },
  { value: '369', label: 'Plots at OPS Greens' },
  { value: company.compliance.join(' & '), label: 'Approved', compact: true },
];

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
          Full-bleed darkening pass keeps copy legible whether the crop
          underneath is bright sky or dark foliage.
        */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.58)_0%,rgba(0,0,0,0.26)_42%,rgba(0,0,0,0.72)_100%)]" />
        {/* Vignette reinforces contrast directly behind the centred copy column. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,rgba(6,31,45,0.52),transparent_72%)]" />
        {/* Bottom fade blends the hero into the cream section below. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-bg via-bg/25 to-transparent" />
      </div>

      <div ref={copyRef} className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center gap-5 sm:gap-6">
        <span className="eyebrow-label max-w-[min(100%,19rem)] rounded-none border border-white/32 bg-black/22 px-3 py-1.5 text-center text-[10px] leading-relaxed text-white/92 backdrop-blur-sm sm:max-w-full sm:px-4 sm:text-xs">
          <span className="sm:hidden">Established {company.foundedYear} | NH-1 corridor</span>
          <span className="hidden sm:inline">Established {company.foundedYear} | NH-1 Delhi-Chandigarh corridor</span>
        </span>

        <h1 className="max-w-[13ch] font-display text-balance text-[clamp(34px,9.6vw,72px)] font-bold leading-[1.06] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.55)] sm:max-w-[15ch]">
          Plotted townships designed for real everyday living.
        </h1>

        <p className="max-w-[62ch] text-balance text-[15px] leading-[1.68] text-white/92 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-[17px] sm:leading-[1.72]">
          From Ganaur to Karnal and Kurukshetra, Divine Vision has delivered five
          communities and is now shaping two approved township destinations on one connected corridor.
        </p>

        <div className="mt-1 flex w-full max-w-[340px] flex-col items-stretch justify-center gap-3 sm:mt-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <button
            type="button"
            onClick={onBookVisit}
            className="rounded-none border border-terracotta bg-terracotta px-5 py-3.5 text-sm font-semibold tracking-[0.04em] text-white uppercase transition-all duration-200 hover:border-green hover:bg-green sm:px-7"
          >
            Book a site visit
          </button>
          <a
            href="/residences"
            className="eyebrow-label rounded-none border border-white/55 bg-black/25 px-5 py-3.5 text-center text-white backdrop-blur-sm transition-colors duration-200 hover:border-white hover:bg-black/40 sm:px-7"
          >
            Explore residences
          </a>
        </div>

        <dl className="mt-4 grid w-full max-w-md grid-cols-2 gap-px overflow-hidden rounded-none border border-white/18 border-t-[3px] border-t-terracotta bg-white/14 backdrop-blur-md min-[440px]:grid-cols-3 sm:mt-7 sm:max-w-3xl sm:grid-cols-5">
          {heroStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col-reverse items-center justify-center gap-1.5 bg-black/45 px-2 py-4 text-center last:col-span-full sm:gap-2 sm:px-4 sm:py-6 sm:last:col-span-1"
            >
              <dt className="eyebrow-label text-[8.5px] leading-tight text-white/72 sm:text-[11px]">
                {stat.label}
              </dt>
              <dd
                className={`font-display font-bold leading-none text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)] ${
                  stat.compact
                    ? 'text-[clamp(14px,3.2vw,20px)] leading-tight tracking-[0.02em]'
                    : 'text-[clamp(30px,7.4vw,52px)]'
                }`}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
