export function AppCrashFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="eyebrow-label text-terracotta">Something went wrong</p>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">We hit a snag loading this page</h1>
      <p className="max-w-[42ch] text-sm text-ink-muted">
        Please try reloading. If the problem continues, reach us at{' '}
        <a href="tel:+917428291303" className="font-semibold text-chrome hover:underline">
          +91 74282 91303
        </a>
        .
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 inline-flex items-center rounded-full bg-green px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-14px_rgba(56,142,60,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-soft"
      >
        Reload page
      </button>
    </div>
  );
}
