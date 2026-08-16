import { useMemo, useState } from 'react';
import { townshipPricing } from '../data/townshipPricing';
import { ChartIcon, RupeeIcon } from './DashboardIcons';

type CommissionStatus = 'pending' | 'paid' | 'rejected';

interface CommissionRecord {
  id: string;
  customerName: string;
  township: string;
  unitSold: string;
  saleValue: number;
  commissionAmount: number;
  status: CommissionStatus;
  createdAt: string;
}

interface BrokerCommissionProps {
  email: string;
  onBack: () => void;
}

const statusOrder: Record<CommissionStatus, number> = {
  pending: 0,
  paid: 1,
  rejected: 2,
};

const statusClass: Record<CommissionStatus, string> = {
  pending: 'bg-terracotta/10 text-terracotta',
  paid: 'bg-green/10 text-green',
  rejected: 'bg-red-50 text-red-700',
};

function storageKey(email: string) {
  return `dvi_commissions_${email.toLowerCase()}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function loadCommissions(email: string): CommissionRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return [];
    return JSON.parse(raw) as CommissionRecord[];
  } catch {
    return [];
  }
}

function saveCommissions(email: string, records: CommissionRecord[]) {
  localStorage.setItem(storageKey(email), JSON.stringify(records));
}

export function BrokerCommission({ email, onBack }: BrokerCommissionProps) {
  const [records, setRecords] = useState<CommissionRecord[]>(() => loadCommissions(email));
  const [customerName, setCustomerName] = useState('');
  const [townshipId, setTownshipId] = useState(townshipPricing[0].id);
  const [unitSold, setUnitSold] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const township = townshipPricing.find((item) => item.id === townshipId) ?? townshipPricing[0];
  const numericSaleValue = Number(saleValue);
  const commissionAmount = Number.isFinite(numericSaleValue) && numericSaleValue > 0 ? numericSaleValue * 0.01 : 0;

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.createdAt.localeCompare(a.createdAt)),
    [records],
  );

  const totals = useMemo(() => {
    return records.reduce(
      (sum, record) => ({
        pending: sum.pending + (record.status === 'pending' ? record.commissionAmount : 0),
        paid: sum.paid + (record.status === 'paid' ? record.commissionAmount : 0),
        rejected: sum.rejected + (record.status === 'rejected' ? record.commissionAmount : 0),
      }),
      { pending: 0, paid: 0, rejected: 0 },
    );
  }, [records]);

  const addPendingCommission = () => {
    if (!customerName.trim() || !unitSold.trim() || commissionAmount <= 0) return;
    const nextRecord: CommissionRecord = {
      id: `${Date.now()}`,
      customerName: customerName.trim(),
      township: township.label,
      unitSold: unitSold.trim(),
      saleValue: numericSaleValue,
      commissionAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [nextRecord, ...records];
    setRecords(nextRecords);
    saveCommissions(email, nextRecords);
    setCustomerName('');
    setUnitSold('');
    setSaleValue('');
  };

  return (
    <section className="mt-10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow-label text-terracotta">Broker commission</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Commission detail view</h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="self-start rounded-full border border-hairline bg-surface px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink sm:self-auto"
        >
          Back to broker workspace
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green/10 text-green">
              <RupeeIcon />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Commission calculator</h3>
              <p className="mt-1 text-sm leading-[1.6] text-ink-muted">Commission is calculated as 1% of the sold unit value.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer name"
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <select
              value={townshipId}
              onChange={(event) => setTownshipId(event.target.value)}
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            >
              {townshipPricing.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              value={unitSold}
              onChange={(event) => setUnitSold(event.target.value)}
              placeholder="Unit sold / plot number"
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <input
              type="number"
              min={0}
              value={saleValue}
              onChange={(event) => setSaleValue(event.target.value)}
              placeholder="Sold value"
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <div className="rounded-xl border border-hairline bg-bg px-4 py-3">
              <p className="text-xs font-semibold uppercase text-ink-muted">Broker commission</p>
              <p className="mt-1 font-display text-2xl font-bold text-green">{formatCurrency(commissionAmount)}</p>
            </div>
            <button
              type="button"
              onClick={addPendingCommission}
              disabled={!customerName.trim() || !unitSold.trim() || commissionAmount <= 0}
              className="self-start rounded-full bg-green px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add as pending
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chrome/10 text-chrome">
              <ChartIcon />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Commission summary</h3>
              <p className="mt-1 text-sm leading-[1.6] text-ink-muted">Records are ordered by pending, paid, then rejected status.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-bg px-3 py-3">
              <p className="text-[11px] font-semibold uppercase text-terracotta">Pending</p>
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(totals.pending)}</p>
            </div>
            <div className="rounded-xl bg-bg px-3 py-3">
              <p className="text-[11px] font-semibold uppercase text-green">Paid</p>
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(totals.paid)}</p>
            </div>
            <div className="rounded-xl bg-bg px-3 py-3">
              <p className="text-[11px] font-semibold uppercase text-red-700">Rejected</p>
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(totals.rejected)}</p>
            </div>
          </div>

          <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-hairline">
            {sortedRecords.length > 0 ? (
              sortedRecords.map((record, i) => (
                <div key={record.id} className={`bg-bg px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{record.customerName}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {record.unitSold} - {record.township}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusClass[record.status]}`}>
                      {record.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-ink-muted">Sold value</p>
                      <p className="mt-0.5 font-bold text-ink">{formatCurrency(record.saleValue)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink-muted">Commission</p>
                      <p className="mt-0.5 font-bold text-green">{formatCurrency(record.commissionAmount)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-bg px-4 py-6 text-sm text-ink-muted">No commission records yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
