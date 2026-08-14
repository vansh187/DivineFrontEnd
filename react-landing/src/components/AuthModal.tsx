import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/authApi';
import type { Role } from '../services/authApi';

function IconWrap({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const HomeIcon = () => (
  <IconWrap>
    <path d="M3 9.5 10 4l7 5.5M5 8v7.5a1 1 0 0 0 1 1h3v-4.5h2V16.5h3a1 1 0 0 0 1-1V8" />
  </IconWrap>
);
const BriefcaseIcon = () => (
  <IconWrap>
    <rect x="3" y="6.5" width="14" height="9.5" rx="1.4" />
    <path d="M7 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 13 5v1.5M3 11h14" />
  </IconWrap>
);
const MailIcon = () => (
  <IconWrap>
    <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
    <path d="m3.2 5.5 6.8 5.2 6.8-5.2" />
  </IconWrap>
);
const LockIcon = () => (
  <IconWrap>
    <rect x="4" y="9" width="12" height="8" rx="1.5" />
    <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" />
  </IconWrap>
);
const PhoneIcon = () => (
  <IconWrap>
    <path d="M5 3.5h2.3l1 3.6-1.7 1.4a9.5 9.5 0 0 0 4.9 4.9l1.4-1.7 3.6 1v2.3c0 .9-.8 1.6-1.7 1.5C8.9 15.9 4.1 11.1 3.5 5.2c-.1-.9.6-1.7 1.5-1.7Z" />
  </IconWrap>
);
const UserIcon = () => (
  <IconWrap>
    <circle cx="10" cy="6.8" r="3.3" />
    <path d="M3.5 16.5c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5" />
  </IconWrap>
);
const EyeIcon = () => (
  <IconWrap>
    <path d="M1.7 10S4.5 4.5 10 4.5 18.3 10 18.3 10 15.5 15.5 10 15.5 1.7 10 1.7 10Z" />
    <circle cx="10" cy="10" r="2.4" />
  </IconWrap>
);
const EyeOffIcon = () => (
  <IconWrap>
    <path d="M2.5 2.5l15 15M8.2 8.4a2.4 2.4 0 0 0 3.4 3.4M5.3 5.6C3.2 7 1.7 10 1.7 10s2.8 5.5 8.3 5.5c1.5 0 2.8-.4 3.9-1M11.9 4.9c-.6-.2-1.2-.3-1.9-.3C4.5 4.5 1.7 10 1.7 10c.4.8 1.2 2 2.4 3.1" />
  </IconWrap>
);
const CloseIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
    <path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const ROLES: { value: Role; label: string; Icon: () => ReactNode }[] = [
  { value: 'customer', label: 'Customer', Icon: HomeIcon },
  { value: 'broker', label: 'Broker', Icon: BriefcaseIcon },
];

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  optional?: boolean;
  trailing?: ReactNode;
}

function Field({ label, type, value, onChange, icon, autoComplete, required, minLength, optional, trailing }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink">
      <span>
        {label}
        {optional && <span className="text-ink-muted"> (optional)</span>}
      </span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted">{icon}</span>
        <input
          type={type}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-hairline bg-bg py-2.5 pl-10 pr-10 text-sm text-ink outline-none transition-all focus:border-green focus:ring-4 focus:ring-green/10"
        />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </label>
  );
}

