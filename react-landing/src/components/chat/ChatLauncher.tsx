import clsx from 'clsx';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

const chatbotIcon = '/brand/chatbot-arch-icon-small.jpg';

export function ChatLauncher({ onOpen }: { onOpen: () => void }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open concierge chat"
      className="group relative h-14 w-14 overflow-hidden rounded-full border border-terracotta-light/35 bg-chrome p-1.5 shadow-[0_18px_45px_-18px_rgba(6,31,45,0.72)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-terracotta-light focus:ring-offset-2 focus:ring-offset-bg sm:h-16 sm:w-16"
    >
      <span
        className={clsx(
          'absolute inset-0 bg-[radial-gradient(circle_at_68%_20%,rgba(156,201,218,0.48),transparent_34%),linear-gradient(135deg,rgba(6,31,45,0.28),rgba(6,31,45,0.9))]',
          !reducedMotion && 'animate-pulse',
        )}
      />
      <img
        src={chatbotIcon}
        alt=""
        className="relative h-full w-full rounded-full object-cover ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105"
      />
    </button>
  );
}
