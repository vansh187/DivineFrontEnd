import { useRef } from 'react';
import { HeroMedia } from './HeroMedia';
import { useHeroScrollTimeline } from '../hooks/useHeroScrollTimeline';
import { contact } from '../data/contact';
import { company } from '../data/company';

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useHeroScrollTimeline({ sectionRef, canvasWrapRef, copyRef });

  return (
    <header
      ref={sectionRef}
      className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      <div ref={canvasWrapRef} className="absolute inset-0 overflow-hidden">
        <HeroMedia />
        {/*
          Full-bleed darkening pass — never dips light in the middle, so
          copy stays AA-legible whether the crop underneath is bright sky
          or dark foliage. Nav itself is opaque (bg-chrome) so this isn't
          load-bearing for the logo/links, just the hero copy below it.
        */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.48)_0%,rgba(0,0,0,0.28)_40%,rgba(0,0,0,0.6)_100%)]" />
        {/* Vignette reinforces contrast directly behind the centred copy column. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_58%_at_50%_46%,rgba(9,16,11,0.4),transparent_72%)]" />
        {/* Bottom fade blends the hero into the cream section below. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-bg via-bg/25 to-transparent" />
      </div>

      <div ref={copyRef} className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6">
        <span className="eyebrow-label rounded-full border border-white/35 bg-black/25 px-4 py-1.5 text-white backdrop-blur-sm">
          Est. {company.foundedYear} · NH-1, Delhi&ndash;Chandigarh corridor
        </span>

        <h1 className="font-display text-balance text-[clamp(34px,6vw,72px)] font-bold leading-[1.08] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.55)]">
          Twenty years of townships{' '}
          <em className="rounded-lg bg-black/50 px-2 text-green-soft not-italic [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
            people actually live in.
          </em>
        </h1>

        <p className="max-w-[58ch] text-balance text-[16px] leading-[1.7] text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
          Five townships delivered between 2007 and 2017. Two more selling now &mdash; every
          plot on one corridor you can drive to today.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <a
            href={contact.phoneHref}
            className="rounded-full bg-green px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_-14px_rgba(56,142,60,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-soft hover:shadow-[0_20px_44px_-14px_rgba(56,142,60,0.75)]"
          >
            Book a site visit
          </a>
          <a
            href="#journey"
            className="eyebrow-label rounded-full border border-white/55 bg-black/25 px-7 py-3.5 text-white backdrop-blur-sm transition-colors duration-200 hover:border-white hover:bg-black/40"
          >
            See the corridor
          </a>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-9 gap-y-3 rounded-2xl border border-white/15 bg-black/45 px-6 py-4 text-white/90 backdrop-blur-sm sm:px-8">
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
