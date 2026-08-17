export function TypingIndicator({ interimStatusLine }: { interimStatusLine: string | null }) {
  return (
    <div className="flex items-center gap-2 px-1 py-2 text-ink-muted">
      {interimStatusLine ? (
        <p className="text-xs italic leading-snug">{interimStatusLine}</p>
      ) : (
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
        </span>
      )}
    </div>
  );
}
