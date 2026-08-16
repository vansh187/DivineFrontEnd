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

  const [formOpen, setFormOpen] = useState(() => docs.visits.length === 0);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [cancellingVisitId, setCancellingVisitId] = useState<string | null>(null);
  const [visitError, setVisitError] = useState<string | null>(null);

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
        const scheduledVisits = visits.filter((visit) => visit.status === 'scheduled').map(visitFromApi);
        persistVisits(scheduledVisits);
        setFormOpen(scheduledVisits.length === 0);
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
      persistVisits([visitFromApi(created), ...docs.visits]);
      setCustomerName('');
      setCustomerContact('');
      setDate('');
      setTime('');
      setNotes('');
      setFormOpen(false);
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
      persistVisits(docs.visits.filter((v) => v.id !== id));
      if (docs.visits.length === 1) setFormOpen(true);
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
          Book customer visits first; Aadhaar document upload stays below for broker verification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <TileShell
            icon={<CalendarIcon />}
            accent="terracotta"
            title="Schedule a site visit"
            description="Create and track customer appointments from the top of the broker workspace."
            statusLabel={loadingVisits ? 'Loading visits' : docs.visits.length ? `${docs.visits.length} upcoming` : 'No visits scheduled'}
            statusTone={docs.visits.length ? 'pending' : 'neutral'}
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,1.08fr)] lg:items-start">
              <div className="rounded-xl border border-hairline bg-bg p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{formOpen ? 'New visit details' : 'Ready to book another visit?'}</p>
                  {!formOpen && (
                    <button
                      type="button"
                      onClick={() => setFormOpen(true)}
                      className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
                    >
                      Schedule visit
                    </button>
                  )}
                </div>

                {formOpen && (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Customer name"
                        aria-label="Customer name"
                        maxLength={200}
                        className="min-w-0 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                      />
                      <input
                        value={customerContact}
                        onChange={(event) => setCustomerContact(event.target.value)}
                        placeholder="Phone or email"
                        aria-label="Customer phone or email"
                        maxLength={200}
                        className="min-w-0 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        aria-label="Visit date"
                        className="min-w-0 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                      />
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                        aria-label="Visit time"
                        className="min-w-0 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                      />
                    </div>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notes (optional)"
                      aria-label="Visit notes"
                      maxLength={1000}
                      rows={3}
                      className="rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={scheduleVisit}
                        disabled={savingVisit || !customerName.trim() || !date || !time}
                        className="rounded-full bg-green px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingVisit ? 'Saving...' : 'Save visit'}
                      </button>
                      {docs.visits.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormOpen(false)}
                          className="rounded-full border border-hairline bg-surface px-5 py-2.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {visitError && (
                  <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {visitError}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Upcoming visits</p>
                  {docs.visits.length > 0 && <p className="text-xs font-semibold text-terracotta">{docs.visits.length} total</p>}
                </div>

                {loadingVisits ? (
                  <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-6 text-sm text-ink-muted">
                    Loading saved visits...
                  </div>
                ) : docs.visits.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-hairline">
                    {docs.visits.map((visit, i) => (
                      <div
                        key={visit.id}
                        className={`grid gap-3 bg-surface px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center ${i > 0 ? 'border-t border-hairline' : ''}`}
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
                    No visits yet. Add the customer name, date, and time to create the first appointment.
                  </div>
                )}
              </div>
            </div>
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
      </div>
    </section>
  );
}
