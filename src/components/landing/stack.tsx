import { SectionLabel } from "@/components/ui/section-label";

const partners = [
  {
    name: "Pioneer",
    role: "Fine-tuned GLiNER2 + Gemma 4",
    detail: "Local extraction and scoring models. Trained on synthetic DACH procurement examples.",
  },
  {
    name: "Gemini 2.5",
    role: "Reasoning gate",
    detail: "Only called for high-value or human-review findings. Failure is acceptable.",
  },
  {
    name: "Tavily",
    role: "Search enrichment",
    detail: "Source URL and snippet discovery for the scout agent.",
  },
  {
    name: "Clerk",
    role: "Authentication",
    detail: "Sign-in, sign-up, and proxy protection for sensitive routes.",
  },
  {
    name: "Postgres",
    role: "Persistence",
    detail: "Latest snapshot and relational run / finding / opportunity / approval model.",
  },
  {
    name: "Next.js 16",
    role: "Application",
    detail: "App Router, route handlers, Server-Sent Events for live agent telemetry.",
  },
];

export function LandingStack() {
  return (
    <section id="stack" className="border-t border-rule py-24 sm:py-32">
      <div className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
          <div>
            <SectionLabel size="lg">Stack</SectionLabel>
            <h2 className="mt-3 font-display text-[40px] font-normal leading-[1.05] tracking-display sm:text-[52px]">
              The tools the
              <br />
              <em className="not-italic text-accent">cascade is built on.</em>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.6] text-ink-2">
              All partner technology is wired through a typed adapter layer. The same flow works
              with or without live provider keys — one cascade, one data model.
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {partners.map((p) => (
              <li
                key={p.name}
                className="group relative rounded-[var(--radius)] border border-rule bg-bg-elev p-5 transition-colors hover:border-rule-strong"
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-xl tracking-display">{p.name}</div>
                  <span className="rounded-full border border-rule bg-bg-sunk px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
                    partner
                  </span>
                </div>
                <div className="mt-1 text-[12px] font-medium text-ink-2">{p.role}</div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-3">{p.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
