import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { ApiError } from '../../services/authApi';
import { contact } from '../../data/contact';
import {
  getInventoryRecommendations,
  recordInventoryView,
  searchInventory,
  searchInventoryNaturalLanguage,
} from '../../services/inventoryApi';
import type { InventorySearchFilters, InventoryUnit } from '../../services/inventoryApi';
import { PhoneIcon } from './icons/ChatIcons';

type SearchMode = 'choose' | 'describe' | 'guided' | 'detail';

interface PlotIntelligencePanelProps {
  sessionId: string | null;
  leadId: string | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
}

const cities = ['Sonipat', 'Ganaur', 'Karnal', 'Panipat'];
const unitTypes = ['plot', 'floor', 'flat', 'commercial'];
const areaRanges = [
  { label: '<100 sq yd', min: undefined, max: 100 },
  { label: '100-150 sq yd', min: 100, max: 150 },
  { label: '150-200 sq yd', min: 150, max: 200 },
  { label: '200+ sq yd', min: 200, max: undefined },
];
const budgetRanges = [
  { label: 'Under Rs 40L', max: 40_00_000 },
  { label: 'Rs 40L-75L', min: 40_00_000, max: 75_00_000 },
  { label: 'Rs 75L-1.5Cr', min: 75_00_000, max: 1_50_00_000 },
  { label: 'Rs 1.5Cr+', min: 1_50_00_000 },
];

function formatPrice(value: number | null) {
  if (value === null || value === undefined) return 'Price on request';
  if (value >= 1_00_00_000) return `Rs ${(value / 1_00_00_000).toFixed(2)} Cr`;
  if (value >= 1_00_000) return `Rs ${(value / 1_00_000).toFixed(1)}L`;
  return `Rs ${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function whatsappHref(unit?: InventoryUnit) {
  const phoneNumber = contact.phoneHref.replace('tel:', '').replace(/\D/g, '');
  const message = unit
    ? `Hi Divine Vision Infra, I want the price for ${unitTitle(unit)}.`
    : 'Hi Divine Vision Infra, I want to know more about your available properties.';
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

function titleCase(value: string | null | undefined) {
  if (!value) return 'Plot';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactNumber(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' ? value.toFixed(digits).replace(/\.?0+$/, '') : null;
}

function unitTitle(unit: InventoryUnit) {
  return [unit.project_name, unit.unit_number].filter(Boolean).join(' · ') || 'Available unit';
}

function unitSubtitle(unit: InventoryUnit) {
  const parts = [unit.block ? `Block ${unit.block}` : null, [unit.locality, unit.city].filter(Boolean).join(', ')]
    .filter(Boolean);
  return parts.join(' · ');
}

function parsedFilterChips(filters: Partial<InventorySearchFilters>) {
  const chips: string[] = [];
  if (filters.unit_type) chips.push(titleCase(filters.unit_type));
  if (filters.city) chips.push(filters.city);
  if (filters.min_area_sqyd || filters.max_area_sqyd) {
    chips.push(`${compactNumber(filters.min_area_sqyd, 0) ?? '0'}-${compactNumber(filters.max_area_sqyd, 0) ?? '+'} sq yd`);
  }
  if (filters.max_budget) chips.push(`Under ${formatPrice(filters.max_budget)}`);
  if (filters.min_budget) chips.push(`From ${formatPrice(filters.min_budget)}`);
  return chips;
}

function StatusBadge({ status }: { status: string | null }) {
  const normalized = (status ?? '').toLowerCase();
  const colors =
    normalized === 'available'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'held'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-hairline bg-bg text-ink-muted';
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${colors}`}>{titleCase(status)}</span>;
}

