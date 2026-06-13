"use client";

import { Database, Route, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { SourceHealth } from "../source-health";
import { OpportunityList } from "../opportunity-list";
import { TransmissionLog } from "../transmission-log";
import type { AgentEvent, ApprovalRequest, RadarSnapshot } from "@/lib/radar-types";

type PipelineViewProps = {
  snapshot: RadarSnapshot;
  liveEvents: AgentEvent[];
  approvalByFinding: Map<string, ApprovalRequest>;
};

export function PipelineView({ snapshot, liveEvents }: PipelineViewProps) {
  const lastRun = snapshot.scoutRun;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SectionLabel>Run</SectionLabel>
          <div className="mt-3 font-display text-2xl tracking-display">{lastRun.id}</div>
          <div className="mt-2 space-y-1 text-[12px] text-ink-3">
            <div className="flex justify-between">
              <span className="font-mono uppercase tracking-[0.14em] text-ink-mute">Mode</span>
              <span className="font-mono tnum text-ink-2">{lastRun.mode.replaceAll("_", " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono uppercase tracking-[0.14em] text-ink-mute">Status</span>
              <span className="font-mono tnum text-ink-2">{lastRun.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono uppercase tracking-[0.14em] text-ink-mute">Sources</span>
              <span className="font-mono tnum text-ink-2">{lastRun.sourcesScanned}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono uppercase tracking-[0.14em] text-ink-mute">Findings</span>
              <span className="font-mono tnum text-ink-2">{lastRun.findingsDiscovered}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Pipeline health</SectionLabel>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <StageHealth icon={Database} label="GLiNER2" status="ok" />
            <StageHealth icon={Route} label="Gemma 4" status="ok" />
            <StageHealth
              icon={Sparkles}
              label="Gemini"
              status="ok"
              sub="2 calls"
            />
          </div>
          <p className="mt-3 text-[12px] text-ink-3">
            All stages responded within 0.6s. Gemini invoked on 2 of 18 findings (gate enforced).
          </p>
        </Card>

        <Card className="p-5">
          <SectionLabel>Why we interrupt</SectionLabel>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-2">
            <span className="font-display text-2xl tracking-display">2</span> of{" "}
            <span className="font-mono tnum">{snapshot.findings.length}</span> findings are
            blocked on a human decision. The cascade gates the rest.
          </p>
          <ul className="mt-3 space-y-1.5 text-[12px] text-ink-3">
            {snapshot.approvals.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                {a.title}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <SourceHealth sources={snapshot.sources} />
        <OpportunityList opportunities={snapshot.opportunities} />
      </div>

      <TransmissionLog events={liveEvents} />
    </div>
  );
}

function StageHealth({
  icon: Icon,
  label,
  status,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: "ok" | "warn" | "bad";
  sub?: string;
}) {
  const dot =
    status === "ok" ? "bg-good" : status === "warn" ? "bg-warn" : "bg-bad";
  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk/40 p-3">
      <Icon className="mx-auto h-4 w-4 text-ink-2" />
      <div className="mt-1.5 text-[12px] font-semibold">{label}</div>
      <div className="mt-1 flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {sub ?? "ready"}
      </div>
    </div>
  );
}
