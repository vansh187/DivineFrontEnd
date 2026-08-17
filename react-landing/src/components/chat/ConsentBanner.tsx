export function ConsentBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline bg-bg px-4 py-2.5 text-xs text-ink-muted">
      <p className="leading-snug">
        This chat may be recorded for quality and used per our privacy policy (DPDP Act, 2023).
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 font-semibold text-chrome hover:underline"
      >
        Got it
      </button>
    </div>
  );
}
