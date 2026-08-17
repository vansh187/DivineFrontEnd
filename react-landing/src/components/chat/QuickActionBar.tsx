import type { AgentMessageVariant } from '../../hooks/useChatSession';
import { RequestCallbackButton } from './RequestCallbackButton';
import { CallNowButton } from './CallNowButton';

interface QuickActionBarProps {
  callbackFlowActive: boolean;
  onRequestCallback: () => void;
  onDesktopContactCard: (variant: AgentMessageVariant) => void;
}

export function QuickActionBar({ callbackFlowActive, onRequestCallback, onDesktopContactCard }: QuickActionBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-2.5">
      <RequestCallbackButton disabled={callbackFlowActive} active={callbackFlowActive} onRequest={onRequestCallback} />
      <CallNowButton disabled={callbackFlowActive} onDesktopCard={onDesktopContactCard} />
    </div>
  );
}
