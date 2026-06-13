import { SectionLabel } from "@/components/ui/section-label";
import { Badge } from "@/components/ui/badge";

export function LandingCascade() {
  const stages = [
    {
      num: "01",
      title: "GLiNER2 extraction",
      role: "Extraction agent",
      tagline: "Read the page. Label the deal.",
      bullets: [
        "Buyer, project, deadline, budget, contact.",
        "Nine procurement clue tags including deadline_near, budget_approved, login_required.",
        "Fine-tuned on 1,200+ synthetic DACH / EU examples with span-level supervision.",
      ],
      meta: "fine-tuned on synthetic DACH examples",
      tone: "good" as const,
    },
    {
      num: "02",
      title: "Gemma 4 routing",
      role: "Scoring router",
      tagline: "Score 0–100. Route in four buckets.",
      bullets: [
        "Suppression of low-signal, duplicate, expired, and irrelevant findings.",
        "Urgency, route, and rationale as a single structured call.",
        "Cost-aware: cheap model, no Gemini burn on noise.",
      ],
      meta: "Pioneer Gemma 4 · 8B",
      tone: "accent" as const,
    },
    {
      num: "03",
      title: "Gemini reasoning",
      role: "Reasoning agent",
      tagline: "Only when a human can move.",
      bullets: [
        "Called only on high-value, high-urgency, or human-review findings.",
        "Returns summary, risks, recommended next steps, and any blocker.",
        "Failure here is acceptable; the cascade gates the spend.",
      ],
      meta: "Gemini 2.5 · gated",
      tone: "signal" as const,
    },
  ];

  return (
    <section id="cascade" className="border-t border-rule bg-bg-deep py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionLabel size="lg">The cascade</SectionLabel>
            <h2 className="mt-4 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[52px]">
              Three models.
              <br />
              <em className="not-italic text-accent">One decision.</em>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.6] text-ink-2">
              Most AI products throw every page at the most expensive model. Bidderly does the
              opposite: a fast extractor reads the announcement, a small scorer routes it, and
              Gemini is only called when a human can actually move the deal forward.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-2 text-left">
              <div className="border-t border-rule-strong pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  Avg / finding
                </div>
                <div className="mt-1 font-display text-2xl tracking-display tnum">$0.004</div>
              </div>
              <div className="border-t border-rule-strong pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  Gemini calls
                </div>
                <div className="mt-1 font-display text-2xl tracking-display tnum">2 / 100</div>
              </div>
              <div className="border-t border-rule-strong pt-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                  Latency p50
                </div>
                <div className="mt-1 font-display text-2xl tracking-display tnum">0.41s</div>
              </div>
            </div>
          </div>

          <ol className="space-y-4">
            {stages.map((s, i) => (
              <li
                key={s.num}
                className="group relative grid gap-6 rounded-[var(--radius-lg)] border border-rule bg-bg-elev p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-7"
              >
                <div className="flex items-start gap-4 sm:flex-col sm:items-start">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
                    Stage {s.num}
                  </span>
                  <span
                    className="font-display text-[42px] leading-none tracking-display sm:text-[52px]"
                    style={{ fontVariationSettings: "'opsz' 144" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-2xl leading-none tracking-display sm:text-3xl">
                      {s.title}
                    </h3>
                    <Badge tone={s.tone} size="xs">
                      {s.role}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[15px] leading-snug text-ink-2">{s.tagline}</p>
                  <ul className="mt-4 space-y-2 text-[14px] text-ink-2">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="hidden items-start justify-end sm:flex">
                  <span className="rounded-full border border-rule bg-bg-sunk px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    {s.meta}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
