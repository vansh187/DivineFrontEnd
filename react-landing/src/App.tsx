import { lazy, Suspense, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AuthModal } from './components/AuthModal';
import { ChatWidget } from './components/chat/ChatWidget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppCrashFallback } from './components/AppCrashFallback';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider, useAuth } from './hooks/useAuth';
import type { Role } from './services/authApi';

// Only the landing page ships in the initial bundle. Every other route is
// fetched on navigation so a first-time visitor isn't downloading the whole
// customer + broker dashboard code just to read the marketing page.
const CustomerPage = lazy(() => import('./pages/CustomerPage').then((m) => ({ default: m.CustomerPage })));
const CustomerPlotsPage = lazy(() => import('./pages/CustomerPlotsPage').then((m) => ({ default: m.CustomerPlotsPage })));
const CustomerProfilePage = lazy(() => import('./pages/CustomerProfilePage').then((m) => ({ default: m.CustomerProfilePage })));
const CustomerApplicationPage = lazy(() =>
  import('./pages/CustomerApplicationPage').then((m) => ({ default: m.CustomerApplicationPage })),
);
const BrokerPage = lazy(() => import('./pages/BrokerPage').then((m) => ({ default: m.BrokerPage })));
const BrokerProfilePage = lazy(() => import('./pages/BrokerProfilePage').then((m) => ({ default: m.BrokerProfilePage })));
const BrokerPlotsPage = lazy(() => import('./pages/BrokerPlotsPage').then((m) => ({ default: m.BrokerPlotsPage })));
const BrokerLeadsPage = lazy(() => import('./pages/BrokerLeadsPage').then((m) => ({ default: m.BrokerLeadsPage })));
const BrokerCommissionPage = lazy(() =>
  import('./pages/BrokerCommissionPage').then((m) => ({ default: m.BrokerCommissionPage })),
);
const ResidencesPage = lazy(() => import('./pages/ResidencesPage').then((m) => ({ default: m.ResidencesPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const OurStoryPage = lazy(() => import('./pages/OurStoryPage').then((m) => ({ default: m.OurStoryPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

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

function RouteLoading() {
  return <div className="min-h-svh bg-bg px-6 pt-28 text-sm font-semibold text-ink">Loading...</div>;
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
      <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/residences" element={<ResidencesPage />} />
        <Route path="/residences/:id" element={<ProjectDetailPage />} />
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
          path="/customer/plots"
          element={
            <RoleRoute role="customer">
              <CustomerPlotsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/customer/profile"
          element={
            <RoleRoute role="customer">
              <CustomerProfilePage />
            </RoleRoute>
          }
        />
        <Route
          path="/customer/application"
          element={
            <RoleRoute role="customer">
              <ErrorBoundary fallback={<AppCrashFallback />}>
                <CustomerApplicationPage />
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
          path="/broker/profile"
          element={
            <RoleRoute role="broker">
              <BrokerProfilePage />
            </RoleRoute>
          }
        />
        <Route
          path="/broker/plots"
          element={
            <RoleRoute role="broker">
              <BrokerPlotsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/broker/leads"
          element={
            <RoleRoute role="broker">
              <BrokerLeadsPage />
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
      </Suspense>
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
