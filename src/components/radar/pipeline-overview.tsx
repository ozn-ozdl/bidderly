"use client";

import { Database, Route, Sparkles, Target, XOctagon } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import type { RadarSnapshot } from "@/lib/radar-types";

type PipelineOverviewProps = {
  snapshot: RadarSnapshot;
};

export function PipelineOverview({ snapshot }: PipelineOverviewProps) {
  const geminiCalls = snapshot.geminiAnalyses.length;
  const qualified = snapshot.opportunities.length;
  const suppressed = snapshot.findings.length - snapshot.scores.filter((s) => s.route !== "ignore").length;

  const stages = [
    { icon: Database, label: "Scanned", value: snapshot.scoutRun.sourcesScanned, sub: "sources" },
    { icon: Database, label: "Discovered", value: snapshot.findings.length, sub: "raw findings" },
    { icon: Database, label: "Structured", value: snapshot.extractions.length, sub: "by GLiNER2" },
    { icon: Route, label: "Scored", value: snapshot.scores.length, sub: "by Gemma 4" },
    { icon: Sparkles, label: "Reasoned", value: geminiCalls, sub: "by Gemini" },
    { icon: Target, label: "Qualified", value: qualified, sub: "opportunities" },
    { icon: XOctagon, label: "Suppressed", value: Math.max(0, suppressed), sub: "low signal", muted: true },
  ];

  return (
    <div className="rounded-[var(--radius)] border border-rule bg-bg-elev">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Pipeline overview</SectionLabel>
          <p className="mt-2 max-w-xl text-[13px] text-ink-3">
            How many potential tenders were scanned and processed in the last run.
            Open a finding or approval to see what each model produced.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          {snapshot.scoutRun.id}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-4 lg:grid-cols-7">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <li key={stage.label} className="bg-bg-elev px-4 py-3.5">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                <Icon className="h-3 w-3" />
                {String(i + 1).padStart(2, "0")} · {stage.label}
              </div>
              <div
                className={`mt-1.5 font-display text-2xl tracking-display tnum ${
                  stage.muted ? "text-ink-mute" : "text-ink"
                }`}
              >
                {stage.value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">{stage.sub}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
