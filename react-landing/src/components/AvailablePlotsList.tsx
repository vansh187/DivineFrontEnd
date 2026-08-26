import { useEffect, useMemo, useState } from 'react';
import { searchInventory } from '../services/inventoryApi';
import type { InventoryUnit } from '../services/inventoryApi';
import { ApiError } from '../services/authApi';
import { contact } from '../data/contact';

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M5 3.5h2.3l1 3.6-1.7 1.4a9.5 9.5 0 0 0 4.9 4.9l1.4-1.7 3.6 1v2.3c0 .9-.8 1.6-1.7 1.5C8.9 15.9 4.1 11.1 3.5 5.2c-.1-.9.6-1.7 1.5-1.7Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="h-4 w-4">
      <path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.5-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3Z" />
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
    </svg>
  );
}

interface AvailablePlotsListProps {
  actionLabel: string;
  onAction: (unit: InventoryUnit) => void;
}

type SizeFilter = 'all' | '<100' | '100-150' | '150-200' | '200+';
type BlockFilter = 'all' | 'A' | 'B' | 'C';

const sizeFilters: Array<{ value: SizeFilter; label: string; min?: number; max?: number }> = [
  { value: 'all', label: 'All sizes' },
  { value: '<100', label: '<100 sq yd', max: 100 },
  { value: '100-150', label: '100-150 sq yd', min: 100, max: 150 },
  { value: '150-200', label: '150-200 sq yd', min: 150, max: 200 },
  { value: '200+', label: '200+ sq yd', min: 200 },
];

const blockFilters: Array<{ value: BlockFilter; label: string }> = [
  { value: 'all', label: 'All blocks' },
  { value: 'A', label: 'Block A' },
  { value: 'B', label: 'Block B' },
  { value: 'C', label: 'Block C' },
];

function titleCase(value: string | null | undefined) {
  if (!value) return 'Plot';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Price on request';
  if (value >= 1_00_00_000) return `Rs ${(value / 1_00_00_000).toFixed(2)} Cr`;
  if (value >= 1_00_000) return `Rs ${(value / 1_00_000).toFixed(1)}L`;
  return `Rs ${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function plotLocation(unit: InventoryUnit) {
  return [unit.locality, unit.city].filter(Boolean).join(', ') || 'Location on request';
}

function whatsappHref(unit: InventoryUnit) {
  const phoneNumber = contact.phoneHref.replace('tel:', '').replace(/\D/g, '');
  const label = [unit.project_name, unit.unit_number ? `Plot ${unit.unit_number}` : null].filter(Boolean).join(' · ');
  const message = `Hi Divine Vision Infra, I'm interested in ${label || 'this plot'}. Could you share more details?`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export function AvailablePlotsList({ actionLabel, onAction }: AvailablePlotsListProps) {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [blockFilter, setBlockFilter] = useState<BlockFilter>('all');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    searchInventory({ status: 'available', limit: 100 })
      .then((res) => {
        if (!active) return;
        setUnits(res.units.filter((unit) => (unit.status ?? '').toLowerCase() === 'available'));
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : 'Could not load available plots.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeSizeFilter = sizeFilters.find((filter) => filter.value === sizeFilter);

  const filteredUnits = useMemo(
    () =>
      units.filter((unit) => {
        if (activeSizeFilter && (activeSizeFilter.min !== undefined || activeSizeFilter.max !== undefined)) {
          if (unit.area_sqyd === null) return false;
          if (activeSizeFilter.min !== undefined && unit.area_sqyd < activeSizeFilter.min) return false;
          if (activeSizeFilter.max !== undefined && unit.area_sqyd >= activeSizeFilter.max) return false;
        }
        if (blockFilter !== 'all' && (unit.block ?? '').trim().toUpperCase() !== blockFilter) return false;
        return true;
      }),
    [units, activeSizeFilter, blockFilter],
  );

  const filters = (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {sizeFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setSizeFilter(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              sizeFilter === filter.value
                ? 'border-green bg-green text-white'
                : 'border-hairline bg-surface text-ink-muted hover:border-terracotta hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {blockFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setBlockFilter(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              blockFilter === filter.value
                ? 'border-green bg-green text-white'
                : 'border-hairline bg-surface text-ink-muted hover:border-terracotta hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface px-4 py-8 text-center text-sm text-ink-muted">
        Loading available plots...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }

  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface px-4 py-8 text-center text-sm text-ink-muted">
        No plots are currently available. Check back soon.
      </div>
    );
  }

  return (
    <div>
      {filters}
      {filteredUnits.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface px-4 py-8 text-center text-sm text-ink-muted">
          No plots match those filters. Try a different size or block.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="rounded-2xl border border-hairline bg-surface p-5 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{unit.project_name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Plot {unit.unit_number ?? '—'}
                    {unit.block ? ` · Block ${unit.block}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  Available
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="font-semibold text-ink-muted">Size</p>
                  <p className="mt-0.5 font-bold text-ink">{unit.area_sqyd !== null ? `${unit.area_sqyd} sq yd` : '—'}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink-muted">Type</p>
                  <p className="mt-0.5 font-bold text-ink">{titleCase(unit.unit_type)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-muted">{plotLocation(unit)}</p>
              <p className="mt-2 text-sm font-bold text-green">{formatPrice(unit.estimated_price)}</p>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={contact.phoneHref}
                  aria-label={`Call about ${unit.project_name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-bg text-ink transition-colors hover:border-terracotta hover:text-terracotta"
                >
                  <PhoneIcon />
                </a>
                <a
                  href={whatsappHref(unit)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`WhatsApp about ${unit.project_name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-green text-white transition-colors hover:bg-green-soft"
                >
                  <WhatsAppIcon />
                </a>
              </div>
              <button
                type="button"
                onClick={() => onAction(unit)}
                className="mt-4 w-full rounded-full bg-green px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
              >
                {actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
