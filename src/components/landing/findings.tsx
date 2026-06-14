import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";

const findings = [
  {
    title: "EU regional digital public services framework",
    source: "TED EU tenders",
    country: "EU",
    language: "EN",
    buyer: "European Regional Innovation Office",
    deadline: "24 Jun 2026",
    budget: "EUR 12.0M",
    score: 94,
    urgency: "high",
    route: "human_review",
    tags: ["official_tender", "deadline_near", "budget_approved"],
    quote: "Estimated value is EUR 12,000,000. Requests to participate close on 24 June 2026.",
  },
  {
    title: "Modernisierung der WLAN- und Firewall-Infrastruktur",
    source: "Munich council projects",
    country: "DE",
    language: "DE",
    buyer: "Landeshauptstadt München",
    deadline: "28 Jun 2026",
    budget: "EUR 2.4M",
    score: 88,
    urgency: "high",
    route: "human_review",
    tags: ["budget_approved", "supplier_call", "deadline_near", "login_required"],
    quote:
      "Der Bildungsausschuss hat ein Budget von 2,4 Mio. EUR freigegeben. Zugang erfordert Registrierung im Bieterportal.",
  },
  {
    title: "Solar roofs and monitoring for Berlin civic buildings",
    source: "Berlin energy announcements",
    country: "DE",
    language: "DE",
    buyer: "Senatsverwaltung Berlin",
    deadline: "03 Jul 2026",
    budget: "EUR 4.8M",
    score: 76,
    urgency: "medium",
    route: "qualify",
    tags: ["pre_announcement", "budget_approved", "event_notice"],
    quote:
      "Markterkundung für Photovoltaik-Dachanlagen und Energiemonitoring an 12 öffentlichen Gebäuden.",
  },
];

export function LandingFindings() {
  return (
    <section id="findings" className="border-t border-rule py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div>
            <SectionLabel size="lg">What the radar catches</SectionLabel>
            <h2 className="mt-4 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[52px]">
              Real signals.
              <br />
              <em className="not-italic text-accent">Real buyers.</em>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.6] text-ink-2">
              Three examples from the curated demo scout snapshot, scored and routed by the cascade.
              Duplicates, expired notices, and irrelevant posts are filtered out before they hit
              your inbox.
            </p>
          </div>

          <ul className="space-y-3">
            {findings.map((f, i) => (
              <li
                key={f.title}
                className="group relative grid gap-4 rounded-[var(--radius)] border border-rule bg-bg-elev p-5 transition-colors hover:border-rule-strong sm:grid-cols-[1fr_auto] sm:p-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    <span>{f.country}</span>
                    <span className="text-ink-faint">·</span>
                    <span>{f.language}</span>
                    <span className="text-ink-faint">·</span>
                    <span>{f.source}</span>
                    <span className="ml-2 text-ink-faint">{String(i + 1).padStart(2, "0")} / 06 demo</span>
                  </div>
                  <h3 className="mt-2 font-display text-[22px] leading-tight tracking-display">
                    {f.title}
                  </h3>
                  <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-3">
                    <span className="text-ink-2">“{f.quote}”</span>
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
                    <Detail label="Buyer" value={f.buyer} />
                    <Detail label="Deadline" value={f.deadline} mono />
                    <Detail label="Budget" value={f.budget} mono />
                    <Detail label="Route" value={f.route} mono />
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {f.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded border border-rule bg-bg-sunk px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <ScoreBlock score={f.score} urgency={f.urgency} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono text-[12px] tnum text-ink-2" : "mt-0.5 text-[12px] text-ink-2"}>
        {value}
      </dd>
    </div>
  );
}

function ScoreBlock({ score, urgency }: { score: number; urgency: string }) {
  const tone = score >= 80 ? "good" : score >= 60 ? "accent" : "warn";
  return (
    <div className="flex flex-row items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
      <div className="font-display text-[64px] leading-none tracking-display tnum">{score}</div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Badge tone={tone} size="sm" dot>
          {urgency}
        </Badge>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          / 100 worth
        </span>
      </div>
    </div>
  );
}
