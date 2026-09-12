import { useEffect, useRef, useState } from 'react';
import { contact } from '../data/contact';
import { brochureList } from '../data/brochures';

/** Full-bleed prompt that sits directly above the delivered-record section,
 *  colour-matched to the footer so the page closes on a consistent dark note. */
export function VisitCtaSection() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <section className="relative border-y border-hairline-dark bg-chrome px-6 py-16 text-center sm:px-10 sm:py-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <h2 className="font-display text-balance text-4xl font-bold leading-tight text-white sm:text-6xl">
          Walk the plot before you book it.
        </h2>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.75] text-white/70">
          Site visits run seven days a week at both townships. Our consultant will show you the
          layout, the approvals and the plots still open.
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <a
            href={contact.phoneHref}
            className="rounded-none border border-terracotta-light bg-terracotta-light px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-chrome transition-colors hover:border-white hover:bg-white sm:px-8"
          >
            Call {contact.phone}
          </a>

          <div ref={containerRef} className="relative w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="w-full rounded-none border border-white/45 px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:border-white hover:bg-white/10 sm:w-auto sm:px-8"
            >
              Download Brochure
            </button>

            {open && (
              <div
                role="menu"
                aria-label="Choose a brochure to download"
                className="absolute left-1/2 top-full z-20 mt-3 w-[min(90vw,23rem)] -translate-x-1/2 rounded-2xl border border-hairline bg-white p-2 text-left shadow-[0_40px_100px_-40px_rgba(6,31,45,0.55)]"
              >
                {brochureList.map((option) => (
                  <a
                    key={option.id}
                    role="menuitem"
                    href={option.href}
                    download={option.fileName}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors hover:bg-surface"
                  >
                    <span>
                      <span className="block font-display text-base font-bold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{option.meta}</span>
                    </span>
                    <span aria-hidden className="text-lg text-terracotta">
                      ↓
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
