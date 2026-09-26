import { useOutletContext } from 'react-router-dom';
import { HeroSection } from '../components/HeroSection';
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
      <LiveProjectsSection />
      <LocationSection />
      <VisitCtaSection />
      <DeliveredSection />
    </SmoothScrollProvider>
  );
}
