import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { reserveInventoryUnit } from '../services/inventoryApi';
import type { InventoryUnit } from '../services/inventoryApi';
import { createVisit } from '../services/visitsApi';
import { saveReservationVisitor } from '../services/reservationVisitors';
import { ApiError } from '../services/authApi';
import { loadBrokerDocs } from '../services/documentStore';
import { matchApplicationProjectId } from '../data/applicationProjects';

interface ScheduleVisitModalProps {
  unit: InventoryUnit;
  onClose: () => void;
  onReserved: (unit: InventoryUnit) => void;
}

function todayInputValue() {
  const today = new Date();
  const offsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - offsetMs).toISOString().slice(0, 10);
}

function nowTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function ScheduleVisitModal({ unit, onClose, onReserved }: ScheduleVisitModalProps) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Same gate BrokerDocuments.tsx enforces before letting a broker schedule any
  // site visit - reserving inventory here creates a visit record too, so it
  // must not be a back door around that requirement.
  const aadhaarVerified = session ? loadBrokerDocs(session.email).aadhar.verified : false;

  const canSubmit = Boolean(name.trim() && phone.trim() && aadhaarVerified && !submitting);

  const handleSubmit = async () => {
    if (!session || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const reservedUnit = await reserveInventoryUnit(session.token, unit.id);

      // Best-effort - the reservation itself is already locked in above, so a
      // visit-log failure here shouldn't be reported as the action failing.
      try {
        await createVisit(session.token, {
          customer_name: name.trim(),
          customer_contact: phone.trim(),
          project: matchApplicationProjectId(unit.project_name),
          date: todayInputValue(),
          time: nowTimeValue(),
          notes: `Site visit for ${unit.project_name}${unit.unit_number ? ` · Plot ${unit.unit_number}` : ''}.${
            email.trim() ? ` Email: ${email.trim()}.` : ''
          }`,
        });
      } catch {
        /* non-blocking */
      }

      saveReservationVisitor(session.email, unit.id, { name: name.trim(), phone: phone.trim(), email: email.trim() });
      onReserved(reservedUnit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reserve this plot. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-[0_26px_60px_-24px_rgba(6,31,45,0.4)]">
        <p className="eyebrow-label text-terracotta">Schedule visit &amp; lock plot</p>
        <h3 className="mt-2 font-display text-lg font-bold text-ink">
          {unit.project_name}
          {unit.unit_number ? ` · Plot ${unit.unit_number}` : ''}
        </h3>
        <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">
          Add who is visiting this plot with you. Once confirmed, it locks exclusively to you for 3 days.
        </p>

        {!aadhaarVerified && (
          <p className="mt-3 rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink-muted">
            Verify your Aadhaar on the broker workspace first - reservations are locked until verification is complete.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Visitor name"
            aria-label="Visitor name"
            disabled={!aadhaarVerified || submitting}
            className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Visitor phone"
            aria-label="Visitor phone"
            disabled={!aadhaarVerified || submitting}
            className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Visitor email (optional)"
            aria-label="Visitor email"
            disabled={!aadhaarVerified || submitting}
            className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-full bg-green px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Locking plot...' : 'Confirm & lock plot'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-hairline px-4 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
