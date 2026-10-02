import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalPageLayoutProps {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  lastUpdated: string;
  sections: LegalSection[];
}

/**
 * Shared shell for Privacy Policy / Terms & Conditions: a sticky
 * table-of-contents on desktop (scrollspy-highlighted as the reader scrolls),
 * a stacked jump-menu on mobile, and consistently styled prose sections.
 * Deliberately plainer than the marketing pages — these read as documents,
 * not sales pages.
 */
export function LegalPageLayout({ eyebrow, title, intro, lastUpdated, sections }: LegalPageLayoutProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id);
  // IntersectionObserver only reports entries whose state *changed* in a given
  // callback, not every currently-visible heading - tracking the full
  // intersecting set here (rather than trusting entries[0]'s order) is what
  // lets each callback correctly pick the topmost one on screen.
  const intersectingIds = useRef(new Set<string>());

  useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersectingIds.current.add(entry.target.id);
          else intersectingIds.current.delete(entry.target.id);
        }
        const topmost = headings
          .filter((el) => intersectingIds.current.has(el.id))
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (topmost) setActiveId(topmost.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="bg-bg px-4 pb-20 pt-28 sm:px-10 sm:pt-32">
      <section className="mx-auto max-w-6xl">
        <p className="eyebrow-label text-terracotta">{eyebrow}</p>
        <h1 className="mt-3 font-display text-balance text-4xl font-bold leading-tight text-ink sm:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.8] text-ink-muted">{intro}</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted/70">
          Last updated: {lastUpdated}
        </p>
      </section>

      <section className="mx-auto mt-10 grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,2.28fr)]">
        <nav aria-label="Table of contents" className="hidden lg:block">
          <div className="sticky top-28 rounded-2xl border border-hairline bg-surface p-5">
            <p className="eyebrow-label mb-3 text-ink-muted">On this page</p>
            <ol className="flex flex-col gap-1 border-l border-hairline pl-4">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={`block py-1.5 text-[13px] leading-snug transition-colors ${
                      activeId === section.id ? 'font-semibold text-terracotta' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {index + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <details className="rounded-2xl border border-hairline bg-surface p-4 lg:hidden">
          <summary className="eyebrow-label cursor-pointer text-ink">Jump to a section</summary>
          <ol className="mt-3 flex flex-col gap-1">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block py-1.5 text-sm text-ink-muted hover:text-terracotta">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </details>

        <div className="flex flex-col gap-12">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-28">
              <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
                <span className="mr-2 text-terracotta">{index + 1}.</span>
                {section.heading}
              </h2>
              <div className="legal-prose mt-3 text-[15px] leading-[1.8] text-ink-muted">{section.body}</div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
