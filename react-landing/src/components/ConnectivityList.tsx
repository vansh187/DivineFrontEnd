import { useEffect, useId, useRef, useState } from 'react';
import type { ConnectivityItem } from '../data/locationConnectivity';

interface ConnectivityListProps {
  items: ConnectivityItem[];
  className?: string;
}

/**
 * The "everything nearby" list of landmarks + drive times. A row that carries a
 * `photo` becomes a hover / focus / tap target that pops a small card with a
 * picture of the actual place, so a buyer can see the real school, hospital or
 * station instead of trusting a label. If the photo file is missing the card
 * still opens with the name + note and a neutral placeholder.
 */
export function ConnectivityList({ items, className = '' }: ConnectivityListProps) {
  const baseId = useId();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [brokenLabels, setBrokenLabels] = useState<string[]>([]);
  // Small grace period so moving the pointer from the row across to the card
  // doesn't count as "left" and close it mid-travel.
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openCard = (label: string) => {
    cancelClose();
    setOpenLabel(label);
  };
  const scheduleClose = (label: string) => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpenLabel((current) => (current === label ? null : current));
    }, 140);
  };
  useEffect(() => cancelClose, []);

  return (
    <div className={`divide-y divide-hairline border-t border-hairline ${className}`}>
      {items.map((item, index) => {
        const cardId = `${baseId}-${index}`;
        const isOpen = !!item.photo && openLabel === item.label;
        const photoBroken = brokenLabels.includes(item.label);

        if (!item.photo) {
          return (
            <div key={item.label} className="flex items-center justify-between py-3.5">
              <span className="text-sm text-ink-muted">{item.label}</span>
              <span className="font-display text-base font-semibold text-ink">{item.value}</span>
            </div>
          );
        }

        return (
          <div
            key={item.label}
            className="relative flex items-center justify-between py-3.5"
            onPointerEnter={(event) => {
              if (event.pointerType !== 'touch') openCard(item.label);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== 'touch') scheduleClose(item.label);
            }}
          >
            <div className="relative">
              <button
                type="button"
                className="group -mx-1 -my-1 flex items-center gap-1.5 rounded px-1 py-1 text-left text-sm text-ink-muted underline decoration-dotted decoration-hairline underline-offset-4 transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                aria-expanded={isOpen}
                aria-describedby={isOpen ? cardId : undefined}
                onClick={() => setOpenLabel((current) => (current === item.label ? null : item.label))}
                onFocus={() => openCard(item.label)}
                onBlur={() => scheduleClose(item.label)}
              >
                {item.label}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 text-ink-muted/60 transition-colors group-hover:text-terracotta">
                  <path
                    fill="currentColor"
                    d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v8.09l3.3-3.3a1 1 0 0 1 1.4 0l2.3 2.3 3.3-3.3a1 1 0 0 1 1.4 0L19 11.1V7H5Zm3.5 1A1.5 1.5 0 1 1 7 9.5 1.5 1.5 0 0 1 8.5 8Z"
                  />
                </svg>
              </button>

              {isOpen && (
                <div
                  id={cardId}
                  role="tooltip"
                  onPointerEnter={() => openCard(item.label)}
                  onPointerLeave={() => scheduleClose(item.label)}
                  // Below `sm`, this is tap-triggered (touch bypasses the
                  // hover-only pointer handlers above) rather than
                  // hover-triggered, and `left-full` anchored to a row near
                  // the left edge of the page could push a long label's card
                  // past the right edge of the screen. Fixed + viewport-
                  // centered there instead; the original hover-anchored
                  // positioning is unchanged from `sm` up.
                  className="fixed inset-x-4 top-1/2 z-30 -translate-y-1/2 overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_24px_60px_-24px_rgba(6,31,45,0.4)] sm:absolute sm:inset-x-auto sm:left-full sm:top-1/2 sm:ml-3 sm:w-64 sm:max-w-[70vw] sm:-translate-y-1/2"
                >
                {photoBroken ? (
                  <div className="flex h-32 w-full items-center justify-center bg-bg text-xs font-medium text-ink-muted/70">
                    Photo coming soon
                  </div>
                ) : (
                  <img
                    src={item.photo.src}
                    alt={item.photo.alt}
                    loading="lazy"
                    className="h-32 w-full bg-bg object-cover"
                    onError={() =>
                      setBrokenLabels((current) => (current.includes(item.label) ? current : [...current, item.label]))
                    }
                  />
                )}
                <div className="p-3">
                  <p className="font-display text-sm font-semibold text-ink">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-terracotta">{item.value}</p>
                  {item.photo.blurb && <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{item.photo.blurb}</p>}
                  {!photoBroken && item.photo.credit && (
                    <p className="mt-1.5 text-[10px] leading-tight text-ink-muted/60">{item.photo.credit}</p>
                  )}
                </div>
                </div>
              )}
            </div>

            <span className="font-display text-base font-semibold text-ink">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
