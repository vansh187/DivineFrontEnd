interface DivineVisionLogoProps {
  variant?: 'nav' | 'footer';
}

export function DivineVisionLogo({ variant = 'nav' }: DivineVisionLogoProps) {
  const isFooter = variant === 'footer';

  return (
    <span
      className={`block whitespace-nowrap font-display font-bold uppercase leading-none ${
        isFooter ? 'text-[28px] tracking-[0.14em] text-white' : 'text-[20px] tracking-[0.12em] text-current sm:text-[24px]'
      }`}
    >
      Divine Vision
    </span>
  );
}
