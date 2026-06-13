"use client";

import { Layers3, Route, Sparkles } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type { Finding, ModelScore } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type CascadeFlowProps = {
  findings: Finding[];
  scores: ModelScore[];
  selectedFindingId: string;
};

export function CascadeFlow({ findings, scores, selectedFindingId }: CascadeFlowProps) {
  const selected = findings.find((f) => f.id === selectedFindingId) ?? findings[0];
  const score = scores.find((s) => s.findingId === selected?.id);

  return (
    <div className="rounded-[var(--radius)] border border-rule bg-bg-elev">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>The cascade</SectionLabel>
          <p className="mt-2 max-w-xl text-[13px] text-ink-3">
            Each finding flows through the three stages. Hover or click a stage to see what
            it produced for the selected finding.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          avg latency · 0.41s / finding
        </div>
      </div>

      <div className="relative px-5 py-6 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stage
            n={1}
            title="GLiNER2"
            sub="Entities · clues"
            icon={Layers3}
            fact={selected?.title}
            detail="Fine-tuned for procurement. Returns buyer, project, deadline, budget, contact."
          />
          <Stage
            n={2}
            title="Gemma 4"
            sub="Score · route"
            icon={Route}
            fact={score ? `Score ${score.worthOutreachScore} · ${score.route}` : undefined}
            detail={score?.rationale}
            badge={score ? String(score.worthOutreachScore) : undefined}
          />
          <Stage
            n={3}
            title="Gemini"
            sub="Reason · next"
            icon={Sparkles}
            fact={score && score.worthOutreachScore >= 70 ? "Called" : "Skipped"}
            detail="Only fired on high-value, high-urgency, or human-review findings. The gate is enforced."
            tone={score && score.worthOutreachScore >= 70 ? "good" : "muted"}
          />
        </div>

        <CascadeLine />

        <div className="mt-6 grid grid-cols-2 gap-2 border-t border-rule pt-5 sm:grid-cols-4">
          <FlowStat label="Findings today" value={String(findings.length)} />
          <FlowStat
            label="Scored by Gemma"
            value={String(scores.length)}
            sub="always"
          />
          <FlowStat
            label="Gemini calls"
            value={String(scores.filter((s) => s.worthOutreachScore >= 70).length)}
            sub="gated"
            tone="accent"
          />
          <FlowStat
            label="Suppressed"
            value={String(findings.length - scores.filter((s) => s.route !== "ignore").length)}
            sub="low signal"
            tone="muted"
          />
        </div>
      </div>
    </div>
  );
}

function Stage({
  n,
  title,
  sub,
  icon: Icon,
  fact,
  detail,
  badge,
  tone,
}: {
  n: number;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  fact?: string;
  detail?: string;
  badge?: string;
  tone?: "good" | "muted";
}) {
  return (
    <div className="relative">
      <div
        className={cn(
          "h-full rounded-[var(--radius-sm)] border border-rule bg-bg p-4",
          tone === "muted" && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            <Icon className="h-3.5 w-3.5" />
            0{n}
          </div>
          {badge ? (
            <span className="rounded-[var(--radius-sm)] border border-accent-soft bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-bold tnum text-accent-deep">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 font-display text-[22px] leading-none tracking-display">{title}</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{sub}</div>
        {fact ? (
          <div className="mt-3 truncate text-[12px] font-medium text-ink-2">{fact}</div>
        ) : null}
        {detail ? (
          <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-ink-3">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

function CascadeLine() {
  return (
    <div className="pointer-events-none absolute inset-x-5 top-1/2 hidden -translate-y-1/2 sm:block">
      <div className="relative h-px">
        <div className="absolute inset-x-[16%] top-0 h-px bg-rule" />
        <div
          className="absolute h-px w-24 bg-accent"
          style={{ animation: "flow 2.4s var(--ease) infinite" }}
        />
      </div>
    </div>
  );
}

function FlowStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "muted";
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-2xl tracking-display tnum",
          tone === "accent" && "text-accent",
          tone === "muted" && "text-ink-mute",
        )}
      >
        {value}
      </div>
      {sub ? <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">{sub}</div> : null}
    </div>
  );
}
