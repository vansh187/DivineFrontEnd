import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { ChatMessage } from '../../hooks/useChatSession';
import { UserMessage } from './UserMessage';
import { AgentMessage } from './AgentMessage';
import { TypingIndicator } from './TypingIndicator';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface MessageListProps {
  messages: ChatMessage[];
  isSending: boolean;
  interimStatusLine: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({ messages, isSending, interimStatusLine, scrollRef }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages, isSending, reducedMotion]);

  return (
    <div
      ref={scrollRef}
      aria-live="polite"
      data-lenis-prevent
      className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
    >
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} text={message.text} />
        ) : (
          <AgentMessage key={message.id} variant={message.variant} />
        ),
      )}
      {isSending && <TypingIndicator interimStatusLine={interimStatusLine} />}
      <div ref={endRef} />
    </div>
  );
}
