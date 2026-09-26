import { useOutletContext } from 'react-router-dom';
import { HeroSection } from '../components/HeroSection';
import { StoriesBar } from '../components/stories/StoriesBar';
import { LiveProjectsSection } from '../components/LiveProjectsSection';
import { LocationSection } from '../components/LocationSection';
import { VisitCtaSection } from '../components/VisitCtaSection';
import { DeliveredSection } from '../components/DeliveredSection';
import { SmoothScrollProvider } from '../components/SmoothScrollProvider';
import type { SiteOutletContext } from '../components/SiteLayout';

export function LandingPage() {
  const { onBookVisit } = useOutletContext<SiteOutletContext>();

  return (
    <SmoothScrollProvider>
      <HeroSection onBookVisit={onBookVisit} />
      <section className="bg-bg px-4 pt-8 sm:px-10 sm:pt-12" aria-label="Township stories">
        <div className="mx-auto max-w-6xl">
          <StoriesBar />
        </div>
      </section>
      <LiveProjectsSection />
      <LocationSection />
      <VisitCtaSection />
      <DeliveredSection />
    </SmoothScrollProvider>
  );
}
