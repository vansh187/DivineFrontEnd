import { CloseIcon } from './icons/ChatIcons';

const chatbotIcon = '/brand/chatbot-arch-icon-small.jpg';

interface ChatTeaserProps {
  onOpen: () => void;
  onDismiss: () => void;
}

export function ChatTeaser({ onOpen, onDismiss }: ChatTeaserProps) {
  return (
    <div className="flex w-[min(calc(100dvw-24px),280px)] items-start gap-2.5 rounded-2xl border border-green/15 bg-surface p-3 shadow-[0_18px_45px_-18px_rgba(6,31,45,0.45)]">
      <img
        src={chatbotIcon}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-terracotta-light/40 object-cover"
      />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left text-sm leading-[1.4] text-ink"
      >
        Hi, I'm Divine Assist. How may I help you?
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-bg hover:text-ink"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
