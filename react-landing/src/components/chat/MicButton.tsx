import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { MicIcon } from './icons/ChatIcons';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface MicButtonProps {
  micState: 'idle' | 'recording' | 'transcribing';
  disabled?: boolean;
  onMicStateChange: (state: 'idle' | 'recording' | 'transcribing') => void;
  onRecordingComplete: (audio: Blob) => void;
  onPermissionDenied: () => void;
}

export function MicButton({ micState, disabled, onMicStateChange, onRecordingComplete, onPermissionDenied }: MicButtonProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const reducedMotion = usePrefersReducedMotion();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        onMicStateChange('transcribing');
        onRecordingComplete(audio);
      };

      recorderRef.current = recorder;
      recorder.start();
      onMicStateChange('recording');
    } catch {
      onPermissionDenied();
      onMicStateChange('idle');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  };

  // Stop any in-flight recording if the widget closes (unmounting MicButton)
  // while the mic is still capturing — otherwise the stream keeps running
  // with no UI left to stop it.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const handleClick = () => {
    if (micState === 'recording') {
      stopRecording();
    } else if (micState === 'idle') {
      void startRecording();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || micState === 'transcribing'}
      aria-label={micState === 'recording' ? 'Stop recording' : 'Start voice message'}
      aria-pressed={micState === 'recording'}
      className={clsx(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
        micState === 'recording' ? 'bg-terracotta text-white' : 'bg-chrome/10 text-chrome hover:bg-chrome/15',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {micState === 'recording' && !reducedMotion && (
        <span className="absolute inset-0 animate-ping rounded-full bg-terracotta/50" />
      )}
      <MicIcon className="relative h-4 w-4" />
    </button>
  );
}
