import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useScrolled } from '../hooks/useScrolled';
import { navLinks } from '../data/navigation';
import { LoginMenu } from './LoginMenu';
import { DivineVisionLogo } from './DivineVisionLogo';

type NavbarProps = {
  onBookVisit?: () => void;
  transparentOnTop?: boolean;
};

export function Navbar({ onBookVisit, transparentOnTop = false }: NavbarProps) {
  const { pathname } = useLocation();
  const scrolled = useScrolled(50);
  const [mobileOpen, setMobileOpen] = useState(false);
  const glass = transparentOnTop && !scrolled;
  const links = pathname === '/' ? navLinks : [{ label: 'Home', href: '/' }, ...navLinks];

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-[90] flex min-w-0 items-center justify-between gap-2 border-b px-3 py-3 transition-all duration-300 sm:gap-3 sm:px-10 sm:py-4 ${
        glass
          ? 'border-transparent bg-transparent text-white shadow-none'
          : 'border-hairline bg-bg/94 text-ink shadow-none backdrop-blur-xl'
      }`}
    >
      <a
        href="/"
        aria-label="Divine Vision home"
        className="shrink-0 text-current"
      >
        <DivineVisionLogo />
      </a>

      <div className="flex min-w-0 items-center gap-2 sm:gap-7">
        <div className="hidden gap-6 sm:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-xs transition-colors hover:text-terracotta ${glass ? 'text-white/85' : 'text-ink/85'}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <LoginMenu light={glass} />

        <button
          type="button"
          onClick={onBookVisit}
          className={`shrink-0 rounded-none border px-3 py-2 text-[11px] font-semibold tracking-[0.04em] uppercase transition-all duration-200 hover:bg-terracotta hover:border-terracotta hover:text-white max-[360px]:hidden sm:px-5 sm:py-2.5 sm:text-xs ${
            glass ? 'border-white text-white' : 'border-ink text-ink'
          }`}
        >
          <span className="sm:hidden">Visit</span>
          <span className="hidden sm:inline">Book a site visit</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen((value) => !value)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1.5 border transition-colors sm:hidden ${
            glass ? 'border-white/15 bg-white/8 text-white hover:bg-white/12' : 'border-ink/15 bg-ink/6 text-ink hover:bg-ink/10'
          }`}
        >
          <span className="h-0.5 w-4 bg-current" />
          <span className="h-0.5 w-4 bg-current" />
          <span className="h-0.5 w-4 bg-current" />
        </button>
      </div>

      {mobileOpen ? (
        <div className="absolute inset-x-4 top-[calc(100%+8px)] rounded-xl border border-white/10 bg-chrome px-4 py-3 shadow-[0_18px_44px_-22px_rgba(0,0,0,0.75)] sm:hidden">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
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
