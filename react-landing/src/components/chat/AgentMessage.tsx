import { useState } from 'react';
import type { AgentMessageVariant } from '../../hooks/useChatSession';
import { CheckIcon, CopyIcon, PhoneIcon } from './icons/ChatIcons';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl border border-hairline bg-surface px-3.5 py-3 text-sm leading-[1.55] text-ink">
        {children}
      </div>
    </div>
  );
}

function ContactCard({ phone, phoneHref }: { phone: string; phoneHref: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the tel: link below still works */
    }
  };

  return (
    <Shell>
      <p className="text-xs text-ink-muted">Call us directly</p>
      <p className="font-display mt-1 text-2xl font-bold text-ink">{phone}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-terracotta-light"
        >
          {copied ? <CheckIcon className="h-3.5 w-3.5 text-green" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a
          href={phoneHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-green px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
        >
          <PhoneIcon className="h-3.5 w-3.5" />
          Open in phone
        </a>
      </div>
    </Shell>
  );
}

export function AgentMessage({ variant }: { variant: AgentMessageVariant }) {
  if (variant.kind === 'contact_card') {
    return <ContactCard phone={variant.phone} phoneHref={variant.phoneHref} />;
  }

  return (
    <Shell>
      <p>{variant.text}</p>
    </Shell>
  );
}
