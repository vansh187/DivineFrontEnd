import { API_BASE_URL } from '../services/authApi';

/**
 * The concierge backend hands back a loan-eligibility report as a bare path in
 * the reply text, e.g. `Download URL: [/loan/report/<id>/download]`. These
 * helpers pull that out and turn it into something the browser can fetch.
 */

const REPORT_URL_RE = /(https?:\/\/[^\s)\]]+|\/[A-Za-z0-9._~\-/]+)\/download(?![\w-])/i;

/**
 * True only for a loan/report *download* URL — a `/download` path that also
 * mentions `report` or `loan`. Deliberately narrow so a generic link that
 * happens to contain `/download` (a floor plan, a brochure) is left alone.
 */
export function isReportDownloadUrl(url: string): boolean {
  return REPORT_URL_RE.test(url) && /report|loan/i.test(url);
}

/** Extracts a loan/report download URL from an agent reply, or null. */
export function extractReportDownloadUrl(text: string): string | null {
  const match = text.match(REPORT_URL_RE);
  if (!match) return null;
  const candidate = match[0];
  return isReportDownloadUrl(candidate) ? candidate : null;
}

/** Resolves a possibly-relative report URL against the API host. */
export function resolveReportUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Best-effort "just download it" for a report URL. The file lives on the API
 * host (cross-origin), so the `download` attribute is only a hint there and the
 * browser may open the PDF in a new tab instead — either way the visitor gets
 * the file without leaving the chat.
 */
export function triggerReportDownload(absoluteUrl: string) {
  const anchor = document.createElement('a');
  anchor.href = absoluteUrl;
  anchor.download = 'loan-eligibility-report.pdf';
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
