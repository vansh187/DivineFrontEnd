import { useLayoutEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface UseJourneyScrollOptions {
  containerRef: RefObject<HTMLElement | null>;
  trackRef: RefObject<HTMLElement | null>;
  progressRef: RefObject<HTMLElement | null>;
}

/**
 * Pins the journey section and scrubs the track horizontally in sync with
 * (Lenis-smoothed) vertical scroll, with a subtle parallax on each panel's
 * image.
 */
export function useJourneyScroll({ containerRef, trackRef, progressRef }: UseJourneyScrollOptions) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const ctx = gsap.context(() => {
      const distance = () => track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const bar = progressRef.current;
            if (bar) bar.style.width = `${self.progress * 100}%`;
          },
        },
      });

      track.querySelectorAll<HTMLImageElement>('[data-parallax-img]').forEach((img) => {
        gsap.fromTo(
          img,
          { xPercent: -6 },
          {
            xPercent: 6,
            ease: 'none',
            scrollTrigger: {
              trigger: container,
              start: 'top top',
              end: () => `+=${distance()}`,
              scrub: 1,
            },
          },
        );
      });
    }, container);

    return () => ctx.revert();
  }, [containerRef, trackRef, progressRef]);
}
