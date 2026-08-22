import { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { SiteVisitDrawer } from '../components/SiteVisitDrawer';

export function NotFoundPage() {
  const [siteVisitOpen, setSiteVisitOpen] = useState(false);

  return (
    <>
      <Navbar onBookVisit={() => setSiteVisitOpen(true)} />
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="eyebrow-label text-terracotta">404</p>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">This page doesn't exist</h1>
        <p className="max-w-[42ch] text-sm text-ink-muted">
          The page you're looking for may have moved. Head back home, or use the concierge chat if you need a hand finding something.
        </p>
        <a
          href="/"
          className="mt-2 inline-flex items-center rounded-none border border-green bg-green px-6 py-3 text-sm font-semibold tracking-[0.04em] text-white uppercase transition-colors duration-200 hover:border-terracotta hover:bg-terracotta"
        >
          Back to home
        </a>
      </main>
      <Footer />
      <SiteVisitDrawer open={siteVisitOpen} onClose={() => setSiteVisitOpen(false)} />
    </>
  );
}
