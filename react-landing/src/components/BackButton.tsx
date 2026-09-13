import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/** Routes where a back control makes no sense (the site root is already home). */
const HIDDEN_ON = new Set(['/']);

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}

/**
 * A single site-wide back affordance, pinned just under the navbar, so visitors
 * never need the browser's own back button. Steps back through the app's history
 * when there is somewhere to go; otherwise returns to the home page.
 */
export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  // Being `fixed` under the navbar means it stays glued to the same spot as
  // the page scrolls underneath it — fine over plain backgrounds, but it
  // ends up stamped awkwardly on top of any full-bleed hero photo/video that
  // scrolls up to meet it. Fading it out past the first ~120px of scroll
  // keeps it useful (still there for the common case: land on a page, go
  // back immediately) without it ever overlapping a hero image.
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    setPastHero(window.scrollY > 120);
    const onScroll = () => setPastHero(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  if (HIDDEN_ON.has(location.pathname)) return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-[68px] z-[80] px-3 transition-opacity duration-200 sm:top-[84px] sm:px-10 ${
        pastHero ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          tabIndex={pastHero ? -1 : 0}
          className={`inline-flex items-center gap-1.5 rounded-full border border-hairline bg-bg/90 px-3.5 py-2 text-xs font-semibold text-ink shadow-[0_10px_30px_-16px_rgba(6,31,45,0.45)] backdrop-blur-md transition-colors hover:border-terracotta hover:text-terracotta ${
            pastHero ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
        >
          <ChevronLeftIcon />
          Back
        </button>
      </div>
    </div>
  );
}
