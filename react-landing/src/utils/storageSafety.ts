/**
 * Last-resort guard so a browser storage-quota failure can never surface as an
 * "Uncaught (in promise) QuotaExceededError" in production.
 *
 * Every `localStorage`/`sessionStorage` write in this app is already wrapped in
 * try/catch — nothing user-facing depends on client storage persisting. This
 * only neutralises quota errors that escape from somewhere we don't control
 * (a browser extension, a library, IndexedDB internals). It deliberately does
 * NOT swallow any other rejection, so real bugs still show up.
 */

function isQuotaError(value: unknown): boolean {
  if (value instanceof DOMException) {
    return (
      value.name === 'QuotaExceededError' ||
      value.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      value.code === 22 ||
      value.code === 1014
    );
  }
  return value instanceof Error && /quota.?exceeded/i.test(value.message);
}

export function installStorageSafetyNet() {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    if (isQuotaError(event.reason)) {
      event.preventDefault();
      if (import.meta.env.DEV) {
        console.warn('Suppressed storage quota rejection:', event.reason);
      }
    }
  });

  window.addEventListener('error', (event) => {
    if (isQuotaError(event.error)) {
      event.preventDefault();
    }
  });
}
