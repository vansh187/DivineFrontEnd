import { useState } from 'react';
import type { FormEvent } from 'react';
import { MicButton } from './MicButton';
import { SendIcon } from './icons/ChatIcons';

interface InputBarProps {
  disabled: boolean;
  micState: 'idle' | 'recording' | 'transcribing';
  onSendText: (text: string) => void;
  onSendAudio: (audio: Blob) => void;
  onMicStateChange: (state: 'idle' | 'recording' | 'transcribing') => void;
  onMicPermissionDenied: () => void;
}

export function InputBar({ disabled, micState, onSendText, onSendAudio, onMicStateChange, onMicPermissionDenied }: InputBarProps) {
  const [text, setText] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSendText(trimmed);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-hairline bg-surface px-3 py-2.5">
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled || micState !== 'idle'}
        placeholder="Type a message…"
        className="min-w-0 flex-1 rounded-full border border-hairline bg-bg px-4 py-2 text-sm text-ink outline-none transition-colors focus:border-green disabled:opacity-60"
      />
      <MicButton
        micState={micState}
        disabled={disabled}
        onMicStateChange={onMicStateChange}
        onRecordingComplete={onSendAudio}
        onPermissionDenied={onMicPermissionDenied}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim() || micState !== 'idle'}
        aria-label="Send"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green text-white transition-colors hover:bg-green-soft disabled:pointer-events-none disabled:opacity-40"
      >
        <SendIcon className="h-4 w-4" />
      </button>
    </form>
  );
}
