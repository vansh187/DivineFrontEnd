import { useRef } from 'react';
import { HeroVideo } from './HeroVideo';
import { useHeroScrollTimeline } from '../hooks/useHeroScrollTimeline';

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
        <HeroVideo />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1c2b18]/60 via-[#1c2b18]/38 to-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(28,43,24,0.5),transparent_70%)]" />
      </div>

      <div ref={copyRef} className="relative z-10" />
    </header>
  );
}
