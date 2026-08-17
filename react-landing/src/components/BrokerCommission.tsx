import { useCallback, useEffect, useMemo, useState } from 'react';
import { townshipPricing } from '../data/townshipPricing';
import * as commissionsApi from '../services/commissionsApi';
import type { CommissionRecord, CommissionStatus, CommissionSummary } from '../services/commissionsApi';
import { ChartIcon, RupeeIcon } from './DashboardIcons';

interface BrokerCommissionProps {
  token: string;
  brokerId: string;
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

const statusLabel: Record<CommissionStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  rejected: 'Rejected',
};

type CommissionFilter = 'all' | CommissionStatus;

const filters: Array<{ value: CommissionFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function fallbackSummary(records: CommissionRecord[]): CommissionSummary {
  return records.reduce(
    (sum, record) => ({
      pending: sum.pending + (record.status === 'pending' ? record.commissionAmount : 0),
      paid: sum.paid + (record.status === 'paid' ? record.commissionAmount : 0),
      rejected: sum.rejected + (record.status === 'rejected' ? record.commissionAmount : 0),
    }),
    { pending: 0, paid: 0, rejected: 0 },
  );
}

export function BrokerCommission({ token, brokerId, onBack }: BrokerCommissionProps) {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({ pending: 0, paid: 0, rejected: 0 });
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState<CommissionFilter>('all');
  const [customerName, setCustomerName] = useState('');
  const [townshipId, setTownshipId] = useState(townshipPricing[0].id);
  const [serialNumber, setSerialNumber] = useState('');
  const [unitAddress, setUnitAddress] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [manualCommission, setManualCommission] = useState('');
  const township = townshipPricing.find((item) => item.id === townshipId) ?? townshipPricing[0];
  const numericSaleValue = Number(saleValue);
  const numericManualCommission = Number(manualCommission);
  const estimatedCommission = Number.isFinite(numericSaleValue) && numericSaleValue > 0 ? numericSaleValue * 0.01 : 0;
  const commissionAmount =
    Number.isFinite(numericManualCommission) && numericManualCommission > 0 ? numericManualCommission : estimatedCommission;

  const loadRecords = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (!token || !brokerId) {
        setLoading(false);
        setError('Please sign in again to load commission records.');
        return;
      }

      if (options.quiet) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const res = await commissionsApi.listBrokerCommissions(token, brokerId);
        setRecords(res.commissions);
        setSummary(res.summary ?? fallbackSummary(res.commissions));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load commission records.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [brokerId, token],
  );

  const refreshRecords = () => {
    setSuccessMessage('');
    void loadRecords({ quiet: true });
  };

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.createdAt.localeCompare(a.createdAt)),
    [records],
  );

  const visibleRecords = useMemo(
    () => (activeFilter === 'all' ? sortedRecords : sortedRecords.filter((record) => record.status === activeFilter)),
    [activeFilter, sortedRecords],
  );

  const addCashCommission = async () => {
    if (!serialNumber.trim() || !unitAddress.trim() || commissionAmount <= 0) return;
    if (!token || !brokerId) {
      setError('Please sign in again to add a commission record.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await commissionsApi.createBrokerCashCommission(token, {
        brokerId,
        serialNumber: serialNumber.trim(),
        unitAddress: unitAddress.trim(),
        customerName: customerName.trim() || undefined,
        township: township.label,
        saleValue: Number.isFinite(numericSaleValue) && numericSaleValue > 0 ? numericSaleValue : undefined,
        commissionAmount,
        transactionMode: 'cash',
      });
      // Show the new record immediately, then resync from the server so the
      // summary reflects the backend's authoritative totals rather than a
      // client-side re-derivation that can drift from it (e.g. rounding,
      // other commission types, or concurrent updates from another tab).
      setRecords((current) => [res.commission, ...current]);
      void loadRecords({ quiet: true });
      setSuccessMessage('Paid commission record added.');
      setCustomerName('');
      setSerialNumber('');
      setUnitAddress('');
      setSaleValue('');
      setManualCommission('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add commission record.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(serialNumber.trim() && unitAddress.trim() && commissionAmount > 0 && !isSubmitting);

  return (
    <section>
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

      {error ? <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {successMessage ? (
        <div className="mb-5 rounded-xl border border-green/15 bg-green/10 px-4 py-3 text-sm font-semibold text-green">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
        <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)]">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green/10 text-green">
              <RupeeIcon />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Add cash commission</h3>
              <p className="mt-1 text-sm leading-[1.6] text-ink-muted">Add a paid cash commission record for the sold unit.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Customer name (optional)"
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
              value={serialNumber}
              onChange={(event) => setSerialNumber(event.target.value)}
              placeholder="Serial number"
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <textarea
              value={unitAddress}
              onChange={(event) => setUnitAddress(event.target.value)}
              placeholder="Address of unit sold"
              rows={3}
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <input
              type="number"
              min={0}
              value={saleValue}
              onChange={(event) => setSaleValue(event.target.value)}
              placeholder="Sold value (optional, auto-calculates 1%)"
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <input
              type="number"
              min={0}
              value={manualCommission}
              onChange={(event) => setManualCommission(event.target.value)}
              placeholder="Commission price"
              className="rounded-lg border border-hairline bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-green"
            />
            <div className="rounded-xl border border-hairline bg-bg px-4 py-3">
              <p className="text-xs font-semibold uppercase text-ink-muted">Commission amount</p>
              <p className="mt-1 font-display text-2xl font-bold text-green">{formatCurrency(commissionAmount)}</p>
              <p className="mt-1 text-xs text-ink-muted">New records are saved as paid and cannot be edited after adding.</p>
            </div>
            <button
              type="button"
              onClick={addCashCommission}
              disabled={!canSubmit}
              className="self-start rounded-full bg-green px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Adding...' : 'Add commission'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-chrome/10 text-chrome">
                <ChartIcon />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Commission summary</h3>
                <p className="mt-1 text-sm leading-[1.6] text-ink-muted">Commission records appear by pending, paid, and rejected status.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshRecords}
              disabled={isLoading || isRefreshing}
              className="self-start rounded-full border border-hairline bg-bg px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-bg px-3 py-3">
              <p className="text-[11px] font-semibold uppercase text-terracotta">Pending</p>
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(summary.pending)}</p>
            </div>
            <div className="rounded-xl bg-bg px-3 py-3">
              <p className="text-[11px] font-semibold uppercase text-green">Paid</p>
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(summary.paid)}</p>
            </div>
            <div className="rounded-xl bg-bg px-3 py-3">
              <p className="text-[11px] font-semibold uppercase text-red-700">Rejected</p>
              <p className="mt-1 text-sm font-bold text-ink">{formatCurrency(summary.rejected)}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeFilter === filter.value
                    ? 'border-green bg-green text-white'
                    : 'border-hairline bg-bg text-ink-muted hover:text-ink'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-5 max-h-96 overflow-y-auto rounded-xl border border-hairline">
            {isLoading ? (
              <div className="bg-bg px-4 py-6 text-sm text-ink-muted">Loading commission records...</div>
            ) : visibleRecords.length > 0 ? (
              visibleRecords.map((record, i) => (
                <div key={record.id} className={`bg-bg px-4 py-3 ${i > 0 ? 'border-t border-hairline' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">Serial {record.serialNumber}</p>
                      <p className="truncate text-xs text-ink-muted">{record.unitAddress}</p>
                      {record.customerName ? <p className="mt-0.5 truncate text-xs text-ink-muted">Customer: {record.customerName}</p> : null}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusClass[record.status]}`}>
                      {statusLabel[record.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-ink-muted">Mode</p>
                      <p className="mt-0.5 font-bold capitalize text-ink">{record.transactionMode}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink-muted">Commission price</p>
                      <p className="mt-0.5 font-bold text-green">{formatCurrency(record.commissionAmount)}</p>
                    </div>
                  </div>
                  {record.paidAt || record.rejectedAt ? (
                    <p className="mt-3 text-xs text-ink-muted">
                      {record.paidAt ? `Paid on ${new Date(record.paidAt).toLocaleDateString('en-IN')}` : null}
                      {record.rejectedAt ? `Rejected on ${new Date(record.rejectedAt).toLocaleDateString('en-IN')}` : null}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center bg-bg px-4 py-8 text-center text-sm text-ink-muted">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green/10 text-green">
                  <ChartIcon />
                </span>
                <p className="mt-3 font-semibold text-ink">
                  {activeFilter === 'all' ? 'No commission records yet' : `No ${statusLabel[activeFilter].toLowerCase()} records`}
                </p>
                <p className="mt-1 max-w-[28ch]">
                  {activeFilter === 'all' ? 'Add a paid cash commission to start tracking payouts.' : 'Try another status filter.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
