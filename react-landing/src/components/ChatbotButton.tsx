import { useState } from 'react';
import { contact } from '../data/contact';

const chatbotIcon = '/brand/chatbot-arch-icon-small.jpg';
const chatHref = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
  'Hi Divine Vision, I need help with property details.',
)}`;

export function ChatbotButton() {
  const [isOpen, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen ? (
        <div className="w-[min(calc(100vw-40px),340px)] overflow-hidden rounded-2xl border border-green/15 bg-surface shadow-[0_24px_70px_-28px_rgba(30,77,59,0.55)]">
          <div className="flex items-center gap-3 bg-chrome px-4 py-3 text-white">
            <img
              src={chatbotIcon}
              alt=""
              className="h-10 w-10 rounded-full border border-terracotta-light/40 object-cover shadow-[0_0_22px_rgba(242,163,92,0.35)]"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Divine Assistant</p>
              <p className="text-xs text-white/72">Property guidance</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chatbot"
              className="ml-auto text-lg font-semibold leading-none text-white/80 transition-colors hover:text-white"
            >
              x
            </button>
          </div>
          <div className="bg-bg px-4 py-4">
            <div className="rounded-xl border border-hairline bg-surface px-3 py-3 text-sm leading-[1.55] text-ink-muted">
              Tell us what you are looking for, and our team will help with plots, documents, visits, and payments.
            </div>
            <a
              href={chatHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block w-full rounded-full bg-green px-4 py-2.5 text-center text-xs font-semibold text-white transition-colors hover:bg-green-soft"
            >
              Start chat
            </a>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={isOpen ? 'Close chatbot' : 'Open chatbot'}
        className="group relative h-16 w-16 overflow-hidden rounded-full border border-terracotta-light/35 bg-chrome p-1.5 shadow-[0_18px_45px_-18px_rgba(30,77,59,0.75)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-terracotta-light focus:ring-offset-2 focus:ring-offset-bg"
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_68%_20%,rgba(242,163,92,0.45),transparent_34%),linear-gradient(135deg,rgba(56,142,60,0.28),rgba(30,77,59,0.88))]" />
        <img
          src={chatbotIcon}
          alt=""
          className="relative h-full w-full rounded-full object-cover ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105"
        />
      </button>
    </div>
  );
}
