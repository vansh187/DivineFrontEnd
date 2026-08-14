import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Calls `onDismiss` when a pointer event lands outside `ref`'s subtree, or
 * on Escape.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, onDismiss, enabled]);
}
