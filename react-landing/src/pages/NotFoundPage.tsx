import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export function NotFoundPage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="eyebrow-label text-terracotta">404</p>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">This page doesn't exist</h1>
        <p className="max-w-[42ch] text-sm text-ink-muted">
          The page you're looking for may have moved. Head back home, or use the concierge chat if you need a hand finding something.
        </p>
        <a
          href="/"
          className="mt-2 inline-flex items-center rounded-full bg-green px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-14px_rgba(56,142,60,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-soft"
        >
          Back to home
        </a>
      </main>
      <Footer />
    </>
  );
}
