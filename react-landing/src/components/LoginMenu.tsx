import { useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { loginOptions } from '../data/loginOptions';

export function LoginMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useClickOutside(rootRef, () => setOpen(false), open);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="eyebrow-label inline-flex items-center gap-1.5 text-xs text-white/85 transition-colors hover:text-terracotta-light"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        Login
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
          {loginOptions.map((option) => (
            <a
              key={option.href}
              href={option.href}
              role="menuitem"
              className="block rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-bg hover:text-chrome"
              onClick={() => setOpen(false)}
            >
              {option.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
