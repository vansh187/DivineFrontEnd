import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

type RevealTag = 'div' | 'p';

interface RevealProps {
  children: ReactNode;
  as?: RevealTag;
  className?: string;
}

/**
 * Fades + lifts its children into view the first time they enter the
 * viewport.
 */
export function Reveal({ children, as = 'div', className }: RevealProps) {
  const ref = useRef<HTMLDivElement & HTMLParagraphElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;

  return (
    <Tag
      ref={ref}
      className={clsx(
        'transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
