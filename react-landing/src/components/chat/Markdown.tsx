import type { ReactNode } from 'react';
import { isReportDownloadUrl, resolveReportUrl } from '../../utils/chatReport';

/**
 * Tiny, dependency-free Markdown renderer scoped to what the concierge backend
 * actually emits: headings, bold/italic/code, links, ordered/unordered lists,
 * GFM pipe tables, horizontal rules and blank-line-separated paragraphs.
 *
 * It builds React nodes directly (no `dangerouslySetInnerHTML`), so raw text in
 * the reply can never inject markup.
 */

const INLINE_RE =
  /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\[(\/[A-Za-z0-9._~\-/]+|https?:\/\/[^\]\s]+)\](?!\()|(?<![([])\b(https?:\/\/[^\s)\]]+))/g;

/** Only http(s), mailto, and site-relative paths render as clickable links — a
 * `javascript:`/`data:`/other scheme is left as plain text instead, so a link
 * embedded in reply text can never execute script on click. A relative path is
 * rejected if it contains a backslash or starts with a second `/` or `\` right
 * after the first — browsers normalize both `//host` and `/\host` as a
 * protocol-relative URL to an *external* host, so without this a same-site-
 * looking `/\evil.com` would otherwise pass as "safe". */
const ABSOLUTE_SAFE_HREF_RE = /^(https?:\/\/|mailto:)/i;

function isSafeHref(href: string): boolean {
  if (ABSOLUTE_SAFE_HREF_RE.test(href)) return true;
  if (href.includes('\\')) return false;
  return href.startsWith('/') && !href.startsWith('//');
}

/**
 * Resolves a link from an agent reply. A loan/report download URL is sent to
 * the API host and rendered as a download button; every other link (including
 * site-relative paths like `/our-story`) is left exactly as written.
 */
function resolveLink(rawHref: string, fallbackLabel: string): { href: string; label: string; download: boolean } {
  if (isReportDownloadUrl(rawHref)) {
    return { href: resolveReportUrl(rawHref), label: 'Download report (PDF)', download: true };
  }
  return { href: rawHref, label: fallbackLabel, download: false };
}

function LinkNode({ href, label, download }: { href: string; label: string; download: boolean }) {
  if (download) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        download
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-green bg-green px-3 py-1.5 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-green-soft"
      >
        ⬇ {label}
      </a>
    );
  }
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="font-semibold text-green underline underline-offset-2"
    >
      {label}
    </a>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    const [, , boldA, boldB, italA, italB, code, linkText, linkHref, bracketUrl, autoUrl] = match;
    if (boldA || boldB) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {boldA || boldB}
        </strong>,
      );
    } else if (italA || italB) {
      nodes.push(<em key={key}>{italA || italB}</em>);
    } else if (code) {
      nodes.push(
        <code key={key} className="rounded bg-hairline/60 px-1 py-0.5 font-mono text-[0.85em]">
          {code}
        </code>,
      );
    } else if (linkText && linkHref) {
      if (isSafeHref(linkHref)) {
        const link = resolveLink(linkHref, linkText);
        nodes.push(<LinkNode key={key} href={link.href} label={link.label} download={link.download} />);
      } else {
        nodes.push(linkText);
      }
    } else if (bracketUrl || autoUrl) {
      const raw = bracketUrl || autoUrl;
      if (isSafeHref(raw)) {
        const link = resolveLink(raw, raw);
        nodes.push(<LinkNode key={key} href={link.href} label={link.label} download={link.download} />);
      } else {
        nodes.push(raw);
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

const isTableSeparator = (line: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-');
const isDivider = (line: string) => /^\s*([-*_])\1{2,}\s*$/.test(line);
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*(\d+)\.\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (isDivider(line)) {
      blocks.push(<hr key={key++} className="my-2.5 border-hairline" />);
      i += 1;
      continue;
    }

    // Heading
    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push(
        <p key={key++} className="mt-1 font-display text-[15px] font-bold leading-snug text-ink first:mt-0">
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    // GFM table: a pipe row immediately followed by a separator row
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const hasHeaderLabels = header.some((cell) => cell !== '');
      blocks.push(
        <div key={key++} className="my-1 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            {hasHeaderLabels && header.length > 1 && (
              <thead>
                <tr>
                  {header.map((cell, c) => (
                    <th
                      key={c}
                      className="border border-hairline bg-bg px-2 py-1.5 text-left font-semibold text-ink"
                    >
                      {renderInline(cell, `th-${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="align-top">
                  {header.map((_cell, c) => (
                    <td key={c} className="border border-hairline px-2 py-1.5">
                      {c === 0 && header.length > 1 ? (
                        <span className="font-semibold text-ink">{renderInline(row[c] ?? '', `t${r}-${c}`)}</span>
                      ) : (
                        renderInline(row[c] ?? '', `t${r}-${c}`)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list
    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push(lines[i].match(UL_RE)![1]);
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-1 pl-5 marker:text-ink-muted">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ul${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list — preserve the ordinal the backend actually gave
    if (OL_RE.test(line)) {
      const startNumber = Number.parseInt(line.match(OL_RE)![1], 10);
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(lines[i].match(OL_RE)![2]);
        i += 1;
      }
      blocks.push(
        <ol
          key={key++}
          start={Number.isFinite(startNumber) && startNumber !== 1 ? startNumber : undefined}
          className="my-1 list-decimal space-y-1 pl-5 marker:text-ink-muted"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ol${key}-${idx}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph — gather consecutive plain lines
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isDivider(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="whitespace-pre-wrap">
        {paragraph.flatMap((textLine, idx) => {
          const rendered = renderInline(textLine, `p${key}-${idx}`);
          return idx === 0 ? rendered : [<br key={`br${idx}`} />, ...rendered];
        })}
      </p>,
    );
  }

  return <div className="flex flex-col gap-1.5">{blocks}</div>;
}
