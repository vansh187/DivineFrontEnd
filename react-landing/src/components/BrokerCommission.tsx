import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as commissionsApi from '../services/commissionsApi';
import type { CommissionRecord, CommissionStatus, CommissionSummary } from '../services/commissionsApi';
import { ChartIcon } from './DashboardIcons';
import { formatCurrencyINR } from '../utils/currency';

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

interface MonthlyCommissionPoint {
  key: string;
  label: string;
  total: number;
}

function buildMonthlySeries(records: CommissionRecord[]): MonthlyCommissionPoint[] {
  const totals = new Map<string, number>();
  records.forEach((record) => {
    const date = new Date(record.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    totals.set(key, (totals.get(key) ?? 0) + record.commissionAmount);
  });
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, total]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        key,
        label: new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        total,
      };
    });
}

// Rounds a chart's max value up to a clean 1/2/5-times-a-power-of-ten step so
// axis ticks read as round numbers instead of arbitrary fractions.
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const residual = value / magnitude;
  const step = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatCompactINR(value: number): string {
  if (value >= 1_00_00_000) return `Rs ${(value / 1_00_00_000).toFixed(value % 1_00_00_000 === 0 ? 0 : 1)}Cr`;
  if (value >= 1_00_000) return `Rs ${(value / 1_00_000).toFixed(value % 1_00_000 === 0 ? 0 : 1)}L`;
  if (value >= 1_000) return `Rs ${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return `Rs ${value}`;
}

function MonthlyCommissionChart({ data }: { data: MonthlyCommissionPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-hairline bg-bg text-sm text-ink-muted">
        No commission history yet to chart.
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const paddingLeft = 52;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 28;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const maxValue = niceMax(Math.max(...data.map((point) => point.total)));
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (maxValue / tickCount) * i);
  const barSlot = plotWidth / data.length;
  const barWidth = Math.min(24, barSlot * 0.55);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Commission value by month" className="w-full">
        {ticks.map((tick) => {
          const y = paddingTop + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="var(--color-hairline)" strokeWidth={1} />
              <text x={paddingLeft - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-ink-muted text-[10px] font-semibold">
                {formatCompactINR(tick)}
              </text>
            </g>
          );
        })}
        {data.map((point, i) => {
          const barHeight = maxValue > 0 ? (point.total / maxValue) * plotHeight : 0;
          const x = paddingLeft + i * barSlot + (barSlot - barWidth) / 2;
          const y = paddingTop + plotHeight - barHeight;
          const isHovered = hoverIndex === i;
          return (
            <g
              key={point.key}
              tabIndex={0}
              role="img"
              aria-label={`${point.label}: ${formatCurrencyINR(point.total)}`}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex((current) => (current === i ? null : current))}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex((current) => (current === i ? null : current))}
              className="cursor-default outline-none"
            >
              <rect x={x - 6} y={paddingTop} width={barWidth + 12} height={plotHeight} fill="transparent" />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={4}
                className={isHovered ? 'fill-terracotta' : 'fill-green'}
              />
              <text x={x + barWidth / 2} y={height - paddingBottom + 16} textAnchor="middle" className="fill-ink-muted text-[10px] font-semibold">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-hairline bg-surface px-3 py-2 text-xs shadow-[0_10px_24px_-14px_rgba(6,31,45,0.4)]"
          style={{
            left: `${((paddingLeft + hoverIndex * barSlot + barSlot / 2) / width) * 100}%`,
            top: `${(paddingTop / height) * 100}%`,
          }}
        >
          <p className="font-semibold text-ink-muted">{data[hoverIndex].label}</p>
          <p className="font-bold text-ink">{formatCurrencyINR(data[hoverIndex].total)}</p>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Commission value by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Commission value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.key}>
              <td>{point.label}</td>
              <td>{formatCurrencyINR(point.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BrokerCommission({ token, brokerId, onBack }: BrokerCommissionProps) {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [summary, setSummary] = useState<CommissionSummary>({ pending: 0, paid: 0, rejected: 0 });
  const [isLoading, setLoading] = useState(true);
  const [isRefreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<CommissionFilter>('all');

  // Guards against a slow in-flight request (e.g. from a stale token before
  // re-login) resolving after a newer one and overwriting fresher data.
  const loadRequestId = useRef(0);

  const loadRecords = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (!token || !brokerId) {
        setLoading(false);
        setError('Please sign in again to load commission records.');
        return;
      }

      const requestId = ++loadRequestId.current;
      if (options.quiet) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const res = await commissionsApi.listBrokerCommissions(token, brokerId);
        if (requestId !== loadRequestId.current) return;
        setRecords(res.commissions);
        setSummary(res.summary);
      } catch (err) {
        if (requestId !== loadRequestId.current) return;
        setError(err instanceof Error ? err.message : 'Could not load commission records.');
      } finally {
        if (requestId === loadRequestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [brokerId, token],
  );

  const refreshRecords = () => {
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

  const monthlySeries = useMemo(() => buildMonthlySeries(records), [records]);

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow-label text-terracotta">Broker commission</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Commission summary</h2>
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

      <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)]">
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
            <p className="mt-1 text-sm font-bold text-ink">{formatCurrencyINR(summary.pending)}</p>
          </div>
          <div className="rounded-xl bg-bg px-3 py-3">
            <p className="text-[11px] font-semibold uppercase text-green">Paid</p>
            <p className="mt-1 text-sm font-bold text-ink">{formatCurrencyINR(summary.paid)}</p>
          </div>
          <div className="rounded-xl bg-bg px-3 py-3">
            <p className="text-[11px] font-semibold uppercase text-red-700">Rejected</p>
            <p className="mt-1 text-sm font-bold text-ink">{formatCurrencyINR(summary.rejected)}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-sm font-bold text-ink">Commission by month</p>
          {isLoading ? (
            <div className="flex h-[220px] items-center justify-center rounded-xl border border-hairline bg-bg text-sm text-ink-muted">
              Loading chart...
            </div>
          ) : (
            <MonthlyCommissionChart data={monthlySeries} />
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
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
                    <p className="mt-0.5 font-bold text-green">{formatCurrencyINR(record.commissionAmount)}</p>
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
                {activeFilter === 'all' ? 'Commissions will appear here once they are recorded.' : 'Try another status filter.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
