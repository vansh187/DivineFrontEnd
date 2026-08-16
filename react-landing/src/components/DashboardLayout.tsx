import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { IconBadge } from './DashboardIcons';
import type { IconAccent } from './DashboardIcons';

interface DashboardLayoutProps {
  eyebrow: string;
  heading: ReactNode;
  subheading: string;
  children: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  contentLayout?: 'grid' | 'full';
}

export function DashboardLayout({ eyebrow, heading, subheading, children, before, after, contentLayout = 'grid' }: DashboardLayoutProps) {
  const contentClass =
    contentLayout === 'grid' ? 'mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'mt-10';

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

          {before}

          <div className={contentClass}>{children}</div>

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
  accent?: IconAccent;
  actionLabel?: string;
  onAction?: () => void;
}

export function PlaceholderCard({ icon, title, description, accent = 'chrome', actionLabel, onAction }: PlaceholderCardProps) {
  return (
    <div className="group relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(30,77,59,0.4)]">
      <IconBadge icon={icon} accent={accent} interactive />
      <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">{description}</p>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
        >
          {actionLabel ?? 'Open'}
        </button>
      ) : (
        <p className="eyebrow-label mt-4 text-terracotta">Coming soon</p>
      )}
    </div>
  );
}
