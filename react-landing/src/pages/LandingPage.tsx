import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroSection } from '../components/HeroSection';
import { JourneySection } from '../components/JourneySection';
import { CostEstimator } from '../components/CostEstimator';
import { DeliveredSection } from '../components/DeliveredSection';
import { SmoothScrollProvider } from '../components/SmoothScrollProvider';

export function LandingPage() {
  return (
    <SmoothScrollProvider>
      <Navbar />
      <HeroSection />
      <JourneySection />
      <CostEstimator />
      <DeliveredSection />
      <Footer />
    </SmoothScrollProvider>
  );
}
