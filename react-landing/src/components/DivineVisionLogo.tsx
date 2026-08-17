interface DivineVisionLogoProps {
  variant?: 'nav' | 'footer';
}

export function DivineVisionLogo({ variant = 'nav' }: DivineVisionLogoProps) {
  const isFooter = variant === 'footer';

  return (
    <span
      className={`group/logo relative flex shrink-0 items-center overflow-hidden rounded-2xl border border-terracotta-light/25 bg-bg text-left shadow-[0_14px_36px_-24px_rgba(0,0,0,0.75)] ring-1 ring-white/15 ${
        isFooter ? 'h-16 w-[238px] px-2.5' : 'h-12 w-[184px] px-1.5 sm:h-[52px] sm:w-[198px] sm:px-2'
      }`}
    >
      <span className="pointer-events-none absolute -left-5 top-1/2 h-14 w-14 -translate-y-1/2 rounded-full bg-green/9" />
      <span className="pointer-events-none absolute -right-3 -top-4 h-12 w-12 rounded-full bg-terracotta-light/14" />
      <span className="pointer-events-none absolute bottom-1.5 left-4 h-0.5 w-12 rounded-full bg-green/30" />
      <span className="pointer-events-none absolute bottom-1.5 left-[66px] h-0.5 w-5 rounded-full bg-terracotta-light/50" />
      <span className="relative flex w-full min-w-0 flex-col items-center text-center">
        <span className="flex items-baseline justify-center gap-1.5">
          <span
            className={`font-display font-bold leading-none text-green [text-shadow:0_1px_0_rgba(255,255,255,0.55)] ${
            isFooter ? 'text-[22px]' : 'text-[18.5px] sm:text-[20px]'
            }`}
          >
            Divine
          </span>
          <span
            className={`font-display font-bold leading-none text-chrome [text-shadow:0_1px_0_rgba(255,255,255,0.55)] ${
            isFooter ? 'text-[22px]' : 'text-[18.5px] sm:text-[20px]'
            }`}
          >
            Vision
          </span>
        </span>
        <span
          className={`mt-1 block whitespace-nowrap font-semibold leading-none text-terracotta ${
            isFooter ? 'text-[9px]' : 'text-[6.75px] sm:text-[7.25px]'
          }`}
        >
          Elegant, Nature-Inspired, Community-Focused
        </span>
      </span>
    </span>
  );
}
