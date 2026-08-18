import { useState } from 'react';
import { useScrolled } from '../hooks/useScrolled';
import { navLinks } from '../data/navigation';
import { LoginMenu } from './LoginMenu';
import { DivineVisionLogo } from './DivineVisionLogo';

type NavbarProps = {
  onBookVisit?: () => void;
};

export function Navbar({ onBookVisit }: NavbarProps) {
  const scrolled = useScrolled(50);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-[90] flex min-w-0 items-center justify-between gap-2 bg-chrome px-3 py-3 transition-shadow duration-300 sm:gap-3 sm:px-10 sm:py-4 ${
        scrolled ? 'shadow-[0_12px_30px_rgba(43,46,40,0.18)]' : 'shadow-none'
      }`}
    >
      <a
        href="/"
        aria-label="Divine Vision home"
        className="shrink-0"
      >
        <DivineVisionLogo />
      </a>

      <div className="flex min-w-0 items-center gap-2 sm:gap-7">
        <div className="hidden gap-6 sm:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="eyebrow-label text-xs text-white/85 transition-colors hover:text-terracotta-light"
            >
              {link.label}
            </a>
          ))}
        </div>

        <LoginMenu />

        <button
          type="button"
          onClick={onBookVisit}
          className="shrink-0 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-chrome shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-green hover:text-white hover:shadow-[0_10px_24px_-10px_rgba(56,142,60,0.7)] max-[360px]:hidden sm:px-5 sm:py-2.5 sm:text-xs"
        >
          <span className="sm:hidden">Visit</span>
          <span className="hidden sm:inline">Book a site visit</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/8 text-white transition-colors hover:bg-white/12 sm:hidden"
        >
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
          <span className="h-0.5 w-4 rounded-full bg-current" />
        </button>
      </div>

      {mobileOpen ? (
        <div className="absolute inset-x-4 top-[calc(100%+8px)] rounded-xl border border-white/10 bg-chrome px-4 py-3 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.75)] sm:hidden">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-semibold text-white/82 transition-colors hover:bg-white/8 hover:text-terracotta-light"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
