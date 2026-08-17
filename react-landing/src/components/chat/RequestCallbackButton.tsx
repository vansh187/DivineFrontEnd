import { SendIcon } from './icons/ChatIcons';

interface RequestCallbackButtonProps {
  disabled?: boolean;
  active?: boolean;
  onRequest: () => void;
}

export function RequestCallbackButton({ disabled, active, onRequest }: RequestCallbackButtonProps) {
  return (
    <button
      type="button"
      onClick={onRequest}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-terracotta-light disabled:pointer-events-none disabled:opacity-40"
    >
      <SendIcon className="h-3.5 w-3.5" />
      {active ? 'Requesting…' : 'Request Callback'}
    </button>
  );
}
