import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/authApi';

/**
 * Buyers onboarded by the team (offline plot purchases) receive an emailed
 * temporary password. Until they replace it, the API refuses their token
 * everywhere except change-password, so this screen blocks the whole app
 * after such a login. The only ways out are setting a new password or
 * logging out.
 */
export function ForcePasswordChange() {
  const { session, changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session?.mustChangePassword) return null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (next.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (next === current) {
      setError('Choose a password different from the temporary one.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.detail === 'token_expired') {
        logout();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not update your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 px-4" role="dialog" aria-modal="true"
         aria-labelledby="force-password-title">
      <form onSubmit={onSubmit}
            className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-[0_26px_60px_-24px_rgba(6,31,45,0.4)]">
        <p className="eyebrow-label text-terracotta">Welcome</p>
        <h3 id="force-password-title" className="mt-2 font-display text-lg font-bold text-ink">Set your new password</h3>
        <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
          You signed in with the temporary password we emailed you. Please choose your own password to continue.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-semibold text-ink">Temporary password</span>
          <input type="password" autoComplete="current-password" value={current} disabled={busy}
                 onChange={(e) => setCurrent(e.target.value)} className={inputClass} required />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-ink">New password (min. 8 characters)</span>
          <input type="password" autoComplete="new-password" value={next} disabled={busy}
                 onChange={(e) => setNext(e.target.value)} className={inputClass} required minLength={8} />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-ink">Confirm new password</span>
          <input type="password" autoComplete="new-password" value={confirm} disabled={busy}
                 onChange={(e) => setConfirm(e.target.value)} className={inputClass} required minLength={8} />
        </label>

        {error && <p className="mt-3 text-sm text-terracotta" role="alert">{error}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => logout()} disabled={busy}
                  className="text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-60">
            Log out
          </button>
          <button type="submit" disabled={busy}
                  className="rounded-full bg-green px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </div>
      </form>
    </div>
  );
}
