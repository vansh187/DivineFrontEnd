import { useState } from 'react';
import type { AgentMessageVariant, ChatButton, PlotListItem } from '../../hooks/useChatSession';
import { CheckIcon, CopyIcon, PhoneIcon } from './icons/ChatIcons';
import { Markdown } from './Markdown';
import { ErrorBoundary } from '../ErrorBoundary';

const plotIntelligenceButton: ChatButton = {
  label: 'Find My Perfect Plot',
  value: 'plot_intelligence_start',
  action: 'plot_intelligence',
};

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

function ButtonOptions({
  buttons,
  interactive,
  onButtonTap,
}: {
  buttons: ChatButton[];
  interactive: boolean;
  onButtonTap?: (button: ChatButton) => void;
}) {
  const shouldAddPlotSearch =
    !buttons.some((button) => button.action === 'plot_intelligence') &&
    buttons.some((button) => button.action === 'chatbot_menu') &&
    (buttons.length >= 3 || buttons.some((button) => /brows/i.test(`${button.label} ${button.value}`)));
  const visibleButtons = shouldAddPlotSearch ? [...buttons, plotIntelligenceButton] : buttons;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {visibleButtons.map((button) => (
        <button
          key={button.value}
          type="button"
          disabled={!interactive}
          onClick={() => onButtonTap?.(button)}
          className="w-full rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors enabled:hover:border-terracotta enabled:hover:bg-terracotta/8 disabled:cursor-default disabled:opacity-60"
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

const STRING_LABEL_KEYS = [
  'label',
  'title',
  'name',
  'text',
  'display',
  'display_name',
  'summary',
  'headline',
  'description',
];

const FIELD_ALIASES: Record<'project' | 'size' | 'price' | 'unit' | 'block' | 'place' | 'avail', string[]> = {
  project: ['project_name', 'projectName', 'project', 'township', 'society'],
  size: ['size', 'plot_size', 'plotSize', 'area_label', 'area_sqyd', 'areaSqyd', 'area', 'size_sqyd'],
  price: ['price', 'price_label', 'priceLabel', 'total_price', 'amount'],
  unit: ['unit_number', 'unitNumber', 'plot_no', 'plotNo', 'plot_number', 'unit'],
  block: ['block', 'block_name', 'sector'],
  place: ['location', 'locality', 'city', 'address'],
  avail: ['availability', 'available', 'units_available', 'available_count', 'count'],
};

function firstString(plot: PlotListItem, keys: string[]): string | null {
  for (const key of keys) {
    const value = plot[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** Best-effort human label for a plot row. Prefers a ready-made string field,
 * then composes one from whatever recognised fields exist, then falls back to
 * the matching line of the message's own numbered list, then a generic label. */
function plotRowLabel(plot: PlotListItem, fallbackLine?: string): string {
  const explicit = firstString(plot, STRING_LABEL_KEYS);
  if (explicit) return explicit;

  const project = firstString(plot, FIELD_ALIASES.project);
  const rawSize = firstString(plot, FIELD_ALIASES.size);
  const size = rawSize && /^\d+(\.\d+)?$/.test(rawSize) ? `${rawSize} sq yd` : rawSize;
  const unit = firstString(plot, FIELD_ALIASES.unit);
  const block = firstString(plot, FIELD_ALIASES.block);
  const avail = firstString(plot, FIELD_ALIASES.avail);
  const parts = [
    project,
    unit ? `Plot ${unit}` : null,
    block ? `Block ${block}` : null,
    size,
    firstString(plot, FIELD_ALIASES.price),
    firstString(plot, FIELD_ALIASES.place),
    avail ? `${avail} available` : null,
  ].filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(' · ');

  if (fallbackLine && fallbackLine.trim()) return fallbackLine.trim();

  // Last resort: reconstruct from the booking URL's own query params
  // (e.g. ?project=Suraksha+Enclave&size=114).
  try {
    const params = new URL(plot.book_url, window.location.origin).searchParams;
    const fromUrl = [params.get('project'), params.get('size') ? `${params.get('size')} sq yd` : null]
      .filter((part): part is string => Boolean(part))
      .join(' · ');
    if (fromUrl) return fromUrl;
  } catch {
    /* malformed url — fall through */
  }
  return 'View plot';
}

const LIST_ITEM_RE = /^\s*(?:\d+[.)]|[-*•])\s+(.*\S)\s*$/;

/** Pulls the content of an ordered/unordered list out of the reply text, so the
 * rows can reuse the wording the backend already wrote for the visitor. */
function extractListLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.match(LIST_ITEM_RE))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1].replace(/\*\*/g, '').trim());
}

/** Drops the list block from the reply text — it's re-rendered as tappable rows,
 * so leaving it in the prose too would just show every plot twice. */
function stripListLines(text: string): string {
  return text
    .split('\n')
    .filter((line) => !LIST_ITEM_RE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function PlotList({
  plots,
  text,
  interactive,
  onPlotSelect,
}: {
  plots: PlotListItem[];
  text: string;
  interactive: boolean;
  onPlotSelect?: (plot: PlotListItem) => void;
}) {
  const listLines = extractListLines(text);
  const useLines = listLines.length === plots.length;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {plots.map((plot, index) => (
        <button
          key={`${plot.book_url}-${index}`}
          type="button"
          disabled={!interactive}
          onClick={() => onPlotSelect?.(plot)}
          className="w-full rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors enabled:hover:border-terracotta enabled:hover:bg-terracotta/8 disabled:cursor-default disabled:opacity-60"
        >
          {plotRowLabel(plot, useLines ? listLines[index] : undefined)}
        </button>
      ))}
    </div>
  );
}

interface AgentMessageProps {
  variant: AgentMessageVariant;
  interactive?: boolean;
  onButtonTap?: (button: ChatButton) => void;
  onPlotSelect?: (plot: PlotListItem) => void;
}

export function AgentMessage({ variant, interactive = false, onButtonTap, onPlotSelect }: AgentMessageProps) {
  if (variant.kind === 'contact_card') {
    return <ContactCard phone={variant.phone} phoneHref={variant.phoneHref} />;
  }

  // Strip the numbered list from the prose only when every item maps 1:1 to a
  // rendered row — otherwise keep it so nothing is lost.
  const rowsMirrorList =
    variant.kind === 'plot_list' &&
    variant.plots.length > 0 &&
    extractListLines(variant.text).length === variant.plots.length;
  const prose = rowsMirrorList ? stripListLines(variant.text) : variant.text;

  return (
    <Shell>
      {/* A malformed reply must never crash the chat thread — fall back to the
          raw text if the lightweight Markdown parser throws. */}
      {prose && (
        <ErrorBoundary resetKeys={[prose]} fallback={<p className="whitespace-pre-wrap">{prose}</p>}>
          <Markdown text={prose} />
        </ErrorBoundary>
      )}
      {variant.kind === 'plot_list' && variant.plots.length > 0 && (
        <PlotList
          plots={variant.plots}
          text={variant.text}
          interactive={interactive}
          onPlotSelect={onPlotSelect}
        />
      )}
      {variant.buttons && variant.buttons.length > 0 && (
        <ButtonOptions buttons={variant.buttons} interactive={interactive} onButtonTap={onButtonTap} />
      )}
    </Shell>
  );
}
