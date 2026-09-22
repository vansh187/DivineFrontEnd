type Importer = () => Promise<unknown>;

// One entry per lazy route in App.tsx. Kept as a flat map (not the lazy()
// wrappers themselves) so both idle-time warming and hover/focus-intent
// prefetching can trigger the same underlying dynamic import - whichever
// fires first wins, the browser/module cache does the rest.
const publicRouteImporters: Record<string, Importer> = {
  '/residences': () => import('../pages/ResidencesPage'),
  '/our-story': () => import('../pages/OurStoryPage'),
  '/our-work': () => import('../pages/OurWorkPage'),
  '/book-plot': () => import('../pages/BookPlotPage'),
};

const customerRouteImporters: Importer[] = [
  () => import('../pages/CustomerPage'),
  () => import('../pages/CustomerPlotsPage'),
  () => import('../pages/CustomerProfilePage'),
  () => import('../pages/CustomerApplicationPage'),
];

const brokerRouteImporters: Importer[] = [
  () => import('../pages/BrokerPage'),
  () => import('../pages/BrokerProfilePage'),
  () => import('../pages/BrokerPlotsPage'),
  () => import('../pages/BrokerLeadsPage'),
  () => import('../pages/BrokerCommissionPage'),
];

// The above-the-fold hero image for routes whose first paint depends on one,
// so it can be warmed alongside the route's JS chunk instead of only starting
// to download once the page has already mounted.
const routeHeroImages: Record<string, string> = {
  '/our-work': '/townships/ops-hero.jpg',
  '/our-story': '/founder/himashu-luthra.jpg',
};

const startedRoutes = new Set<string>();
const startedImages = new Set<string>();

export function prefetchRoute(path: string): void {
  const load = publicRouteImporters[path];
  if (!load || startedRoutes.has(path)) return;
  startedRoutes.add(path);
  load().catch(() => startedRoutes.delete(path));
}

export function preloadImage(src: string | undefined): void {
  if (!src || startedImages.has(src)) return;
  startedImages.add(src);
  const img = new Image();
  img.src = src;
}

/** Called on hover/focus/touchstart over a nav link - warms both the route's
 * JS chunk and its hero image so navigating to it has nothing left to fetch. */
export function prefetchRouteAssets(path: string): void {
  prefetchRoute(path);
  preloadImage(routeHeroImages[path]);
}

let projectDetailStarted = false;
/** /residences/:id is parametrized, so it isn't in publicRouteImporters keyed
 * by exact path - every township card links to the same chunk regardless of
 * which id, so this warms it once on hover over any of them. */
export function prefetchProjectDetail(): void {
  if (projectDetailStarted) return;
  projectDetailStarted = true;
  import('../pages/ProjectDetailPage').catch(() => {
    projectDetailStarted = false;
  });
}

function runWhenIdle(fn: () => void): void {
  const idle = (
    window as typeof window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }
  ).requestIdleCallback;
  if (idle) idle(fn, { timeout: 2000 });
  else setTimeout(fn, 300);
}

/** Warms every public route (safe for any visitor) plus, once known, the
 * signed-in visitor's own role dashboard - never both dashboards, so an
 * anonymous visitor never downloads customer/broker code it will never use. */
export function idlePrefetchForRole(role: 'customer' | 'broker' | undefined): void {
  runWhenIdle(() => {
    Object.keys(publicRouteImporters).forEach(prefetchRoute);
    const roleImporters = role === 'broker' ? brokerRouteImporters : role === 'customer' ? customerRouteImporters : [];
    roleImporters.forEach((load) => void load().catch(() => {}));
  });
}
