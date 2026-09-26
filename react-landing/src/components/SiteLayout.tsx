import { Suspense, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SiteVisitDrawer } from './SiteVisitDrawer';

export interface SiteOutletContext {
  onBookVisit: () => void;
}

/** Thin top progress bar instead of a full-screen "Loading…" - the navbar and
 * footer never disappear while a route's chunk is still being fetched, so a
 * slow network shows a sliver of motion instead of blanking the whole page. */
function RouteProgressBar() {
  return (
    <div className="fixed inset-x-0 top-0 z-[95] h-[3px] overflow-hidden bg-transparent" aria-hidden="true">
      <div className="h-full w-1/3 animate-[route-progress_1.1s_ease-in-out_infinite] bg-terracotta" />
    </div>
  );
}

/**
 * Persistent chrome for every public marketing page: the navbar and footer
 * mount once here and never remount on navigation between "/", "/residences",
 * "/our-work", "/our-story", "/residences/:id" and "/book-plot" - only the
 * <Outlet/> content underneath swaps, which is what actually stops the
 * navbar-remount flicker on route changes.
 */
export function SiteLayout() {
  const { pathname } = useLocation();
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);
  const onBookVisit = () => setSiteVisitOpen(true);

  return (
    <>
      <Navbar onBookVisit={onBookVisit} transparentOnTop={pathname === '/'} />
      <Suspense fallback={<RouteProgressBar />}>
        <Outlet context={{ onBookVisit } satisfies SiteOutletContext} />
      </Suspense>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
