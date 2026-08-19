import { useEffect, useRef } from 'react';
import { ConsentBanner } from './ConsentBanner';
import { QuickActionBar } from './QuickActionBar';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { CloseIcon } from './icons/ChatIcons';
import type { AgentMessageVariant, ChatMessage } from '../../hooks/useChatSession';

const chatbotIcon = '/brand/chatbot-arch-icon-small.jpg';

interface ChatWindowProps {
  messages: ChatMessage[];
  isSending: boolean;
  interimStatusLine: string | null;
  consentShown: boolean;
  callbackFlowActive: boolean;
  micState: 'idle' | 'recording' | 'transcribing';
  onClose: () => void;
  onDismissConsent: () => void;
  onRequestCallback: () => void;
  onDesktopContactCard: (variant: AgentMessageVariant) => void;
  onSendText: (text: string) => void;
  onSendAudio: (audio: Blob) => void;
  onMicStateChange: (state: 'idle' | 'recording' | 'transcribing') => void;
  onMicPermissionDenied: () => void;
}

export function ChatWindow({
  messages,
  isSending,
  interimStatusLine,
  consentShown,
  callbackFlowActive,
  micState,
  onClose,
  onDismissConsent,
  onRequestCallback,
  onDesktopContactCard,
  onSendText,
  onSendAudio,
  onMicStateChange,
  onMicPermissionDenied,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // The widget is a fixed overlay sitting on top of the page — without this,
  // a wheel scroll anywhere over it (the header, quick actions, input bar,
  // or the message thread once it's too short to overflow / already at an
  // edge) falls through and scrolls the page behind it instead. Only let the
  // scroll through natively when the message list can actually consume it.
  // React's onWheel is registered as a passive listener, so preventDefault()
  // inside a synthetic handler is silently ignored — this has to be a real
  // native, non-passive listener.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();

      const list = scrollRef.current;
      if (!list || !list.contains(event.target as Node)) {
        event.preventDefault();
        return;
      }
      const atTop = list.scrollTop <= 0;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.stopPropagation();
    };

    root.addEventListener('wheel', handleWheel, { passive: false });
    root.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      root.removeEventListener('wheel', handleWheel);
      root.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-lenis-prevent
      className="flex h-[min(74svh,560px)] w-[min(calc(100dvw-24px),380px)] flex-col overflow-hidden rounded-2xl border border-green/15 bg-surface shadow-[0_24px_70px_-28px_rgba(6,31,45,0.46)] sm:h-[min(70vh,560px)] sm:w-[min(calc(100vw-40px),380px)] sm:rounded-3xl"
    >
      <div className="flex items-center gap-3 bg-chrome px-4 py-3 text-white">
        <img
          src={chatbotIcon}
          alt=""
          className="h-10 w-10 rounded-full border border-terracotta-light/40 object-cover shadow-[0_0_22px_rgba(242,163,92,0.35)]"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">Divine Assistant</p>
          <p className="text-xs text-white/72">Property guidance</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      {!consentShown && <ConsentBanner onDismiss={onDismissConsent} />}

      <QuickActionBar
        callbackFlowActive={callbackFlowActive}
        onRequestCallback={onRequestCallback}
        onDesktopContactCard={onDesktopContactCard}
      />

      <MessageList messages={messages} isSending={isSending} interimStatusLine={interimStatusLine} scrollRef={scrollRef} />

      <InputBar
        disabled={isSending}
        micState={micState}
        onSendText={onSendText}
        onSendAudio={onSendAudio}
        onMicStateChange={onMicStateChange}
        onMicPermissionDenied={onMicPermissionDenied}
      />
    </div>
  );
}
