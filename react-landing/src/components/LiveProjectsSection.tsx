import { useState } from 'react';
import { Link } from 'react-router-dom';
import { journeyStops } from '../data/journeyStops';
import { townshipLocations } from '../data/locationConnectivity';
import { getProjectDetail, type ProjectSpec } from '../data/projectDetails';

/** Ongoing, bookable townships — the ones with a RERA id and plot sizing. */
const liveProjects = journeyStops.filter(
  (stop) => stop.reraId && stop.chips?.some((chip) => chip.includes('sq yd')),
);

/** Connectivity / proximity specs are covered by the Location section further
 *  down the page, so they are stripped from the project spec grid here. */
const isProximitySpec = (spec: ProjectSpec) =>
  /nh-1|highway|delhi|border|station|airport|drive/i.test(spec.label);

function specsFor(id: string, reraId?: string): ProjectSpec[] {
  const detail = getProjectDetail(id);
  const specs = (detail?.specs ?? []).filter((spec) => !isProximitySpec(spec));
  return reraId ? [...specs, { label: 'RERA', value: reraId }] : specs;
}

function tabLabel(id: string, fallback: string) {
  const loc = townshipLocations.find((item) => item.id === id);
  if (!loc) return fallback;
  // subtitle is "Sector 16, Karnal · Bang on NH-1" — pull the town name out.
  const town = loc.subtitle.split('·')[0].split(',').pop()?.trim();
  return town ? `${loc.label} · ${town}` : loc.label;
}

export function LiveProjectsSection() {
  const [activeId, setActiveId] = useState(liveProjects[0]?.id ?? '');
  const active = liveProjects.find((p) => p.id === activeId) ?? liveProjects[0];

  if (!active) return null;

  const location = townshipLocations.find((loc) => loc.id === active.id);
  const specs = specsFor(active.id, active.reraId);
  const detailHref = `/residences/${active.id}`;

  return (
    <section id="live-projects" className="px-6 pt-10 pb-20 sm:px-10 sm:pt-14 sm:pb-28">
      <div className="eyebrow-label mb-3.5 text-terracotta">Now selling</div>
      <h2 className="font-display text-balance text-4xl font-bold text-ink sm:text-6xl">
        Two live townships on the corridor.
      </h2>

      <div className="mt-8 flex flex-wrap gap-x-8 gap-y-1 border-b border-hairline">
        {liveProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => setActiveId(project.id)}
            aria-pressed={project.id === activeId}
            className={`-mb-px border-b-2 pb-3 pt-1 text-left text-sm font-semibold transition-colors ${
              project.id === activeId
                ? 'border-terracotta text-ink'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tabLabel(project.id, `${project.heading} ${project.headingEmphasis}`)}
          </button>
        ))}
      </div>

      <Link
        to={detailHref}
        className="group mt-8 grid overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_30px_80px_-40px_rgba(6,31,45,0.2)] transition-shadow hover:shadow-[0_36px_90px_-40px_rgba(6,31,45,0.32)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]"
      >
        <div className="relative min-h-[260px] overflow-hidden lg:min-h-[440px]">
          <img
            src={active.heroSrc ?? active.image.src}
            alt={active.image.alt}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <span className="eyebrow-label absolute left-4 top-4 rounded bg-bg/95 px-2.5 py-1.5 text-[10px] text-ink/80 shadow-sm">
            {active.reraId ? `RERA: ${active.reraId}` : active.image.tag}
          </span>
        </div>

        <div className="flex flex-col p-7 sm:p-10">
          <p className="eyebrow-label text-terracotta">{location?.subtitle ?? active.eyebrow}</p>
          <h3 className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">
            {active.heading} <em className="not-italic text-green">{active.headingEmphasis}</em>
          </h3>
          <p className="mt-4 text-[15px] leading-[1.75] text-ink-muted">{active.description}</p>

          <dl className="mt-7 grid grid-cols-2 gap-px border border-hairline bg-hairline">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className={`bg-surface px-4 py-3.5 ${spec.label === 'RERA' ? 'col-span-2' : ''}`}
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                  {spec.label}
                </dt>
                <dd className="mt-0.5 font-display text-lg font-semibold text-ink">{spec.value}</dd>
              </div>
            ))}
          </dl>

          <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-ink underline underline-offset-4 transition-colors group-hover:text-terracotta">
            View project details
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </Link>
    </section>
  );
}
