import type { ReactElement, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Instagram(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

function Facebook(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M14.5 8.5h2V5.3c-.35-.05-1.53-.15-2.9-.15-2.87 0-4.83 1.75-4.83 4.97v2.63H5.9v3.58h2.87V21.5h3.7v-5.17h2.83l.45-3.58h-3.28V10.4c0-1.04.28-1.9 2.03-1.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function YouTube(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="2.8" y="6" width="18.4" height="12" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.4 9.5v5l4.4-2.5-4.4-2.5Z" fill="currentColor" />
    </svg>
  );
}

function LinkedIn(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.2" cy="8" r="1.15" fill="currentColor" />
      <path d="M7.2 10.8v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M11 16.8v-3.6c0-1.4.9-2.4 2.15-2.4 1.2 0 1.95.85 1.95 2.35v3.65"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 10.8v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export const socialIconById: Record<string, (props: IconProps) => ReactElement> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: YouTube,
  linkedin: LinkedIn,
};
