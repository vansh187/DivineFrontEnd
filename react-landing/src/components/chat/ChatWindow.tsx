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
  return (
    <div className="flex h-[min(70vh,560px)] w-[min(calc(100vw-40px),380px)] flex-col overflow-hidden rounded-3xl border border-green/15 bg-surface shadow-[0_24px_70px_-28px_rgba(30,77,59,0.55)]">
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

      <MessageList messages={messages} isSending={isSending} interimStatusLine={interimStatusLine} />

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
