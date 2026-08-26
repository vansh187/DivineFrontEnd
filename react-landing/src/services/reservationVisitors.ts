/** Visitor details (name/phone/email) captured when a broker reserves a plot for a
 * site visit. The reservation endpoint itself has no field for this, so it's kept
 * client-side, keyed by broker email + unit id - same localStorage pattern as
 * savedTownships.ts. Best-effort only: it won't follow the broker to another device,
 * and self-clears once a unit is no longer in that broker's reserved list. */

export interface ReservationVisitor {
  name: string;
  phone: string;
  email: string;
}

function storageKey(email: string) {
  return `dvi_reservation_visitors_${email.toLowerCase()}`;
}

function loadAll(email: string): Record<string, ReservationVisitor> {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ReservationVisitor>) : {};
  } catch {
    return {};
  }
}

function saveAll(email: string, visitors: Record<string, ReservationVisitor>) {
  localStorage.setItem(storageKey(email), JSON.stringify(visitors));
}

export function saveReservationVisitor(email: string, unitId: string, visitor: ReservationVisitor) {
  const all = loadAll(email);
  all[unitId] = visitor;
  saveAll(email, all);
}

export function getReservationVisitor(email: string, unitId: string): ReservationVisitor | null {
  return loadAll(email)[unitId] ?? null;
}

/** Drops entries for unit ids no longer in this broker's active reservations, so
 * stale visitor details from an expired/released/sold plot don't linger forever. */
export function pruneReservationVisitors(email: string, activeUnitIds: string[]) {
  const all = loadAll(email);
  const activeSet = new Set(activeUnitIds);
  const next: Record<string, ReservationVisitor> = {};
  Object.keys(all).forEach((unitId) => {
    if (activeSet.has(unitId)) next[unitId] = all[unitId];
  });
  saveAll(email, next);
}
