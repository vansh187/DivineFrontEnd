import type { JourneyStop } from '../data/types';

interface JourneyPanelProps {
  stop: JourneyStop;
}

export function JourneyPanel({ stop }: JourneyPanelProps) {
  return (
    <div className="relative grid w-screen flex-none grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-20 sm:px-12 md:py-0">
        <div className="max-w-xl rounded-2xl border border-hairline bg-surface/85 p-7 shadow-[0_24px_60px_-32px_rgba(30,77,59,0.35)] backdrop-blur-sm sm:p-9">
          <div className="eyebrow-label mb-4 text-terracotta">{stop.eyebrow}</div>

          {stop.bigNumber && (
            <div className="font-display text-[clamp(52px,8vw,120px)] font-bold leading-[0.9] text-green">
              {stop.bigNumber.value}
              <small className="ml-1 align-super text-[0.32em] tracking-normal text-terracotta">
                {stop.bigNumber.unit}
              </small>
            </div>
          )}

          <h2 className="font-display text-balance text-[clamp(26px,4vw,52px)] font-bold leading-[1.15] text-ink">
            {stop.heading} <em className="text-green not-italic">{stop.headingEmphasis}</em>
          </h2>

          <p className="mt-4.5 max-w-[42ch] text-[15px] leading-[1.65] text-ink-muted">
            {stop.description}
          </p>

          {stop.chips && (
            <div className="mt-5.5 flex flex-wrap gap-2">
              {stop.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-hairline bg-bg px-3.5 py-2 text-[12.5px] font-medium text-ink/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative min-h-[36svh] overflow-hidden md:order-2 md:min-h-0">
        <img
          data-parallax-img
          src={stop.image.src}
          alt={stop.image.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/10 to-transparent" />
        <span className="eyebrow-label absolute right-3.5 top-3.5 rounded bg-bg/95 px-2.5 py-1.5 text-[9.5px] text-ink/80 shadow-sm">
          {stop.image.tag}
        </span>
      </div>
    </div>
  );
}
