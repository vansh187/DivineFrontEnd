import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

interface DashboardLayoutProps {
  eyebrow: string;
  heading: ReactNode;
  subheading: string;
  children: ReactNode;
  after?: ReactNode;
}

export function DashboardLayout({ eyebrow, heading, subheading, children, after }: DashboardLayoutProps) {
  return (
    <>
      <Navbar />
      <main className="min-h-svh bg-bg px-6 pb-24 pt-28 sm:px-10 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow-label text-terracotta">{eyebrow}</p>
          <h1 className="mt-3 break-words font-display text-[clamp(28px,4vw,44px)] font-bold leading-[1.15] text-ink">
            {heading}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.65] text-ink-muted">{subheading}</p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>

          {after}
        </div>
      </main>
      <Footer />
    </>
  );
}

interface PlaceholderCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function PlaceholderCard({ icon, title, description }: PlaceholderCardProps) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg text-chrome">{icon}</span>
      <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">{description}</p>
      <p className="eyebrow-label mt-4 text-terracotta">Coming soon</p>
    </div>
  );
}
