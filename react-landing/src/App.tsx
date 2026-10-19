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
import seoPages from './data/seo-pages.json';

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
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const FaqPage = lazy(() => import('./pages/FaqPage').then((m) => ({ default: m.FaqPage })));

const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

const pageMetadataByPath = Object.fromEntries(seoPages.map(({ path, title, description }) => [path, { title, description }]));

function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    const metadata = pageMetadataByPath[normalizedPath];
    const noindex = !metadata;
    document.title = metadata?.title ?? 'Page not found | Divine Vision Infratech';
    const setMeta = (selector: string, attribute: string, value: string) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) { element = document.createElement('meta'); document.head.appendChild(element); }
      element.setAttribute(attribute, value);
    };
    setMeta('meta[name="description"]', 'name', 'description');
    document.head.querySelector('meta[name="description"]')?.setAttribute('content', metadata?.description ?? '');
    setMeta('meta[name="robots"]', 'name', 'robots');
    document.head.querySelector('meta[name="robots"]')?.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('meta[property="og:title"]', 'property', 'og:title');
    document.head.querySelector('meta[property="og:title"]')?.setAttribute('content', metadata?.title ?? 'Page not found');
    setMeta('meta[property="og:description"]', 'property', 'og:description');
    document.head.querySelector('meta[property="og:description"]')?.setAttribute('content', metadata?.description ?? '');
    setMeta('meta[property="og:url"]', 'property', 'og:url');
    document.head.querySelector('meta[property="og:url"]')?.setAttribute('content', `https://divinevisioninfra.com${noindex ? '/' : pathname}`);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card');
    document.head.querySelector('meta[name="twitter:card"]')?.setAttribute('content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title');
    document.head.querySelector('meta[name="twitter:title"]')?.setAttribute('content', metadata?.title ?? 'Page not found');
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description');
    document.head.querySelector('meta[name="twitter:description"]')?.setAttribute('content', metadata?.description ?? '');
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = `https://divinevisioninfra.com${noindex ? '/' : pathname}`;
  }, [pathname]);
  return null;
}

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
      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
      // The hash target can be inside a route that's still behind Suspense
      // (e.g. a lazy-loaded page reached via a cross-page #anchor link, before
      // its chunk has finished loading) - watch for it to mount instead of
      // silently falling back to scrollTo(0, 0). Bounded so a genuinely
      // missing/stale id doesn't leave an observer running forever.
      window.scrollTo(0, 0);
      const observer = new MutationObserver(() => {
        const lateTarget = document.getElementById(id);
        if (lateTarget) {
          lateTarget.scrollIntoView({ block: 'start' });
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timeout = window.setTimeout(() => observer.disconnect(), 4000);
      return () => {
        observer.disconnect();
        window.clearTimeout(timeout);
      };
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
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms-conditions" element={<TermsPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/book-plots" element={<Navigate to="/book-plot" replace />} />
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
          <RouteMetadata />
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
