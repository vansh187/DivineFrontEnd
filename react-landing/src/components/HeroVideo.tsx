import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

/**
 * Site-progress footage with a slow CSS "Ken Burns" zoom; swaps to the
 * static poster frame when the user prefers reduced motion.
 */
export function HeroVideo() {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return (
      <img
        src="/hero/construction-poster.jpg"
        alt="Construction underway at OPS Divine Greens — laying the foundation brick course"
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <video
      className="hero-video-zoom absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/hero/construction-poster.jpg"
      aria-label="Construction underway at OPS Divine Greens"
    >
      <source src="/hero/construction.webm" type="video/webm" />
      <source src="/hero/construction.mp4" type="video/mp4" />
    </video>
  );
}
