import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as store from '../services/documentStore';
import type { BrokerDocState, ScheduledVisit } from '../services/documentStore';
import { createVisit, listVisits, cancelVisit as cancelVisitApi } from '../services/visitsApi';
import type { VisitRecord } from '../services/visitsApi';
import { ApiError } from '../services/authApi';
import { TileShell } from './DocumentTile';
import { AadhaarVerifyTile } from './AadhaarVerifyTile';
import { CalendarIcon } from './DashboardIcons';

function visitFromApi(visit: VisitRecord): ScheduledVisit {
  return {
    id: visit.id,
    customerName: visit.customer_name,
    customerContact: visit.customer_contact,
    date: visit.date,
    time: visit.time,
    notes: visit.notes,
    status: visit.status,
    createdAt: visit.created_date,
  };
}

function formatVisitDate(visit: ScheduledVisit) {
  return new Date(`${visit.date}T${visit.time}`).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function BrokerDocuments() {
  const { session, logout, openModal } = useAuth();
  const email = session?.email ?? 'anonymous';

  const [docs, setDocs] = useState<BrokerDocState>(() => store.loadBrokerDocs(email));

  const persist = (next: BrokerDocState) => {
    setDocs(next);
    store.saveBrokerDocs(email, next);
  };

  const persistVisits = useCallback((visits: ScheduledVisit[]) => {
    setDocs((prev) => {
      const next = { ...prev, visits };
      store.saveBrokerDocs(email, next);
      return next;
    });
  }, [email]);

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [cancellingVisitId, setCancellingVisitId] = useState<string | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);

  const aadhaarVerified = docs.aadhar.verified;
  const upcomingVisits = docs.visits.filter((visit) => visit.status === 'scheduled');

  const handleVisitError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        logout();
        openModal('signin', 'broker');
      }
      setVisitError(err.message);
    } else {
      setVisitError('Something went wrong with site visits. Please try again.');
    }
  }, [logout, openModal]);

  useEffect(() => {
    if (!session?.token) return;
    let active = true;
    setLoadingVisits(true);
    setVisitError(null);
    listVisits(session.token)
      .then((visits) => {
        if (!active) return;
        persistVisits(visits.filter((visit) => visit.status === 'scheduled').map(visitFromApi));
      })
      .catch((err) => {
        if (!active) return;
        handleVisitError(err);
      })
      .finally(() => {
        if (active) setLoadingVisits(false);
      });
    return () => {
      active = false;
    };
  }, [handleVisitError, persistVisits, session?.token]);

  const scheduleVisit = async () => {
    if (!session) return;
    if (!aadhaarVerified) {
      setVisitError('Verify your Aadhaar before scheduling a site visit.');
      return;
    }
    if (!customerName.trim() || !date || !time) return;
    setSavingVisit(true);
    setVisitError(null);
    try {
      const created = await createVisit(session.token, {
        customer_name: customerName.trim(),
        customer_contact: customerContact.trim() || undefined,
        date,
        time,
        notes: notes.trim() || undefined,
      });
      persistVisits([visitFromApi(created), ...upcomingVisits]);
      setCustomerName('');
      setCustomerContact('');
      setDate('');
      setTime('');
      setNotes('');
    } catch (err) {
      handleVisitError(err);
    } finally {
      setSavingVisit(false);
    }
  };

  const cancelVisit = async (id: string) => {
    if (!session) return;
    setCancellingVisitId(id);
    setVisitError(null);
    try {
      await cancelVisitApi(session.token, id);
      persistVisits(upcomingVisits.filter((visit) => visit.id !== id));
    } catch (err) {
      handleVisitError(err);
    } finally {
      setCancellingVisitId(null);
    }
  };

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow-label text-terracotta">Priority workflow</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Site visits &amp; broker documents</h2>
        </div>
        <p className="max-w-[38ch] text-sm leading-[1.6] text-ink-muted sm:text-right">
          Upcoming visits stay visible first. New scheduling unlocks after broker Aadhaar verification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <TileShell
            icon={<CalendarIcon />}
            accent="terracotta"
            title="Upcoming site visits"
            description="Scheduled customer appointments appear here as the first broker priority."
            statusLabel={loadingVisits ? 'Loading visits' : upcomingVisits.length ? `${upcomingVisits.length} scheduled` : 'No upcoming visits'}
            statusTone={upcomingVisits.length ? 'pending' : 'neutral'}
          >
            {loadingVisits ? (
              <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-6 text-sm text-ink-muted">
                Loading saved visits...
              </div>
            ) : upcomingVisits.length > 0 ? (
              <div className="max-h-80 overflow-y-auto rounded-xl border border-hairline">
                {upcomingVisits.map((visit, i) => (
                  <div
                    key={visit.id}
                    className={`grid gap-3 bg-bg px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center ${i > 0 ? 'border-t border-hairline' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{visit.customerName}</p>
                      <p className="truncate text-xs text-ink-muted">{visit.customerContact || 'No contact provided'}</p>
                      {visit.notes && <p className="mt-1 line-clamp-2 text-xs leading-[1.5] text-ink-muted">{visit.notes}</p>}
                    </div>
                    <p className="text-sm font-semibold text-ink sm:text-right">{formatVisitDate(visit)}</p>
                    <button
                      type="button"
                      onClick={() => cancelVisit(visit.id)}
                      disabled={cancellingVisitId === visit.id}
                      className="justify-self-start text-xs font-semibold text-terracotta hover:underline disabled:cursor-not-allowed disabled:opacity-60 sm:justify-self-end"
                    >
                      {cancellingVisitId === visit.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-6 text-sm text-ink-muted">
                No site visits are scheduled yet.
              </div>
            )}
            {visitError && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {visitError}
              </p>
            )}
          </TileShell>
        </div>

        <AadhaarVerifyTile
          token={session?.token ?? ''}
          status={docs.aadhar}
          onStatusChange={(next) => persist({ ...docs, aadhar: next })}
          frontStatus={docs.aadharFront}
          onFrontChange={(next) => persist({ ...docs, aadharFront: next })}
          backStatus={docs.aadharBack}
          onBackChange={(next) => persist({ ...docs, aadharBack: next })}
          onSessionExpired={() => {
            logout();
            openModal('signin', 'broker');
          }}
        />

        <TileShell
          icon={<CalendarIcon />}
          accent="green"
          title="Schedule a site visit"
          description="Book a new customer appointment after broker Aadhaar verification is complete."
          statusLabel={aadhaarVerified ? 'Ready to schedule' : 'Aadhaar verification required'}
          statusTone={aadhaarVerified ? 'done' : 'failed'}
        >
          {!aadhaarVerified && (
            <p className="mb-3 rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink-muted">
              Verify Aadhaar first. Brokers cannot book site visits until verification is complete.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                aria-label="Customer name"
                maxLength={200}
                disabled={!aadhaarVerified || savingVisit}
                className="min-w-0 rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
              <input
                value={customerContact}
                onChange={(event) => setCustomerContact(event.target.value)}
                placeholder="Phone or email"
                aria-label="Customer phone or email"
                maxLength={200}
                disabled={!aadhaarVerified || savingVisit}
                className="min-w-0 rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                aria-label="Visit date"
                disabled={!aadhaarVerified || savingVisit}
                className="min-w-0 rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                aria-label="Visit time"
                disabled={!aadhaarVerified || savingVisit}
                className="min-w-0 rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes (optional)"
              aria-label="Visit notes"
              maxLength={1000}
              rows={3}
              disabled={!aadhaarVerified || savingVisit}
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={scheduleVisit}
              disabled={!aadhaarVerified || savingVisit || !customerName.trim() || !date || !time}
              className="self-start rounded-full bg-green px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingVisit ? 'Saving...' : 'Save visit'}
            </button>
          </div>
        </TileShell>
      </div>
    </section>
  );
}