function UnitCard({ unit, onOpen, compact = false }: { unit: InventoryUnit; onOpen: (unit: InventoryUnit) => void; compact?: boolean }) {
  const isSold = (unit.status ?? '').toLowerCase() === 'sold';
  const priceOnRequest = unit.estimated_price === null || unit.estimated_price === undefined;
  return (
    <div className={`rounded-lg border border-hairline bg-surface p-3 ${isSold ? 'opacity-65' : ''}`}>
      <button
        type="button"
        disabled={isSold}
        onClick={() => onOpen(unit)}
        className="block w-full text-left transition-colors disabled:cursor-default"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{unitTitle(unit)}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{unitSubtitle(unit)}</p>
          </div>
          <StatusBadge status={unit.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-ink-muted">
          <span className="rounded-full bg-bg px-2 py-1">{titleCase(unit.unit_type)}</span>
          {unit.area_sqyd !== null && <span className="rounded-full bg-bg px-2 py-1">{compactNumber(unit.area_sqyd)} sq yd</span>}
          {!compact && unit.area_sqmt !== null && <span className="rounded-full bg-bg px-2 py-1">{compactNumber(unit.area_sqmt)} sq m</span>}
        </div>
        <p className="mt-3 text-sm font-bold text-terracotta">{formatPrice(unit.estimated_price)}</p>
      </button>
      {priceOnRequest && !isSold && (
        <ContactActions unit={unit} className="mt-3" />
      )}
    </div>
  );
}

function ContactActions({ unit, className = '' }: { unit?: InventoryUnit; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <a
        href={contact.phoneHref}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-xs font-bold text-ink transition-colors hover:border-terracotta hover:text-terracotta"
      >
        <PhoneIcon className="h-3.5 w-3.5" />
        Call
      </a>
      <a
        href={whatsappHref(unit)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-9 items-center justify-center rounded-lg bg-green px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-green-soft"
      >
        WhatsApp
      </a>
    </div>
  );
}

export function PlotIntelligencePanel({ sessionId, leadId, scrollRef, onBack }: PlotIntelligencePanelProps) {
  const [mode, setMode] = useState<SearchMode>('choose');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<InventorySearchFilters>({ unit_type: 'plot', limit: 20 });
  const [results, setResults] = useState<InventoryUnit[]>([]);
  const [parsedFilters, setParsedFilters] = useState<Partial<InventorySearchFilters> | null>(null);
  const [recommendations, setRecommendations] = useState<InventoryUnit[]>([]);
  const [similarById, setSimilarById] = useState<Record<string, InventoryUnit[]>>({});
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identity = useMemo(() => ({ lead_id: leadId || undefined, session_id: sessionId || undefined }), [leadId, sessionId]);

  const refreshRecommendations = useCallback(() => {
    if (!identity.lead_id && !identity.session_id) return;
    setIsRecommendationsLoading(true);
    getInventoryRecommendations({ ...identity, limit: 10 })
      .then((res) => {
        setRecommendations(res.best_fit ?? []);
        setSimilarById(res.similar_alternatives ?? {});
      })
      .catch(() => {
        setRecommendations([]);
      })
      .finally(() => setIsRecommendationsLoading(false));
  }, [identity]);

  useEffect(() => {
    refreshRecommendations();
  }, [refreshRecommendations]);

  const runGuidedSearch = async () => {
    setIsSearching(true);
    setError(null);
    setNotice(null);
    setParsedFilters(null);
    try {
      const res = await searchInventory({ ...filters, ...identity, limit: 20 });
      setResults(res.units ?? []);
      if (!res.units?.length) setNotice("No exact matches - here's what's closest.");
      refreshRecommendations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inventory search is unavailable right now.');
    } finally {
      setIsSearching(false);
    }
  };

  const runNaturalLanguageSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsSearching(true);
    setError(null);
    setNotice(null);
    try {
      const res = await searchInventoryNaturalLanguage({ query: trimmed, ...identity });
      setResults(res.units ?? []);
      setParsedFilters(res.parsed_filters ?? null);
      if (!res.units?.length) setNotice("No exact matches - here's what's closest.");
      refreshRecommendations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inventory search is unavailable right now.');
    } finally {
      setIsSearching(false);
    }
  };

  const openUnit = (unit: InventoryUnit) => {
    setSelectedUnit(unit);
    setMode('detail');
    void recordInventoryView(unit.id, identity).finally(refreshRecommendations);
  };

  const visibleResults = results.length ? results : notice ? recommendations : results;
  const similarUnits = selectedUnit ? (similarById[selectedUnit.id] ?? []) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex items-center gap-2 border-b border-hairline bg-surface px-4 py-3">
        <button
          type="button"
          onClick={mode === 'choose' ? onBack : () => setMode('choose')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-sm font-bold text-ink transition-colors hover:border-terracotta hover:text-terracotta"
          aria-label="Back"
        >
          ←
        </button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Find My Perfect Plot</p>
          <p className="text-xs text-ink-muted">Smart inventory matching</p>
        </div>
      </div>

      <div ref={scrollRef} className="themed-scrollbar flex-1 overflow-y-auto px-4 py-4">
        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-ink">How would you like to search?</p>
            <button
              type="button"
              onClick={() => setMode('describe')}
              className="w-full rounded-lg border border-hairline bg-surface p-3 text-left transition-colors hover:border-terracotta hover:bg-terracotta/8"
            >
              <span className="block text-sm font-bold text-ink">Describe it to me</span>
              <span className="mt-1 block text-xs text-ink-muted">Free-text search</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('guided')}
              className="w-full rounded-lg border border-hairline bg-surface p-3 text-left transition-colors hover:border-terracotta hover:bg-terracotta/8"
            >
              <span className="block text-sm font-bold text-ink">Guide me through it</span>
              <span className="mt-1 block text-xs text-ink-muted">Quick questions</span>
            </button>
          </div>
        )}

        {mode === 'describe' && (
          <div className="space-y-3">
            <label className="block text-sm font-bold text-ink" htmlFor="plot-query">
              Tell me what you are looking for
            </label>
            <textarea
              id="plot-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={3}
              placeholder="150 sq yd plot near NH-1 under 40 lakh"
              className="w-full resize-none rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-terracotta"
            />
            <button
              type="button"
              disabled={isSearching || !query.trim()}
              onClick={runNaturalLanguageSearch}
              className="w-full rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white transition-colors enabled:hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? 'Searching...' : 'Search inventory'}
            </button>
          </div>
        )}

        {mode === 'guided' && (
          <div className="space-y-4">
            <ChipGroup
              title="City"
              options={cities}
              selected={filters.city}
              onSelect={(city) => setFilters((current) => ({ ...current, city }))}
            />
            <ChipGroup
              title="Type"
              options={unitTypes}
              selected={filters.unit_type}
              formatLabel={titleCase}
              onSelect={(unit_type) => setFilters((current) => ({ ...current, unit_type }))}
            />
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Size range</p>
              <div className="flex flex-wrap gap-2">
                {areaRanges.map((range) => (
                  <button
                    type="button"
                    key={range.label}
                    onClick={() =>
                      setFilters((current) => ({ ...current, min_area_sqyd: range.min, max_area_sqyd: range.max }))
                    }
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                      filters.min_area_sqyd === range.min && filters.max_area_sqyd === range.max
                        ? 'border-green bg-green text-white'
                        : 'border-hairline bg-surface text-ink hover:border-terracotta'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-ink">Budget range</p>
              <div className="flex flex-wrap gap-2">
                {budgetRanges.map((range) => (
                  <button
                    type="button"
                    key={range.label}
                    onClick={() => setFilters((current) => ({ ...current, min_budget: range.min, max_budget: range.max }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                      filters.min_budget === range.min && filters.max_budget === range.max
                        ? 'border-green bg-green text-white'
                        : 'border-hairline bg-surface text-ink hover:border-terracotta'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, min_budget: undefined, max_budget: undefined }))}
                  className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-terracotta"
                >
                  Skip
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={isSearching}
              onClick={runGuidedSearch}
              className="w-full rounded-lg bg-green px-4 py-2.5 text-sm font-bold text-white transition-colors enabled:hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? 'Searching...' : 'Show matching plots'}
            </button>
          </div>
        )}

        {mode === 'detail' && selectedUnit && (
          <div className="space-y-4">
            <div className="rounded-lg border border-hairline bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-ink">{unitTitle(selectedUnit)}</p>
                  <p className="mt-1 text-sm text-ink-muted">{unitSubtitle(selectedUnit)}</p>
                </div>
                <StatusBadge status={selectedUnit.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Metric label="Type" value={titleCase(selectedUnit.unit_type)} />
                <Metric label="Area" value={`${compactNumber(selectedUnit.area_sqyd) ?? '-'} sq yd`} />
                <Metric label="Area" value={`${compactNumber(selectedUnit.area_sqmt) ?? '-'} sq m`} />
                <Metric label="Price" value={formatPrice(selectedUnit.estimated_price)} />
              </div>
              {(selectedUnit.estimated_price === null || selectedUnit.estimated_price === undefined) && (
                <ContactActions unit={selectedUnit} className="mt-4" />
              )}
            </div>
            {similarUnits.length > 0 && (
              <Section title="Similar to this plot">
                {similarUnits.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} onOpen={openUnit} compact />
                ))}
              </Section>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {parsedFilters && parsedFilterChips(parsedFilters).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-chrome px-2.5 py-1 text-[11px] font-bold text-white">Searching</span>
            {parsedFilterChips(parsedFilters).map((chip) => (
              <span key={chip} className="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-bold text-ink-muted">
                {chip}
              </span>
            ))}
          </div>
        )}

        {notice && <p className="mt-4 text-sm font-bold text-ink">{notice}</p>}

        {visibleResults.length > 0 && mode !== 'detail' && (
          <Section title="Matching plots">
            {visibleResults.map((unit) => (
              <UnitCard key={unit.id} unit={unit} onOpen={openUnit} />
            ))}
          </Section>
        )}

        {mode !== 'detail' && (recommendations.length > 0 || isRecommendationsLoading) && (
          <Section title="Recommended for you">
            {isRecommendationsLoading && recommendations.length === 0 ? (
              <p className="rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink-muted">Loading recommendations...</p>
            ) : (
              recommendations.map((unit) => <UnitCard key={unit.id} unit={unit} onOpen={openUnit} compact />)
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function ChipGroup({
  title,
  options,
  selected,
  formatLabel = (value) => value,
  onSelect,
}: {
  title: string;
  options: string[];
  selected?: string;
  formatLabel?: (value: string) => string;
  onSelect: (value: string | undefined) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-ink">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            onClick={() => onSelect(selected === option ? undefined : option)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              selected === option ? 'border-green bg-green text-white' : 'border-hairline bg-surface text-ink hover:border-terracotta'
            }`}
          >
            {formatLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-bold text-ink">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg p-2">
      <p className="text-[10px] font-bold uppercase text-ink-muted">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}
