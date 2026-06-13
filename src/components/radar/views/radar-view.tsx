"use client";

import { ArrowRight, BellRing, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PipelineOverview } from "../pipeline-overview";
import type { RadarSnapshot } from "@/lib/radar-types";

type RadarViewProps = {
  snapshot: RadarSnapshot;
  pendingCount: number;
  onOpenApprovals: () => void;
};

export function RadarView({ snapshot, pendingCount, onOpenApprovals }: RadarViewProps) {
  return (
    <div className="space-y-4">
      <GlanceHero pendingCount={pendingCount} onOpenApprovals={onOpenApprovals} />
      <PipelineOverview snapshot={snapshot} />
      <GlanceStatus snapshot={snapshot} />
    </div>
  );
}

function GlanceHero({ pendingCount, onOpenApprovals }: { pendingCount: number; onOpenApprovals: () => void }) {
  const isClear = pendingCount === 0;
  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center gap-5">
        <div
          className={
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius)] text-bg " +
            (isClear ? "bg-good" : "bg-warn")
          }
        >
          {isClear ? <CheckCircle2 className="h-7 w-7" /> : <BellRing className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
            {isClear ? "Inbox zero" : "Action needed"}
          </div>
          <h2 className="mt-1 font-display text-2xl tracking-display sm:text-3xl">
            {isClear
              ? "Nothing waiting on you."
              : `${pendingCount} approval${pendingCount === 1 ? "" : "s"} need your decision.`}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {isClear
              ? "The cascade is working through the queue. You'll be alerted when something needs you."
              : "The cascade is blocked until you decide. Open the queue to review each request."}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenApprovals}
          className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-ink px-5 text-[13px] font-semibold text-bg hover:bg-ink-2"
        >
          {isClear ? "Open approvals" : `Review ${pendingCount} approval${pendingCount === 1 ? "" : "s"}`}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

function GlanceStatus({ snapshot }: { snapshot: RadarSnapshot }) {
  const degraded = snapshot.sources.filter((s) => s.status !== "healthy").length;
  const ok = degraded === 0;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[var(--radius)] border border-rule bg-bg-elev px-5 py-3 text-[12px] text-ink-mute">
      <div className="flex items-center gap-2">
        <span className={"h-1.5 w-1.5 rounded-full " + (ok ? "bg-good" : "bg-warn")} />
        <span>{ok ? "All sources healthy" : `${degraded} source${degraded === 1 ? "" : "s"} degraded`}</span>
      </div>
      <span className="hidden h-3 w-px bg-rule sm:inline-block" />
      <span>Last run <span className="font-mono tnum text-ink-2">{snapshot.scoutRun.id}</span></span>
    </div>
  );
}
