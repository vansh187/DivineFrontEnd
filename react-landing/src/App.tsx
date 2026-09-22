import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { SiteLayout } from './components/SiteLayout';
import { AuthModal } from './components/AuthModal';
import { BackButton } from './components/BackButton';
import { ChatWidget } from './components/chat/ChatWidget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppCrashFallback } from './components/AppCrashFallback';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { idlePrefetchForRole } from './utils/routePreload';
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
const OurWorkPage = lazy(() => import('./pages/OurWorkPage').then((m) => ({ default: m.OurWorkPage })));
const BookPlotPage = lazy(() => import('./pages/BookPlotPage').then((m) => ({ default: m.BookPlotPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const PaymentResultPage = lazy(() => import('./pages/PaymentResultPage').then((m) => ({ default: m.PaymentResultPage })));

const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

// A browser-restored scroll position (e.g. hitting back) fights with the
// synchronous reset in ScrollToRouteTop below - taking manual control keeps
// the two from fighting over the same frame.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

/** Renders nothing - just warms route chunks (and, for the signed-in visitor's
 * own role, their dashboard chunks) once the browser has spare idle time after
 * the initial page paint, so a later click rarely has anything left to fetch. */
function RoutePreloader() {
  const { session } = useAuth();
  useEffect(() => {
    idlePrefetchForRole(session?.role);
  }, [session?.role]);
  return null;
}

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

/**
 * Resets scroll synchronously (no rAF, no two-pass reset) so the new route's
 * first painted frame is already at the top - the old page at the old scroll
 * position never gets a chance to show. A #hash target scrolls into view
 * instead of resetting to top, matching normal anchor-link expectations.
 */
function ScrollToRouteTop() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

function AppRoutes() {
  return (
    <RouteCrashBoundary>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Public marketing pages share one persistent Navbar/Footer via
              SiteLayout - it mounts once and never remounts on navigation
              between these routes, which is what actually stops the navbar
              flicker. Suspense inside SiteLayout is scoped to its <Outlet/>,
              so the navbar stays visible even while a page chunk loads. */}
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/residences" element={<ResidencesPage />} />
            <Route path="/residences/:id" element={<ProjectDetailPage />} />
            <Route path="/our-story" element={<OurStoryPage />} />
            <Route path="/our-work" element={<OurWorkPage />} />
            <Route path="/book-plot" element={<BookPlotPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/book-plots" element={<Navigate to="/book-plot" replace />} />
          {/* Zoho Payments' hosted checkout redirects here (ZOHO_PAYMENTS_SUCCESS_URL /
              ZOHO_PAYMENTS_FAILURE_URL) - not under SiteLayout/RoleRoute since both a
              customer's and a broker's payment land on the exact same configured URL. */}
          <Route path="/customer/payments/success" element={<PaymentResultPage outcome="success" />} />
          <Route path="/customer/payments/failure" element={<PaymentResultPage outcome="failure" />} />
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
        </Routes>
      </Suspense>
    </RouteCrashBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={<AppCrashFallback />}>
      <AuthProvider>
        <RoutePreloader />
        <BrowserRouter>
          <ScrollToRouteTop />
          <BackButton />
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
