import { lazy, Suspense, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CustomerPage } from './pages/CustomerPage';
import { BrokerPage } from './pages/BrokerPage';
import { BrokerCommissionPage } from './pages/BrokerCommissionPage';
import { ResidencesPage } from './pages/ResidencesPage';
import { OurStoryPage } from './pages/OurStoryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AuthModal } from './components/AuthModal';
import { ChatWidget } from './components/chat/ChatWidget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppCrashFallback } from './components/AppCrashFallback';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider, useAuth } from './hooks/useAuth';
import type { Role } from './services/authApi';

const CustomerApplicationPage = lazy(() =>
  import('./pages/CustomerApplicationPage').then((module) => ({ default: module.CustomerApplicationPage })),
);

const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

/** A returning visitor with an active session (e.g. reopening the tab) should land on
 * their own dashboard, not the marketing landing page. Signed-out visitors see the
 * landing page as normal. */
function HomeRoute() {
  const { session } = useAuth();
  if (session) return <Navigate to={roleHome[session.role]} replace />;
  return <LandingPage />;
}

function RouteCrashBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary resetKeys={[location.pathname]} fallback={<AppCrashFallback onRetry={() => window.location.reload()} />}>
      {children}
    </ErrorBoundary>
  );
}

function ScrollToRouteTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const reset = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };

    reset();
    const firstFrame = window.requestAnimationFrame(() => {
      reset();
      window.requestAnimationFrame(reset);
    });

    return () => window.cancelAnimationFrame(firstFrame);
  }, [pathname]);

  return null;
}

function AppRoutes() {
  return (
    <RouteCrashBoundary>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/residences" element={<ResidencesPage />} />
        <Route path="/our-story" element={<OurStoryPage />} />
        <Route
          path="/customer"
          element={
            <RoleRoute role="customer">
              <CustomerPage />
            </RoleRoute>
          }
        />
        <Route
          path="/customer/application"
          element={
            <RoleRoute role="customer">
              <ErrorBoundary fallback={<AppCrashFallback />}>
                <Suspense fallback={<div className="min-h-svh bg-bg px-6 pt-28 text-sm font-semibold text-ink">Loading application form...</div>}>
                  <CustomerApplicationPage />
                </Suspense>
              </ErrorBoundary>
            </RoleRoute>
          }
        />
        <Route
          path="/broker"
          element={
            <RoleRoute role="broker">
              <BrokerPage />
            </RoleRoute>
          }
        />
        <Route
          path="/broker/commission"
          element={
            <RoleRoute role="broker">
              <BrokerCommissionPage />
            </RoleRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </RouteCrashBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={<AppCrashFallback />}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToRouteTop />
          <AppRoutes />
          <AuthModal />
          {/* Isolated boundary: a bug in the (newer, less-tested) chat widget
           * should never blank out the rest of the site. */}
          <ErrorBoundary>
            <ChatWidget />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
