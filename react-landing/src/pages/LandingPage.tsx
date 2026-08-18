import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroSection } from '../components/HeroSection';
import { JourneySection } from '../components/JourneySection';
import { CostEstimator } from '../components/CostEstimator';
import { DeliveredSection } from '../components/DeliveredSection';
import { SmoothScrollProvider } from '../components/SmoothScrollProvider';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';

export function LandingPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  return (
    <SmoothScrollProvider>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} transparentOnTop />
      <HeroSection onBookVisit={() => setSiteVisitOpen(true)} />
      <JourneySection />
      <CostEstimator />
      <DeliveredSection />
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </SmoothScrollProvider>
  );
}
