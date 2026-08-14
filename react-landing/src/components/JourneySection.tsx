import { useRef } from 'react';
import { journeyStops } from '../data/journeyStops';
import { useJourneyScroll } from '../hooks/useJourneyScroll';
import { JourneyPanel } from './JourneyPanel';

export function JourneySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useJourneyScroll({ containerRef, trackRef, progressRef });

  return (
    <div id="journey" className="relative" ref={containerRef}>
      <div className="flex h-svh items-stretch will-change-transform" ref={trackRef}>
        {journeyStops.map((stop) => (
          <JourneyPanel key={stop.id} stop={stop} />
        ))}
      </div>
      <div className="absolute inset-x-6 bottom-6.5 z-10 h-px bg-hairline sm:inset-x-10">
        <div ref={progressRef} className="absolute inset-y-0 left-0 w-0 bg-green" />
      </div>
    </div>
  );
}
