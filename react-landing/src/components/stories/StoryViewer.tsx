import { useEffect, useRef, useState } from 'react';
import { dashboardStories } from '../../data/dashboardStories';

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

interface StoryViewerProps {
  startIndex: number;
  onClose: () => void;
}

/** Full-screen single-story player. Each dashboard avatar is its own
 *  standalone story (unrelated content — garden life, a township walk, a
 *  project tour), not segments of one combined story, so the viewer never
 *  auto-chains into a neighbouring story: one progress bar for the story
 *  being watched, and it closes when that video ends. */
export function StoryViewer({ startIndex, onClose }: StoryViewerProps) {
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const story = dashboardStories[startIndex];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProgress(0);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress(video.currentTime / video.duration);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-[0_60px_160px_-40px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 p-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%`, transition: 'none' }} />
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close stories"
          className="absolute right-3 top-8 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
        >
          <CloseIcon />
        </button>

        <div className="relative aspect-video w-full bg-black">
          <video
            key={story.video}
            ref={videoRef}
            src={story.video}
            poster={story.poster}
            className="h-full w-full object-contain"
            autoPlay
            muted
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={onClose}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.75),transparent_60%)] p-5 sm:p-7">
            <p className="eyebrow-label text-terracotta-light">{story.eyebrow}</p>
            <h3 className="mt-2 max-w-[26ch] font-display text-xl font-bold leading-tight text-white sm:text-2xl">
              {story.headline}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}
