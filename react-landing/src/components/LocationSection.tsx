import { useState } from 'react';
import { townshipLocations } from '../data/locationConnectivity';

const mapSrc = `https://www.google.com/maps?saddr=${encodeURIComponent(
  townshipLocations[0].mapQuery,
)}&daddr=${encodeURIComponent(townshipLocations[1].mapQuery)}&output=embed`;

export function LocationSection() {
  const [activeId, setActiveId] = useState(townshipLocations[0].id);
  const active = townshipLocations.find((t) => t.id === activeId) ?? townshipLocations[0];

  return (
    <section id="location" className="px-6 pt-10 pb-20 sm:px-10 sm:pt-14 sm:pb-28">
      <div className="eyebrow-label mb-3.5 text-terracotta">Location</div>
      <h2 className="font-display text-balance text-4xl font-bold text-ink sm:text-6xl">
        Everything nearby, mapped out.
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_30px_80px_-40px_rgba(6,31,45,0.2)]">
          <div className="flex border-b border-hairline">
            {townshipLocations.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveId(t.id)}
                className={`-mb-px flex-1 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${
                  t.id === activeId ? 'border-terracotta text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-7 sm:p-9">
            <p className="eyebrow-label text-ink-muted">{active.subtitle}</p>
            <div className="mt-5 divide-y divide-hairline border-t border-hairline">
              {active.connectivity.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3.5">
                  <span className="text-sm text-ink-muted">{item.label}</span>
                  <span className="font-display text-base font-semibold text-ink">{item.value}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-ink-muted/80">
              Drive times are estimates for reference only — confirm exact routes with the sales desk.
            </p>
          </div>
        </div>

        <div className="min-h-[360px] overflow-hidden rounded-2xl border border-hairline shadow-[0_30px_80px_-40px_rgba(6,31,45,0.2)]">
          <iframe
            title="Divine Vision township locations"
            src={mapSrc}
            className="h-full min-h-[360px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
