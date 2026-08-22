import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as authApi from '../services/authApi';
import type { LoginInput, Role, SignupInput } from '../services/authApi';

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
  const all = readProfileNames();
  all[profileNameKey(email)] = { firstName, lastName };
  localStorage.setItem(PROFILE_NAMES_KEY, JSON.stringify(all));
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
  logout: () => void;
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

function readStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
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
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

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

  const logout = useCallback(() => persist(null), [persist]);

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
      logout,
      isModalOpen,
      modalMode,
      modalRole,
      openModal,
      closeModal,
      setModalMode,
      setModalRole,
    }),
    [session, login, signup, logout, isModalOpen, modalMode, modalRole, openModal, closeModal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
