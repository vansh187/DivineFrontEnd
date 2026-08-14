import { useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useAuth } from '../hooks/useAuth';

export function LoginMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { session, logout, openModal } = useAuth();

  useClickOutside(rootRef, () => setOpen(false), open);

  const label = session ? session.firstName || session.email.split('@')[0] : 'Login';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="eyebrow-label inline-flex items-center gap-1.5 text-xs text-white/85 transition-colors hover:text-terracotta-light"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
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
          className="absolute right-0 top-[calc(100%+16px)] z-20 min-w-[200px] rounded-xl border border-hairline bg-surface p-1.5 shadow-[0_18px_40px_rgba(19,21,17,0.16)]"
        >
          {session ? (
            <>
              <div className="px-3 py-2 text-xs text-ink-muted">
                Signed in as <span className="text-ink">{session.email}</span>
                <span className="eyebrow-label ml-1.5 text-terracotta">{session.role}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-bg hover:text-chrome"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  openModal('signin');
                  setOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-bg hover:text-chrome"
              >
                Sign in
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  openModal('signup');
                  setOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-bg hover:text-chrome"
              >
                Create account
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
