import { SectionLabel } from "@/components/ui/section-label";

const sources = [
  {
    name: "Mock portal — TED EU",
    type: "Public portal",
    url: "mock-sites / ted-eu",
    cadence: "On scout run",
    coverage: "EU",
    findings: "demo",
  },
  {
    name: "Mock portal — Bund.de",
    type: "Public portal",
    url: "mock-sites / bund-de",
    cadence: "On scout run",
    coverage: "DE federal",
    findings: "demo",
  },
  {
    name: "Mock portal — Munich",
    type: "Council page",
    url: "mock-sites / stadt-muenchen",
    cadence: "On scout run",
    coverage: "Bavaria",
    findings: "demo",
  },
  {
    name: "Mock portal — Berlin",
    type: "Procurement page",
    url: "mock-sites / berlin-de",
    cadence: "On scout run",
    coverage: "Berlin",
    findings: "demo",
  },
  {
    name: "Tavily live search",
    type: "Enrichment",
    url: "api.tavily.com",
    cadence: "On scout run",
    coverage: "DE / EU",
    findings: "live",
  },
];

export function LandingSources() {
  return (
    <section className="border-t border-rule bg-bg-deep py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionLabel size="lg">Sources watched</SectionLabel>
            <h2 className="mt-3 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[52px]">
              Where the radar looks.
            </h2>
          </div>
          <p className="max-w-md text-[14px] leading-[1.6] text-ink-2">
            Live scout runs hit four mock tender portals (styled after TED EU, Bund.de, Munich,
            and Berlin) plus Tavily search/extract. The demo radar uses curated fixtures with the
            same cascade — no behind-the-login crawling.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[var(--radius)] border border-rule bg-bg-elev">
          <div className="hidden border-b border-rule bg-bg-sunk px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute sm:grid sm:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.8fr] sm:gap-6">
            <span>Source</span>
            <span>Type</span>
            <span>URL</span>
            <span>Cadence</span>
            <span className="text-right">Data</span>
          </div>
          <ul className="divide-y divide-rule">
            {sources.map((s) => (
              <li
                key={s.name}
                className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.8fr] sm:items-center sm:gap-6"
              >
                <div>
                  <div className="text-[14px] font-semibold">{s.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute sm:hidden">
                    {s.type} · {s.coverage}
                  </div>
                </div>
                <div className="hidden text-[13px] text-ink-2 sm:block">{s.type}</div>
                <div className="hidden truncate font-mono text-[12px] text-ink-3 sm:block">
                  {s.url}
                </div>
                <div className="hidden text-[13px] text-ink-2 sm:block">{s.cadence}</div>
                <div className="font-mono text-[12px] tnum text-ink-2 sm:text-right">{s.findings}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
