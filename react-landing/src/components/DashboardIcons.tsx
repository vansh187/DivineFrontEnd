import type { ReactNode } from 'react';

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {children}
    </svg>
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
export const FileIcon = () => (
  <IconWrap>
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
