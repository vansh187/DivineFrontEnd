/** Bookmarked townships for the "Saved townships" customer dashboard tile.
 * No backend for this yet, so it lives in localStorage keyed by email, same
 * pattern as documentStore.ts. */

function storageKey(email: string) {
  return `dvi_saved_townships_${email.toLowerCase()}`;
}

export function loadSavedTownships(email: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveTownships(email: string, ids: string[]) {
  localStorage.setItem(storageKey(email), JSON.stringify(ids));
}

export function isTownshipSaved(email: string, townshipId: string): boolean {
  return loadSavedTownships(email).includes(townshipId);
}

export function toggleSavedTownship(email: string, townshipId: string): string[] {
  const current = loadSavedTownships(email);
  const next = current.includes(townshipId) ? current.filter((id) => id !== townshipId) : [...current, townshipId];
  saveTownships(email, next);
  return next;
}
