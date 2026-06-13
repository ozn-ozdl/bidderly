import Link from "next/link";
import { Sparkles } from "lucide-react";

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />
      <BackgroundOrnament />

      <div className="relative mx-auto grid max-w-[1320px] gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pb-32 lg:pt-32">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rule bg-bg-elev px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            cascade live · GLiNER2 → Gemma 4 → Gemini
          </div>

          <h1 className="mt-7 font-display text-[44px] font-normal leading-[1.02] tracking-display sm:text-[64px] lg:text-[76px]">
            Catch the right tender
            <br />
            <em className="text-accent not-italic" data-theme-keep>
              before the room does.
            </em>
          </h1>

          <p className="mt-7 max-w-[52ch] text-[17px] leading-[1.6] text-ink-2">
            Bidderly is a tender and procurement radar for DACH sales teams. Scout agents watch
            German and EU portals, score each finding through a cost-aware model cascade, and
            only interrupt you when a human decision actually moves the deal forward.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/radar"
              className="group inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-ink px-5 text-[14px] font-semibold text-bg shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] transition-all hover:bg-ink-2"
            >
              <Sparkles className="h-4 w-4" />
              Open the live radar
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path
                  d="M2 6.5h9M6.5 2l4.5 4.5L6.5 11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="#cascade"
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-rule-strong bg-transparent px-5 text-[14px] font-semibold text-ink hover:bg-bg-sunk"
            >
              See how the cascade works
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-3 border-t border-rule pt-6 text-left sm:max-w-md">
            <Stat label="Sources watched" value="7" sub="EU · DE · municipal" />
            <Stat label="Findings / day" value="42" sub="avg. last 14 days" />
            <Stat label="Interrupts" value="2" sub="per 100 findings" />
          </dl>
        </div>

        <HeroDemoCard />
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">{label}</dt>
      <dd className="mt-1.5 font-display text-3xl tracking-display tnum">{value}</dd>
      <dd className="mt-0.5 text-[11px] text-ink-mute">{sub}</dd>
    </div>
  );
}

function BackgroundOrnament() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] w-full opacity-[0.55]"
      viewBox="0 0 1440 600"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="hero-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--rule)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--rule-strong)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--rule)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1440" height="600" fill="url(#hero-glow)" />
      {[80, 200, 320, 440, 560, 680, 800, 920, 1040, 1160, 1280, 1400].map((x) => (
        <line
          key={x}
          x1={x}
          y1="0"
          x2={x}
          y2="600"
          stroke="var(--rule)"
          strokeOpacity="0.3"
          strokeDasharray="2 8"
        />
      ))}
      <line x1="0" y1="540" x2="1440" y2="540" stroke="url(#hero-line)" />
    </svg>
  );
}

function HeroDemoCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[var(--radius-lg)] bg-accent/8 blur-3xl" />
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-rule-strong bg-bg-elev shadow-[var(--shadow-2)]">
        <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            <span>scout · run_2026_06_13_0915</span>
          </div>
          <span>3 stages · 0.41s</span>
        </div>

        <CascadeDiagram />

        <div className="border-t border-rule">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            <span>selected finding</span>
            <span>score 94 / 100</span>
          </div>
          <div className="space-y-2.5 px-4 pb-4">
            <div>
              <div className="text-[14px] font-semibold leading-snug">
                EU regional digital public services framework
              </div>
              <div className="mt-1 text-[12px] text-ink-mute">
                European Regional Innovation Office · TED EU tenders · deadline 24 Jun 2026 · EUR 12.0M
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="rounded border border-accent-soft bg-accent-soft px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-accent-deep">
                official_tender
              </span>
              <span className="rounded border border-warn-soft bg-warn-soft px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-warn">
                deadline_near
              </span>
              <span className="rounded border border-good-soft bg-good-soft px-1.5 py-0.5 font-semibold uppercase tracking-[0.12em] text-good">
                budget_approved
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
        <span>↑ higher score = more interrupt-worthy</span>
        <span>live demo · fixtures</span>
      </div>
    </div>
  );
}

function CascadeDiagram() {
  const stages = [
    { label: "GLiNER2", sub: "entities · clues", ms: "0.06s" },
    { label: "Gemma 4", sub: "score · route", ms: "0.18s" },
    { label: "Gemini", sub: "reason · next", ms: "0.17s" },
  ];
  return (
    <div className="relative px-5 py-6">
      <div className="grid grid-cols-3 gap-3">
        {stages.map((s, i) => (
          <div
            key={s.label}
            className="relative rounded-[var(--radius)] border border-rule bg-bg-elev p-3"
          >
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              <span>0{i + 1}</span>
              <span>{s.ms}</span>
            </div>
            <div className="mt-2 font-display text-[20px] leading-none tracking-display">
              {s.label}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-3">{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-5 top-1/2 -z-0 h-px -translate-y-1/2 bg-rule" />
      <div
        className="pointer-events-none absolute top-1/2 -z-0 h-px w-12 -translate-y-1/2 bg-accent"
        style={{ animation: "flow 2.4s var(--ease) infinite" }}
      />
    </div>
  );
}
