import { Reveal } from './Reveal';
import { deliveredRecords } from '../data/deliveredRecords';

export function DeliveredSection() {
  return (
    <section id="record" className="px-6 pt-8 pb-20 sm:px-10 sm:pt-10 sm:pb-28">
      <Reveal>
        <div className="eyebrow-label mb-3.5 text-terracotta">Handovers 2007 → 2017</div>
        <h2 className="font-display text-balance text-4xl font-bold text-ink sm:text-6xl">
          Five townships already lived in.
        </h2>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-5">
        {deliveredRecords.map((record) => (
          <Reveal
            key={`${record.name}-${record.location}`}
            className="bg-bg p-5.5 transition-colors hover:bg-surface"
          >
            <em className="eyebrow-label not-italic text-terracotta">{record.year}</em>
            <h4 className="mt-2.5 mb-1 text-[17px] font-semibold tracking-tight text-ink">
              {record.name}
            </h4>
            <span className="text-[12.5px] text-ink-muted">{record.location}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
