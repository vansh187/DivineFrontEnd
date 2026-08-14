import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { JourneySection } from './components/JourneySection';
import { DeliveredSection } from './components/DeliveredSection';
import { SmoothScrollProvider } from './components/SmoothScrollProvider';
import { AuthModal } from './components/AuthModal';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <SmoothScrollProvider>
        <Navbar />
        <HeroSection />
        <JourneySection />
        <DeliveredSection />
        <Footer />
      </SmoothScrollProvider>
      <AuthModal />
    </AuthProvider>
  );
}

export default App;
