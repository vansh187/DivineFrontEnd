interface DivineVisionLogoProps {
  variant?: 'nav' | 'footer';
}

export function DivineVisionLogo({ variant = 'nav' }: DivineVisionLogoProps) {
  const isFooter = variant === 'footer';

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-concrete-grey/35 bg-white shadow-[0_12px_28px_-22px_rgba(0,0,0,0.75)] ${
        isFooter
          ? 'h-[72px] w-[280px] max-w-full px-4'
          : 'h-11 w-[clamp(166px,45vw,216px)] px-3 sm:h-[54px] sm:w-[248px] sm:px-4'
      }`}
    >
      <span
        aria-hidden="true"
        className={`block whitespace-nowrap font-display font-bold uppercase leading-none text-chrome ${
          isFooter
            ? 'text-[31px] tracking-[0.12em]'
            : 'text-[clamp(19px,5.05vw,25px)] tracking-[0.085em] sm:text-[28px] sm:tracking-[0.105em]'
        }`}
      >
        Divine Vision
      </span>
    </span>
  );
}
