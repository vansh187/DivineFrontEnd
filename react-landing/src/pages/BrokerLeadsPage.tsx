import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { listMyReservedUnits, markInventoryUnitSold, releaseInventoryUnit } from '../services/inventoryApi';
import type { InventoryUnit } from '../services/inventoryApi';
import { ApiError } from '../services/authApi';
import { getReservationVisitor, pruneReservationVisitors } from '../services/reservationVisitors';
import { RecordBookingPaymentModal } from '../components/RecordBookingPaymentModal';

function formatCountdown(reservedUntil: string | null | undefined): string {
  if (!reservedUntil) return 'Locked';
  const remainingMs = new Date(reservedUntil).getTime() - Date.now();
  if (remainingMs <= 0) return 'Expiring...';
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0) return `${days}d ${remHours}h left`;
  return `${remHours}h left`;
}

export function BrokerLeadsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [payingUnit, setPayingUnit] = useState<InventoryUnit | null>(null);

  // formatCountdown() reads Date.now() at render time - without this tick, a card
  // opened at 10:00 would keep showing "1h left" forever instead of counting down.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const load = () => {
    if (!session) return;
    setLoading(true);
    setError('');
    listMyReservedUnits(session.token)
      .then((res) => {
        setUnits(res.reservations);
        pruneReservationVisitors(session.email, res.reservations.map((unit) => unit.id));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your leads.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [session]);

  const handleMarkSold = async (unit: InventoryUnit) => {
    if (!session) return;
    setActioningId(unit.id);
    setError('');
    try {
      await markInventoryUnitSold(session.token, unit.id);
      setUnits((current) => current.filter((item) => item.id !== unit.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark this plot sold.');
    } finally {
      setActioningId(null);
    }
  };

  const handleBooked = (unit: InventoryUnit) => {
    setPayingUnit(null);
    setUnits((current) => current.filter((item) => item.id !== unit.id));
  };

  const handleRelease = async (unit: InventoryUnit) => {
    if (!session) return;
    setActioningId(unit.id);
    setError('');
    try {
      await releaseInventoryUnit(session.token, unit.id);
      setUnits((current) => current.filter((item) => item.id !== unit.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not release this plot.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <DashboardLayout heading={<>My leads</>} contentLayout="full">
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/broker/plots')}
          className="rounded-full border border-hairline bg-surface px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          Browse available plots
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {isLoading ? (
        <div className="rounded-2xl border border-hairline bg-surface px-4 py-8 text-center text-sm text-ink-muted">Loading your leads...</div>
      ) : units.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface px-4 py-8 text-center text-sm text-ink-muted">
          No plots reserved right now. Schedule a visit from Available Plots to lock one in for 3 days.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => {
            const visitor = session ? getReservationVisitor(session.email, unit.id) : null;
            return (
              <div key={unit.id} className="rounded-2xl border border-hairline bg-surface p-5 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{unit.project_name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Plot {unit.unit_number ?? '—'}
                      {unit.block ? ` · Block ${unit.block}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 text-[11px] font-bold text-terracotta">
                    {formatCountdown(unit.reserved_until)}
                  </span>
                </div>

                {visitor && (
                  <div className="mt-3 rounded-lg border border-hairline bg-bg px-3 py-2 text-xs">
                    <p className="font-semibold text-ink">{visitor.name}</p>
                    <p className="mt-0.5 text-ink-muted">{visitor.phone}</p>
                    {visitor.email && <p className="text-ink-muted">{visitor.email}</p>}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setPayingUnit(unit)}
                  disabled={actioningId === unit.id}
                  className="mt-4 w-full rounded-full bg-green px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Record booking payment
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkSold(unit)}
                    disabled={actioningId === unit.id}
                    className="flex-1 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark sold
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRelease(unit)}
                    disabled={actioningId === unit.id}
                    className="flex-1 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Release
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {payingUnit && (
        <RecordBookingPaymentModal
          unit={payingUnit}
          onClose={() => setPayingUnit(null)}
          onBooked={handleBooked}
        />
      )}
    </DashboardLayout>
  );
}
