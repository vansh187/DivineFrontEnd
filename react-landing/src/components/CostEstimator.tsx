import { useState } from 'react';
import { townshipPricing } from '../data/townshipPricing';
import { contact } from '../data/contact';

const DOWN_PAYMENT_MIN = 10;
const DOWN_PAYMENT_MAX = 50;
const TENURE_MIN = 12;
const TENURE_MAX = 60;

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function sliderFill(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return {
    background: `linear-gradient(to right, var(--color-green) ${pct}%, var(--color-hairline) ${pct}%)`,
  };
}

export function CostEstimator() {
  const [townshipId, setTownshipId] = useState(townshipPricing[0].id);
  const township = townshipPricing.find((t) => t.id === townshipId) ?? townshipPricing[0];

  const [plotSize, setPlotSize] = useState(township.minSqYd + 25);
  const [downPayment, setDownPayment] = useState(20);
  const [tenure, setTenure] = useState(36);

  const selectTownship = (id: string) => {
    const next = townshipPricing.find((t) => t.id === id);
    if (!next) return;
    setTownshipId(id);
    setPlotSize((current) => Math.min(Math.max(current, next.minSqYd), next.maxSqYd));
  };

  const total = plotSize * township.ratePerSqYd;
  const booking = Math.round((total * downPayment) / 100);
  const balance = total - booking;
  const monthly = Math.round(balance / tenure);

  return (
    <section id="estimator" className="px-6 pt-20 pb-10 sm:px-10 sm:pt-28 sm:pb-14">
      <div className="eyebrow-label mb-3.5 text-terracotta">Plan your budget</div>
      <h2 className="font-display text-balance text-4xl font-bold text-ink sm:text-6xl">
        What a plot actually costs you.
      </h2>

      <div className="mt-10 grid grid-cols-1 overflow-hidden rounded-2xl border border-hairline shadow-[0_30px_80px_-40px_rgba(6,31,45,0.32)] lg:grid-cols-2">
        {/* Inputs */}
        <div className="bg-surface p-7 sm:p-9">
          <div className="eyebrow-label mb-3 text-ink-muted">Township</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {townshipPricing.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTownship(t.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                  t.id === townshipId
                    ? 'border-green bg-green/5 text-green'
                    : 'border-hairline text-ink hover:border-ink-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-between">
            <span className="eyebrow-label text-ink-muted">Plot size</span>
            <span className="text-sm font-semibold text-ink">{plotSize} sq yd</span>
          </div>
          <input
            type="range"
            className="brand-slider mt-3"
            min={township.minSqYd}
            max={township.maxSqYd}
            step={5}
            value={plotSize}
            onChange={(event) => setPlotSize(Number(event.target.value))}
            style={sliderFill(plotSize, township.minSqYd, township.maxSqYd)}
            aria-label="Plot size in square yards"
          />

          <div className="mt-6 flex items-center justify-between">
            <span className="eyebrow-label text-ink-muted">Down payment</span>
            <span className="text-sm font-semibold text-ink">{downPayment}%</span>
          </div>
          <input
            type="range"
            className="brand-slider mt-3"
            min={DOWN_PAYMENT_MIN}
            max={DOWN_PAYMENT_MAX}
            step={5}
            value={downPayment}
            onChange={(event) => setDownPayment(Number(event.target.value))}
            style={sliderFill(downPayment, DOWN_PAYMENT_MIN, DOWN_PAYMENT_MAX)}
            aria-label="Down payment percentage"
          />

          <div className="mt-6 flex items-center justify-between">
            <span className="eyebrow-label text-ink-muted">Balance tenure</span>
            <span className="text-sm font-semibold text-ink">{tenure} months</span>
          </div>
          <input
            type="range"
            className="brand-slider mt-3"
            min={TENURE_MIN}
            max={TENURE_MAX}
            step={6}
            value={tenure}
            onChange={(event) => setTenure(Number(event.target.value))}
            style={sliderFill(tenure, TENURE_MIN, TENURE_MAX)}
            aria-label="Balance payment tenure in months"
          />
        </div>

        {/* Result */}
        <div className="flex flex-col justify-between bg-chrome p-7 text-white sm:p-9">
          <div>
            <p className="eyebrow-label text-terracotta-light">Indicative total</p>
            <p className="mt-2 font-display text-[clamp(34px,4.5vw,52px)] font-bold leading-none text-white">
              {currency.format(total)}
            </p>
            <p className="mt-2 text-sm text-white/60">
              {currency.format(township.ratePerSqYd)} per sq yd
            </p>

            <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-white/70">Booking amount</span>
                <span className="text-sm font-semibold text-white">{currency.format(booking)}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-white/70">Balance</span>
                <span className="text-sm font-semibold text-white">{currency.format(balance)}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-white/70">Monthly instalment</span>
                <span className="text-sm font-semibold text-white">{currency.format(monthly)}</span>
              </div>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-white/50">
              Indicative only. Registry, stamp duty and PLC extra. Final pricing confirmed by the sales desk.
            </p>
          </div>

          <a
            href={contact.phoneHref}
            className="mt-7 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-chrome transition-colors hover:bg-green hover:text-white"
          >
            Lock this quote
          </a>
        </div>
      </div>
    </section>
  );
}
