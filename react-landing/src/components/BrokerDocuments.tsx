import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as store from '../services/documentStore';
import type { BrokerDocState, ScheduledVisit } from '../services/documentStore';
import { TileShell } from './DocumentTile';
import { AadhaarVerifyTile } from './AadhaarVerifyTile';
import { CalendarIcon } from './DashboardIcons';

export function BrokerDocuments() {
  const { session, logout, openModal } = useAuth();
  const email = session?.email ?? 'anonymous';

  const [docs, setDocs] = useState<BrokerDocState>(() => store.loadBrokerDocs(email));

  const persist = (next: BrokerDocState) => {
    setDocs(next);
    store.saveBrokerDocs(email, next);
  };

  const [formOpen, setFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  const scheduleVisit = () => {
    if (!customerName.trim() || !date || !time) return;
    const visit: ScheduledVisit = {
      id: `${Date.now()}`,
      customerName: customerName.trim(),
      customerContact: customerContact.trim(),
      date,
      time,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    persist({ ...docs, visits: [visit, ...docs.visits] });
    setCustomerName('');
    setCustomerContact('');
    setDate('');
    setTime('');
    setNotes('');
    setFormOpen(false);
  };

  const cancelVisit = (id: string) => {
    persist({ ...docs, visits: docs.visits.filter((v) => v.id !== id) });
  };

  return (
    <section className="mt-14">
      <p className="eyebrow-label text-terracotta">Documents &amp; scheduling</p>
      <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Aadhar upload &amp; site visits</h2>
      <p className="mt-2 max-w-[60ch] text-sm leading-[1.6] text-ink-muted">
        Verify your own Aadhaar with UIDAI and book site visits for your customers.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <AadhaarVerifyTile
          token={session?.token ?? ''}
          status={docs.aadhar}
          onChange={(next) => persist({ ...docs, aadhar: next })}
          onSessionExpired={() => {
            logout();
            openModal('signin', 'broker');
          }}
        />

        <TileShell
          icon={<CalendarIcon />}
          title="Schedule a visit"
          description="Book a site-visit appointment for one of your customers."
          statusLabel={docs.visits.length ? `${docs.visits.length} upcoming` : 'No visits scheduled'}
          statusTone={docs.visits.length ? 'pending' : 'neutral'}
        >
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green"
            >
              + Schedule a visit
            </button>
          ) : (
            <div className="flex flex-col gap-2.5">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Customer name"
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <input
                value={customerContact}
                onChange={(event) => setCustomerContact(event.target.value)}
                placeholder="Customer phone or email"
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
                />
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={scheduleVisit}
                  className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
                >
                  Schedule visit
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </TileShell>
      </div>

      {docs.visits.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-hairline">
          {docs.visits.map((visit, i) => (
            <div
              key={visit.id}
              className={`flex flex-wrap items-center justify-between gap-3 bg-surface px-5 py-4 ${i > 0 ? 'border-t border-hairline' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{visit.customerName}</p>
                <p className="truncate text-xs text-ink-muted">{visit.customerContact || 'No contact provided'}</p>
              </div>
              <div className="text-sm text-ink">
                {new Date(`${visit.date}T${visit.time}`).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <button type="button" onClick={() => cancelVisit(visit.id)} className="text-xs font-semibold text-terracotta hover:underline">
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
