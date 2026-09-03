import type { InventoryUnit } from './inventoryApi';

/** The plot a customer picked from "Available plots" and is booking, kept around
 * while they complete Aadhaar/PAN/photo uploads before the application form -
 * same localStorage-keyed-by-email pattern as savedTownships.ts. */

function storageKey(email: string) {
  return `dvi_pending_unit_${email.toLowerCase()}`;
}

export function loadPendingUnit(email: string): InventoryUnit | null {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return null;
    return JSON.parse(raw) as InventoryUnit;
  } catch {
    return null;
  }
}

export function savePendingUnit(email: string, unit: InventoryUnit) {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(unit));
  } catch {
    /* private-browsing / storage-disabled / quota exceeded */
  }
}

export function clearPendingUnit(email: string) {
  try {
    localStorage.removeItem(storageKey(email));
  } catch {
    /* private-browsing / storage-disabled */
  }
}
