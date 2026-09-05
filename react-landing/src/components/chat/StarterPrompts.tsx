/**
 * Client-side conversation openers, shown only before the visitor has said
 * anything. They guarantee the common entry points (finance, pricing, a visit,
 * plot availability) are always one tap away on first open, regardless of which
 * buttons the backend greeting happens to return. Each tap is sent to the
 * backend as if the visitor had typed it.
 */
const STARTERS = [
  'Home loan / finance enquiry',
  'Pricing & payment plan',
  'Book a site visit',
  'Show available plots',
  'Talk to a sales advisor',
];

export function StarterPrompts({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="border-b border-hairline bg-surface px-4 pb-3 pt-1">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Popular questions</p>
      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            disabled={disabled}
            onClick={() => onPick(starter)}
            className="rounded-full border border-hairline bg-bg px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors enabled:hover:border-terracotta enabled:hover:bg-terracotta/8 disabled:opacity-50"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
