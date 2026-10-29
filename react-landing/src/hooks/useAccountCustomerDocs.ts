import { useEffect, useRef, useState } from 'react';
import { loadAccountCustomerDocs, type CustomerDocState } from '../services/documentStore';

/**
 * The signed-in customer's booking state, scoped to their account (a cached
 * Aadhaar verification from another or unknown account is dropped). Loads once
 * on mount and again only if the account changes.
 */
export function useAccountCustomerDocs(email: string, ownerId: string | null | undefined) {
  const [docs, setDocs] = useState<CustomerDocState>(() => loadAccountCustomerDocs(email, ownerId));
  const loadedFor = useRef(`${email}\u0000${ownerId ?? ''}`);

  useEffect(() => {
    const key = `${email}\u0000${ownerId ?? ''}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setDocs(loadAccountCustomerDocs(email, ownerId));
  }, [email, ownerId]);

  return [docs, setDocs] as const;
}
