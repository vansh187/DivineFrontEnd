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
}

export type ModalMode = 'signin' | 'signup';

interface AuthContextValue {
  session: AuthSession | null;
  login: (role: Role, input: LoginInput) => Promise<void>;
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
      persist({
        token: res.access_token,
        role,
        userId: claims?.sub ?? '',
        email: input.email,
        firstName: null,
      });
    },
    [persist],
  );

  const signup = useCallback(
    async (role: Role, input: SignupInput) => {
      const profile = await authApi.signup(role, input);
      const res = await authApi.login(role, { email: input.email, password: input.password });
      const claims = authApi.decodeJwtClaims(res.access_token);
      persist({
        token: res.access_token,
        role,
        userId: claims?.sub ?? profile.id,
        email: input.email,
        firstName: profile.first_name,
      });
    },
    [persist],
  );

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
