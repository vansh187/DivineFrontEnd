import type { ReactNode } from 'react';

function IconWrap({ children, className = 'h-6 w-6' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export type IconAccent = 'chrome' | 'green' | 'green-soft' | 'terracotta';

/** Each dashboard tile/card gets its own accent, pulled from the existing brand
 * palette (no new colors) so the dashboard reads as a coherent set rather than
 * identical neutral badges — the gradient + ring + tinted shadow gives the icon
 * real depth instead of sitting flat on the card. */
const accentClass: Record<IconAccent, { badge: string; icon: string }> = {
  chrome: {
    badge: 'bg-gradient-to-br from-chrome/16 via-chrome/6 to-transparent ring-1 ring-chrome/15 shadow-[0_10px_22px_-10px_rgba(6,31,45,0.45)]',
    icon: 'text-chrome',
  },
  green: {
    badge: 'bg-gradient-to-br from-green/20 via-green/7 to-transparent ring-1 ring-green/18 shadow-[0_10px_22px_-10px_rgba(6,31,45,0.44)]',
    icon: 'text-green',
  },
  'green-soft': {
    badge: 'bg-gradient-to-br from-green-soft/22 via-green-soft/8 to-transparent ring-1 ring-green-soft/18 shadow-[0_10px_22px_-10px_rgba(10,49,69,0.4)]',
    icon: 'text-green-soft',
  },
  terracotta: {
    badge: 'bg-gradient-to-br from-terracotta/18 via-terracotta/6 to-transparent ring-1 ring-terracotta/18 shadow-[0_10px_22px_-10px_rgba(14,66,88,0.38)]',
    icon: 'text-terracotta',
  },
};

/** Shared premium icon-badge used by every dashboard card (TileShell, PlaceholderCard)
 * so the whole workspace reads as one designed system. `interactive` adds the
 * hover scale/tilt — pair with `group` on the parent card. */
export function IconBadge({ icon, accent = 'green', interactive = false }: { icon: ReactNode; accent?: IconAccent; interactive?: boolean }) {
  const { badge, icon: iconColor } = accentClass[accent];
  return (
    <span
      className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 ${interactive ? 'group-hover:scale-105 group-hover:rotate-2' : ''} ${badge} ${iconColor}`}
    >
      {icon}
    </span>
  );
}

export const BookmarkIcon = () => (
  <IconWrap>
    <path d="M5.5 3.5h9a1 1 0 0 1 1 1v12l-5.5-3.3-5.5 3.3v-12a1 1 0 0 1 1-1Z" />
  </IconWrap>
);
export const CalendarIcon = () => (
  <IconWrap>
    <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
    <path d="M3 8.5h14M7 2.5v3M13 2.5v3" />
  </IconWrap>
);
export const FileIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <path d="M6 2.8h5.5L15 6.3v10.9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1Z" />
    <path d="M11.3 2.8v3.5H15" />
  </IconWrap>
);
export const UsersIcon = () => (
  <IconWrap>
    <circle cx="7" cy="6.8" r="2.8" />
    <path d="M1.8 16c.8-2.6 2.9-4 5.2-4s4.4 1.4 5.2 4" />
    <path d="M12.8 4.3a2.8 2.8 0 0 1 0 5M15.5 16c-.5-1.8-1.5-3.1-2.9-3.7" />
  </IconWrap>
);
export const ChartIcon = () => (
  <IconWrap>
    <path d="M3 16.5V3.5M3 16.5h14" />
    <path d="M6 13.5v-4M9.7 13.5v-7M13.4 13.5v-2.5" />
  </IconWrap>
);
export const TagIcon = () => (
  <IconWrap>
    <path d="M9.5 3.5H4a.5.5 0 0 0-.5.5v5.5a1 1 0 0 0 .3.7l7.2 7.2a1 1 0 0 0 1.4 0l5.5-5.5a1 1 0 0 0 0-1.4l-7.2-7.2a1 1 0 0 0-.7-.3Z" />
    <circle cx="7" cy="7" r="1.1" />
  </IconWrap>
);
export const IdCardIcon = () => (
  <IconWrap>
    <rect x="2.5" y="4" width="15" height="12" rx="1.5" />
    <circle cx="7" cy="9.3" r="1.8" />
    <path d="M4.3 14c.5-1.5 1.5-2.2 2.7-2.2s2.2.7 2.7 2.2M12 8.2h4M12 11h4" />
  </IconWrap>
);
export const CardIcon = () => (
  <IconWrap>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="M2.5 8h15M5.5 12h4" />
  </IconWrap>
);
export const RupeeIcon = () => (
  <IconWrap>
    <path d="M5.5 4h9M5.5 7.5h9M5.5 4a3.6 3.6 0 0 1 0 7h-1.3L11 16.5" />
  </IconWrap>
);
export const BuildingIcon = () => (
  <IconWrap>
    <rect x="4" y="2.5" width="8" height="15" rx="1" />
    <path d="M12 8.5h3.5a1 1 0 0 1 1 1v8h-4.5M6.5 6h1M6.5 9h1M6.5 12h1M9.5 6h1M9.5 9h1M9.5 12h1" />
  </IconWrap>
);
export const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M4.5 10.5 8 14l7.5-8" />
  </svg>
);
