import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../services/authApi';
import type { LoginInput, Role, SignupInput } from '../services/authApi';
import { clearBrokerDocsCache, clearCustomerDocsCache } from '../services/documentStore';

export interface AuthSession {
  token: string;
  role: Role;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export type ModalMode = 'signin' | 'signup';

/** The email address must never stand in for the person's name in the UI — fall
 * back to their role instead. Long combined names are truncated so they can
 * never break the nav pill or a heading's layout. */
export function getDisplayName(session: AuthSession, maxLength = 22): string {
  const raw = [session.firstName, session.lastName].filter(Boolean).join(' ').trim()
    || (session.role === 'broker' ? 'Broker' : 'Customer');
  return raw.length > maxLength ? `${raw.slice(0, maxLength - 1)}…` : raw;
}

/** Login only returns a bearer token, not the profile — so the first/last name
 * captured at signup is cached locally per email and re-attached to the
 * session on login. Falls back to null (→ role-based display name) for
 * accounts created before this existed, or on a different device/browser. */
const PROFILE_NAMES_KEY = 'dvi_profile_names';

interface ProfileNameRecord {
  firstName: string | null;
  lastName: string | null;
}

function profileNameKey(email: string) {
  return email.trim().toLowerCase();
}

function readProfileNames(): Record<string, ProfileNameRecord> {
  try {
    const raw = localStorage.getItem(PROFILE_NAMES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProfileNameRecord>) : {};
  } catch {
    return {};
  }
}

function rememberProfileName(email: string, firstName: string | null, lastName: string | null) {
  if (!firstName && !lastName) return;
  try {
    const all = readProfileNames();
    all[profileNameKey(email)] = { firstName, lastName };
    localStorage.setItem(PROFILE_NAMES_KEY, JSON.stringify(all));
  } catch {
    // private-browsing / storage-disabled / quota exceeded - login just falls
    // back to the role-based display name. Never let a caching failure break
    // signup(), whose account was already created server-side.
  }
}

function lookupProfileName(email: string): ProfileNameRecord {
  return readProfileNames()[profileNameKey(email)] ?? { firstName: null, lastName: null };
}

interface AuthContextValue {
  session: AuthSession | null;
  login: (role: Role, input: LoginInput) => Promise<void>;
  /** Creates the account only — does not sign the visitor in. Call login()
   * afterwards once they've confirmed on the sign-in screen. */
  signup: (role: Role, input: SignupInput) => Promise<void>;
  /** Persist a session from a token issued outside the auth API (chat login). */
  applySession: (input: { token: string; role?: Role; email?: string }) => void;
  /** `clearDocsCache` also wipes the cached document uploads/booking-application
   * draft for this account from localStorage — only pass it for a deliberate,
   * user-initiated sign-out (the "Log out" menu action), never for an
   * involuntary 401/session-expired auto-logout, which would otherwise destroy
   * an in-progress, not-yet-submitted form the visitor never chose to abandon. */
  logout: (options?: { clearDocsCache?: boolean }) => void;
  isModalOpen: boolean;
  modalMode: ModalMode;
  modalRole: Role;
  openModal: (mode: ModalMode, role?: Role) => void;
  closeModal: () => void;
  setModalMode: (mode: ModalMode) => void;
  setModalRole: (role: Role) => void;
}

const STORAGE_KEY = 'dvi_auth_session';

const AuthContext = createContext<AuthContextValue | null>(null);

/** A JWT with no exp claim is treated as expired rather than eternal - a
 * malformed/undecodable token should never be trusted as a live session. */
function isTokenExpired(token: string): boolean {
  const exp = authApi.decodeJwtClaims(token)?.exp;
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as AuthSession;
    if (isTokenExpired(stored.token)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('signin');
  const [modalRole, setModalRole] = useState<Role>('customer');

  const persist = useCallback((next: AuthSession | null) => {
    setSession(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // private-browsing / storage-disabled / quota exceeded - the session still
      // lives in React state for this tab; it just won't survive a reload.
    }
  }, []);

  // A token that expires while the tab stays open (rather than being caught on
  // the next reload by readStoredSession) must still sign the visitor out -
  // otherwise a stale session can sit in memory showing the dashboard all day.
  useEffect(() => {
    if (!session) return;
    if (isTokenExpired(session.token)) {
      persist(null);
      return;
    }
    const id = window.setInterval(() => {
      if (isTokenExpired(session.token)) persist(null);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [session, persist]);

  const login = useCallback(
    async (role: Role, input: LoginInput) => {
      const res = await authApi.login(role, input);
      const claims = authApi.decodeJwtClaims(res.access_token);
      const { firstName, lastName } = lookupProfileName(input.email);
      persist({
        token: res.access_token,
        role,
        userId: claims?.sub ?? '',
        email: input.email,
        firstName,
        lastName,
      });
    },
    [persist],
  );

  const signup = useCallback(async (role: Role, input: SignupInput) => {
    await authApi.signup(role, input);
    rememberProfileName(input.email, input.first_name || null, input.last_name || null);
  }, []);

  /** Persist a session from a bearer token the backend already issued elsewhere
   * (e.g. the chat completes login on its own turn and hands back auth_token) —
   * no auth API round-trip. */
  const applySession = useCallback(
    (input: { token: string; role?: Role; email?: string }) => {
      const claims = authApi.decodeJwtClaims(input.token);
      const email = input.email ?? claims?.username ?? '';
      const { firstName, lastName } = email ? lookupProfileName(email) : { firstName: null, lastName: null };
      persist({
        token: input.token,
        role: input.role ?? claims?.role ?? 'customer',
        userId: claims?.sub ?? '',
        email,
        firstName,
        lastName,
      });
    },
    [persist],
  );

  // `clearDocsCache` also drops the cached Aadhaar/PAN/signature/cheque uploads,
  // generated PDF, and in-progress booking-application draft for this account so
  // they don't linger in localStorage on a shared/public device — only requested
  // for a deliberate sign-out, never an involuntary 401 auto-logout.
  const logout = useCallback(
    (options?: { clearDocsCache?: boolean }) => {
      if (options?.clearDocsCache && session) {
        if (session.role === 'broker') clearBrokerDocsCache(session.email);
        else clearCustomerDocsCache(session.email);
      }
      persist(null);
    },
    [persist, session],
  );

  const openModal = useCallback((mode: ModalMode, role: Role = 'customer') => {
    setModalMode(mode);
    setModalRole(role);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login,
      signup,
      applySession,
      logout,
      isModalOpen,
      modalMode,
      modalRole,
      openModal,
      closeModal,
      setModalMode,
      setModalRole,
    }),
    [session, login, signup, applySession, logout, isModalOpen, modalMode, modalRole, openModal, closeModal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
