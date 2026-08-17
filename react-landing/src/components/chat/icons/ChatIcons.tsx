function IconWrap({ children, className = 'h-4 w-4' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export const SendIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <path d="M17.5 2.5 2.5 8.8l6 2.2 2.2 6L17.5 2.5Z" />
    <path d="M17.5 2.5 8.7 11.3" />
  </IconWrap>
);

export const CloseIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <path d="M5 5l10 10M15 5 5 15" />
  </IconWrap>
);

export const MicIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <rect x="7.3" y="2.5" width="5.4" height="9.5" rx="2.7" />
    <path d="M4.3 9.5a5.7 5.7 0 0 0 11.4 0M10 15v2.5M7 17.5h6" />
  </IconWrap>
);

export const PhoneIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <path d="M5 3.5h2.3l1 3.6-1.7 1.4a9.5 9.5 0 0 0 4.9 4.9l1.4-1.7 3.6 1v2.3c0 .9-.8 1.6-1.7 1.5C8.9 15.9 4.1 11.1 3.5 5.2c-.1-.9.6-1.7 1.5-1.7Z" />
  </IconWrap>
);

export const CopyIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <rect x="7.5" y="7.5" width="9" height="9" rx="1.3" />
    <path d="M12.8 7.5V4.8a1.3 1.3 0 0 0-1.3-1.3H4.8a1.3 1.3 0 0 0-1.3 1.3v6.7a1.3 1.3 0 0 0 1.3 1.3h2.7" />
  </IconWrap>
);

export const MapPinIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <path d="M10 17.5S16 12.3 16 8a6 6 0 1 0-12 0c0 4.3 6 9.5 6 9.5Z" />
    <circle cx="10" cy="8" r="2" />
  </IconWrap>
);

export const CheckIcon = ({ className }: { className?: string } = {}) => (
  <IconWrap className={className}>
    <path d="M4.5 10.5 8 14l7.5-8" />
  </IconWrap>
);
