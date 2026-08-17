import { contact } from '../../data/contact';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { AgentMessageVariant } from '../../hooks/useChatSession';
import { PhoneIcon } from './icons/ChatIcons';

interface CallNowButtonProps {
  disabled?: boolean;
  onDesktopCard: (variant: AgentMessageVariant) => void;
}

export function CallNowButton({ disabled, onDesktopCard }: CallNowButtonProps) {
  const { isMobile } = useIsMobile();

  const handleCallNow = () => {
    if (isMobile) {
      window.location.href = contact.phoneHref;
      return;
    }
    onDesktopCard({ kind: 'contact_card', phone: contact.phone, phoneHref: contact.phoneHref });
  };

  return (
    <button
      type="button"
      onClick={handleCallNow}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-terracotta-light disabled:pointer-events-none disabled:opacity-40"
    >
      <PhoneIcon className="h-3.5 w-3.5" />
      Call Now
    </button>
  );
}
