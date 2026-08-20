import { useLayoutEffect, useRef } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Drives Lenis's raf loop off GSAP's ticker and keeps ScrollTrigger
 * scrubbing against Lenis's smoothed scroll position instead of the native
 * scroll event. Mount once at the root — every ScrollTrigger timeline
 * elsewhere in the app then scrubs smoothly for free.
 */
export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const lenis = new Lenis({ autoRaf: false });
    lenisRef.current = lenis;

    // Mounting fresh on every route change (e.g. after chatbot logout) can pick up
    // a stale native scroll position left over from the previous page. Snap Lenis
    // to the top and re-measure every ScrollTrigger (hero fade, journey pin, etc.)
    // against that known-good position before anything scrubs off of it.
    lenis.scrollTo(0, { immediate: true, force: true });
    ScrollTrigger.refresh();

    const onScroll = () => ScrollTrigger.update();
    lenis.on('scroll', onScroll);

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.off('scroll', onScroll);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return lenisRef;
}
