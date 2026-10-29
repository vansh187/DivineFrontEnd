import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as store from '../services/documentStore';
import { useAccountCustomerDocs } from './useAccountCustomerDocs';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let latest: store.CustomerDocState;

function Probe({ email, ownerId }: { email: string; ownerId: string | null }) {
  const [docs] = useAccountCustomerDocs(email, ownerId);
  latest = docs;
  return null;
}

function seedVerified(email: string, verifiedOwnerId: string) {
  const docs = store.loadCustomerDocs(email);
  store.saveCustomerDocs(email, {
    ...docs,
    aadhar: { ...docs.aadhar, verified: true, verificationId: 'ver-1', verifiedOwnerId },
  });
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useAccountCustomerDocs', () => {
  it('loads this account’s state once on mount', () => {
    seedVerified('a@example.com', 'user-a');
    const load = vi.spyOn(store, 'loadAccountCustomerDocs');
    act(() => root.render(<Probe email="a@example.com" ownerId="user-a" />));
    expect(latest.aadhar.verified).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('drops another account’s verification', () => {
    seedVerified('a@example.com', 'user-b');
    act(() => root.render(<Probe email="a@example.com" ownerId="user-a" />));
    expect(latest.aadhar.verified).toBe(false);
  });

  it('reloads when the signed-in account changes', () => {
    seedVerified('a@example.com', 'user-a');
    seedVerified('b@example.com', 'user-b');
    act(() => root.render(<Probe email="a@example.com" ownerId="user-a" />));
    expect(latest.aadhar.verifiedOwnerId).toBe('user-a');

    act(() => root.render(<Probe email="b@example.com" ownerId="user-b" />));
    expect(latest.aadhar.verifiedOwnerId).toBe('user-b');
  });

  it('applies account scoping once the session arrives after mount', () => {
    seedVerified('a@example.com', 'user-b');
    act(() => root.render(<Probe email="a@example.com" ownerId={null} />));
    expect(latest.aadhar.verified).toBe(true);

    act(() => root.render(<Probe email="a@example.com" ownerId="user-a" />));
    expect(latest.aadhar.verified).toBe(false);
  });
});
