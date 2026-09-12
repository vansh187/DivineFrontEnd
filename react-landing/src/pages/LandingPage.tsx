import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroSection } from '../components/HeroSection';
import { LiveProjectsSection } from '../components/LiveProjectsSection';
import { LocationSection } from '../components/LocationSection';
import { VisitCtaSection } from '../components/VisitCtaSection';
import { DeliveredSection } from '../components/DeliveredSection';
import { SmoothScrollProvider } from '../components/SmoothScrollProvider';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';

export function LandingPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  return (
    <SmoothScrollProvider>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} transparentOnTop />
      <HeroSection onBookVisit={() => setSiteVisitOpen(true)} />
      <LiveProjectsSection />
      <LocationSection />
      <VisitCtaSection />
      <DeliveredSection />
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </SmoothScrollProvider>
  );
}
