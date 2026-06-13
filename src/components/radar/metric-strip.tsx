"use client";

import { BellRing, FileSearch, Globe2, Gauge } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { SectionLabel } from "@/components/ui/section-label";
import type { ApprovalRequest, RadarSnapshot } from "@/lib/radar-types";

type RadarMetricStripProps = {
  snapshot: RadarSnapshot;
  pendingApprovals: ApprovalRequest[];
};

export function RadarMetricStrip({ snapshot, pendingApprovals }: RadarMetricStripProps) {
  const qualified = snapshot.opportunities.length;
  const totalValue = snapshot.opportunities.reduce((acc, opp) => {
    const m = opp.valueBand.match(/(\d+)/);
    return acc + (m ? Number(m[1]) : 0);
  }, 0);

  return (
    <section aria-label="Metrics" className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="relative overflow-hidden rounded-[var(--radius)] border border-rule bg-bg-elev p-5 sm:p-6">
        <SectionLabel>Active opportunities</SectionLabel>
        <div className="mt-3 font-display text-[64px] leading-none tracking-display tnum sm:text-[80px]">
          <CountUp value={qualified} />
        </div>
        <div className="mt-2 max-w-md text-[13px] text-ink-3">
          {pendingApprovals.length} blocked, {snapshot.opportunities.length - pendingApprovals.length} ready for outreach.
          Indicative value band EUR {totalValue}M+.
        </div>
      </div>

      <Metric
        icon={Globe2}
        label="Sources watched"
        value={snapshot.sources.length}
        sub={`${snapshot.scoutRun.sourcesScanned} scanned in last run`}
      />
      <Metric
        icon={FileSearch}
        label="Raw findings"
        value={snapshot.findings.length}
        sub={`${snapshot.extractions.length} structured by GLiNER2`}
      />
      <Metric
        icon={pendingApprovals.length > 0 ? BellRing : Gauge}
        label={pendingApprovals.length > 0 ? "Pending decisions" : "Qualified"}
        value={pendingApprovals.length > 0 ? pendingApprovals.length : qualified}
        sub={
          pendingApprovals.length > 0
            ? "Alert only when input is required"
            : "High-value opportunities"
        }
        tone={pendingApprovals.length > 0 ? "warn" : "good"}
      />
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-good"
      : tone === "warn"
        ? "text-warn"
        : tone === "bad"
          ? "text-bad"
          : "text-ink-3";

  return (
    <div className="rounded-[var(--radius)] border border-rule bg-bg-elev p-5">
      <div className="flex items-start justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
      </div>
      <div className={`mt-3 font-display text-4xl tracking-display tnum ${toneClass}`}>
        <CountUp value={value} />
      </div>
      <div className="mt-2 text-[12px] leading-snug text-ink-mute">{sub}</div>
    </div>
  );
}
