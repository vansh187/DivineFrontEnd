import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAuth, getDisplayName } from '../hooks/useAuth';

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
      {children}
    </svg>
  );
}

const SignInIcon = () => (
  <IconWrap>
    <path d="M8 3.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 16.5h3M13 13.5l3.5-3.5-3.5-3.5M16.2 10H8" />
  </IconWrap>
);
const UserPlusIcon = () => (
  <IconWrap>
    <circle cx="8" cy="6.8" r="3.1" />
    <path d="M2.8 16.2c.9-2.8 3.2-4.2 5.9-4.2M14.8 7v5M12.3 9.5h5" />
  </IconWrap>
);
const LogoutIcon = () => (
  <IconWrap>
    <path d="M12 3.5h3.5A1.5 1.5 0 0 1 17 5v10a1.5 1.5 0 0 1-1.5 1.5H12M7.5 13.5 4 10l3.5-3.5M4.2 10H12" />
  </IconWrap>
);
const ChevronRightIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-chrome">
    <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function LoginMenu({ light = false }: { light?: boolean }) {
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { session, logout, openModal } = useAuth();

  useClickOutside(rootRef, () => setOpen(false), open);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const label = session ? getDisplayName(session, 14) : 'Login';
  const initial = (session?.firstName || session?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 text-xs transition-colors hover:text-terracotta ${light ? 'text-white/85' : 'text-ink/85'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="max-w-[110px] truncate">{label}</span>
        <svg
          viewBox="0 0 10 6"
          aria-hidden="true"
          className={`h-2 w-2 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M1 1l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-[calc(100%+16px)] z-20 w-[280px] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_30px_70px_-20px_rgba(19,21,17,0.35)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            entered ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-1 scale-[0.97] opacity-0'
          }`}
        >
          {session ? (
            <>
              <div className="flex items-center gap-3 border-b border-hairline bg-bg px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chrome font-display text-base font-bold text-white">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{session.email}</p>
                  <p className="eyebrow-label mt-0.5 text-terracotta">{session.role}</p>
                </div>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-bg"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-ink-muted transition-colors group-hover:bg-white group-hover:text-chrome">
                    <LogoutIcon />
                  </span>
                  Log out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-hairline px-4 pb-3.5 pt-4">
                <p className="eyebrow-label text-terracotta">Divine Vision account</p>
                <p className="mt-1 text-sm text-ink-muted">Sign in to save your shortlist and book visits.</p>
              </div>

              <div className="p-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openModal('signin');
                    setOpen(false);
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-bg"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-chrome transition-colors group-hover:bg-white">
                    <SignInIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Sign in</span>
                    <span className="block text-xs text-ink-muted">Already have an account</span>
                  </span>
                  <ChevronRightIcon />
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openModal('signup');
                    setOpen(false);
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-bg"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-green transition-colors group-hover:bg-white">
                    <UserPlusIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">Create account</span>
                    <span className="block text-xs text-ink-muted">Customer or broker</span>
                  </span>
                  <ChevronRightIcon />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