export function AuthModal() {
  const { isModalOpen, modalMode, modalRole, closeModal, setModalMode, setModalRole, login, signup } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!isModalOpen) {
      setEntered(false);
      return;
    }
    document.body.style.overflow = 'hidden';
    emailInputRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [isModalOpen, closeModal]);

  useEffect(() => {
    if (!isModalOpen) {
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setShowPassword(false);
      setError(null);
      setSuccessMessage(null);
      setSubmitting(false);
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const isSignup = modalMode === 'signup';

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
      closeModal();
    }
  };

  const switchMode = (mode: 'signin' | 'signup') => {
    setModalMode(mode);
    setError(null);
    setSuccessMessage(null);
  };

  const switchRole = (role: Role) => {
    setModalRole(role);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignup) {
        await signup(modalRole, {
          email,
          password,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          phone: phone || undefined,
        });
        // Account created, but not signed in — send them to the sign-in screen
        // instead of straight to the dashboard, with the email carried over.
        setModalMode('signin');
        setPassword('');
        setSuccessMessage('Account created successfully. Sign in to continue.');
      } else {
        await login(modalRole, { email, password });
        closeModal();
        // Leaving "/" unmounts the hero/journey sections, which GSAP has pinned by
        // physically wrapping them in "pin-spacer" divs — React doesn't know about
        // that DOM restructuring. Killing every ScrollTrigger first undoes it and
        // restores the original DOM, so React's own unmount doesn't try to remove
        // a node from a parent GSAP has since replaced (a real crash otherwise).
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
        navigate(modalRole === 'broker' ? '/broker' : '/customer');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm transition-opacity duration-300 ${entered ? 'opacity-100' : 'opacity-0'}`}
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-heading"
        className={`relative grid w-full max-w-4xl overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[0_50px_140px_-30px_rgba(10,14,10,0.55)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:grid-cols-[1.05fr_1fr] ${
          entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.97] opacity-0'
        }`}
      >
        {/* Visual panel */}
        <div className="relative h-44 overflow-hidden sm:h-auto">
          <img
            src="/townships/suraksha-entrance.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,16,11,0.55)_0%,rgba(9,16,11,0.25)_45%,rgba(9,16,11,0.82)_100%)]" />

          <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-8">
            <div className="flex items-center gap-2.5">
              <img src="/brand/logo-icon.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
              <span className="font-display text-lg font-bold text-white">Divine Vision</span>
            </div>

            <div className="hidden sm:block">
              <p className="eyebrow-label text-terracotta-light">Est. 2005 · NH-1 corridor</p>
              <p className="mt-3 font-display text-[26px] font-bold leading-[1.25] text-white">
                Twenty years of townships people actually live in.
              </p>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-white/85">
                <span className="text-xs">
                  <strong className="font-display font-bold text-white">20</strong> yrs on the corridor
                </span>
                <span className="text-xs">
                  <strong className="font-display font-bold text-white">5</strong> townships delivered
                </span>
                <span className="text-xs">RERA &amp; DDJAY approved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="relative p-6 sm:p-9">
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <CloseIcon />
          </button>

          <div className="mb-5 inline-flex rounded-full border border-hairline bg-bg p-1">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => switchRole(role.value)}
                className={`eyebrow-label inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] transition-colors ${
                  modalRole === role.value ? 'bg-chrome text-white shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <role.Icon />
                {role.label}
              </button>
            ))}
          </div>

          <h2 id="auth-modal-heading" className="font-display text-[26px] font-bold leading-tight text-ink">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {isSignup
              ? `Sign up as a ${modalRole} to save your corridor shortlist.`
              : `Sign in as a ${modalRole} to pick up where you left off.`}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {isSignup && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" type="text" value={firstName} onChange={setFirstName} icon={<UserIcon />} autoComplete="given-name" />
                <Field label="Last name" type="text" value={lastName} onChange={setLastName} icon={<UserIcon />} autoComplete="family-name" />
              </div>
            )}

            <label className="flex flex-col gap-1.5 text-sm text-ink">
              Email
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted">
                  <MailIcon />
                </span>
                <input
                  ref={emailInputRef}
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="w-full rounded-xl border border-hairline bg-bg py-2.5 pl-10 pr-3.5 text-sm text-ink outline-none transition-all focus:border-green focus:ring-4 focus:ring-green/10"
                />
              </div>
            </label>

            {isSignup && (
              <Field label="Phone" type="tel" value={phone} onChange={setPhone} icon={<PhoneIcon />} autoComplete="tel" optional />
            )}

            <Field
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              icon={<LockIcon />}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={8}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  <span className="block h-4 w-4">{showPassword ? <EyeOffIcon /> : <EyeIcon />}</span>
                </button>
              }
            />

            {successMessage && (
              <p role="status" className="rounded-lg border border-green/25 bg-green/10 px-3.5 py-2.5 text-sm font-medium text-green">
                {successMessage}
              </p>
            )}

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 rounded-full bg-green px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-14px_rgba(56,142,60,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-soft hover:shadow-[0_20px_40px_-14px_rgba(56,142,60,0.75)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-muted">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => switchMode(isSignup ? 'signin' : 'signup')}
              className="font-semibold text-chrome hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
