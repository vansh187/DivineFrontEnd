import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

function SpeakerMutedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
      <path
        fill="currentColor"
        d="M4 9v6h4l5 5V4L8 9H4Zm12.7-.3 1.4 1.4-2.9 2.9 2.9 2.9-1.4 1.4-2.9-2.9-2.9 2.9-1.4-1.4 2.9-2.9-2.9-2.9 1.4-1.4 2.9 2.9 2.9-2.9Z"
      />
    </svg>
  );
}

function SpeakerOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
      <path
        fill="currentColor"
        d="M4 9v6h4l5 5V4L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12ZM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77Z"
      />
    </svg>
  );
}

/**
 * Cinematic crossfade reel of both live townships — OPS Divine Greens
 * (gate → aerial → amenities → clubhouse) into Suraksha Enclave (gate →
 * clubhouse → family park → gardens → aerial) — with a background score.
 * Swaps to a still frame when the user prefers reduced motion.
 *
 * Autoplay with sound is blocked by most browsers, so the reel starts muted.
 * The sound toggle becomes available once the video source is attached, so a
 * tap always reaches a playable media element.
 */
export function HeroMedia() {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    // Paint the hero poster and page copy before fetching decorative footage.
    const timer = window.setTimeout(() => setVideoReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !videoReady) return;
    const video = videoRef.current;
    if (!video) return;
    // Respect a sound choice made after the control became available.
    video.muted = muted;
    video.play().catch(() => {});
  }, [reducedMotion, videoReady, muted]);

  if (reducedMotion) {
    return (
      <img
        src="/hero/hero-loop-still.jpg"
        alt="Aerial view of OPS Divine Greens township — tree-lined plots, clubhouse and courts around a central spine road"
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.volume = 1;
    video.muted = next;
    setMuted(next);
    if (!next) video.play().catch(() => {});
  };

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        loop
        playsInline
        preload="none"
        muted={muted}
        poster="/hero/hero-loop-poster.jpg"
        aria-label="Cinematic fly-through of OPS Divine Greens and Suraksha Enclave, with background score — entrance gates, aerial township views, amenities and clubhouses"
      >
        {videoReady && <source src="/hero/hero-loop.webm" type="video/webm" />}
        {videoReady && <source src="/hero/hero-loop.mp4" type="video/mp4" />}
      </video>

      <button
        type="button"
        onClick={toggleMute}
        disabled={!videoReady}
        aria-pressed={!muted}
        aria-label={muted ? 'Unmute background music' : 'Mute background music'}
        className="absolute right-6 top-24 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/65 disabled:cursor-wait disabled:opacity-60 sm:right-8"
      >
        {muted ? <SpeakerMutedIcon /> : <SpeakerOnIcon />}
      </button>
    </>
  );
}
