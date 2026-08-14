import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { JourneySection } from './components/JourneySection';
import { DeliveredSection } from './components/DeliveredSection';
import { SmoothScrollProvider } from './components/SmoothScrollProvider';

function App() {
  return (
    <SmoothScrollProvider>
      <Navbar />
      <HeroSection />
      <JourneySection />
      <DeliveredSection />
      <Footer />
    </SmoothScrollProvider>
  );
}

export default App;
