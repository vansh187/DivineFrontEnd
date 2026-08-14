import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface UseHeroScrollTimelineOptions {
  sectionRef: RefObject<HTMLElement | null>;
  canvasWrapRef: RefObject<HTMLElement | null>;
  copyRef: RefObject<HTMLElement | null>;
}

/**
 * As the hero scrolls past: fades/lifts the copy and scales + fades the
 * background media wrapper.
 */
export function useHeroScrollTimeline({
  sectionRef,
  canvasWrapRef,
  copyRef,
}: UseHeroScrollTimelineOptions) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      if (canvasWrapRef.current) {
        gsap.to(canvasWrapRef.current, {
          scale: 1.35,
          opacity: 0.2,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
          },
        });
      }

      if (copyRef.current) {
        gsap.to(copyRef.current, {
          y: -80,
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '60% top',
            scrub: 1,
          },
        });
      }
    }, section);

    return () => ctx.revert();
  }, [sectionRef, canvasWrapRef, copyRef]);
}
