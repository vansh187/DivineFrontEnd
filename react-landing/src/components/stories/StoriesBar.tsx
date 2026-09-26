import { useState } from 'react';
import { dashboardStories } from '../../data/dashboardStories';
import { StoryViewer } from './StoryViewer';

/**
 * Instagram-style row of story avatars for the customer/broker dashboard
 * home — replaces what used to be a plain white page with something worth
 * tapping into on arrival. Opens `StoryViewer` at whichever avatar was
 * tapped.
 */
export function StoriesBar() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="rounded-2xl bg-chrome p-5 shadow-[0_30px_80px_-48px_rgba(6,31,45,0.55)] sm:p-6">
        <p className="eyebrow-label text-terracotta-light">Stories</p>
        <div className="stories-scrollbar mt-4 flex gap-5 overflow-x-auto pb-3">
          {dashboardStories.map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              className="group flex shrink-0 flex-col items-center gap-2"
            >
              <span className="rounded-full bg-[linear-gradient(135deg,#e67e22_0%,#f0a860_50%,#e67e22_100%)] p-[2.5px] transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <span className="block rounded-full bg-chrome p-[2.5px]">
                  <img
                    src={story.poster}
                    alt={story.headline}
                    className="h-16 w-16 rounded-full object-cover sm:h-[72px] sm:w-[72px]"
                  />
                </span>
              </span>
              <span className="max-w-[76px] truncate text-[11px] font-semibold text-white/85">{story.label}</span>
            </button>
          ))}
        </div>
      </div>

      {openIndex !== null && (
        <StoryViewer
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
