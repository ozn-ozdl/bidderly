"use client";

import { CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { FindingFeed } from "../finding-feed";
import { PipelineOverview } from "../pipeline-overview";
import { cn } from "@/lib/cn";
import type { ApprovalRequest, RadarSnapshot } from "@/lib/radar-types";

type RadarViewProps = {
  snapshot: RadarSnapshot;
  selectedFindingId: string;
  onSelect: (id: string) => void;
  approvalStatuses: Record<string, ApprovalRequest["status"]>;
  onApprovalChange: (id: string, status: ApprovalRequest["status"]) => void;
};

export function RadarView({
  snapshot,
  selectedFindingId,
  onSelect,
  approvalStatuses,
  onApprovalChange,
}: RadarViewProps) {
  return (
    <div className="space-y-4">
      <PipelineOverview snapshot={snapshot} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
            <div>
              <SectionLabel>Live radar feed</SectionLabel>
              <p className="mt-2 text-[13px] text-ink-3">
                {snapshot.findings.length} findings · click a row to open the detail
              </p>
            </div>
          </div>
          <FindingFeed
            findings={snapshot.findings}
            extractions={snapshot.extractions}
            scores={snapshot.scores}
            selectedFindingId={selectedFindingId}
            onSelect={onSelect}
            approvalStatuses={approvalStatuses}
          />
        </Card>

        <PendingDecisionsCard
          approvals={snapshot.approvals}
          approvalStatuses={approvalStatuses}
          onApprovalChange={onApprovalChange}
        />
      </div>
    </div>
  );
}

function PendingDecisionsCard({
  approvals,
  approvalStatuses,
  onApprovalChange,
}: {
  approvals: ApprovalRequest[];
  approvalStatuses: Record<string, ApprovalRequest["status"]>;
  onApprovalChange: (id: string, status: ApprovalRequest["status"]) => void;
}) {
  const pending = approvals.filter(
    (a) => (approvalStatuses[a.id] ?? a.status) === "pending",
  );

  return (
    <Card>
      <div className="flex items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel tone={pending.length > 0 ? "warn" : "ok"}>Decisions in queue</SectionLabel>
          <p className="mt-2 text-[13px] text-ink-3">
            {pending.length} pending · {approvals.length - pending.length} resolved
          </p>
        </div>
      </div>
      <ul className="divide-y divide-rule">
        {approvals.map((a) => {
          const status = approvalStatuses[a.id] ?? a.status;
          return (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
              {status === "pending" ? (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
              ) : status === "approved" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" />
              ) : (
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-mute" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "truncate text-[13px] font-semibold",
                    status === "approved" && "text-ink-2",
                    status === "needs_info" && "text-ink-3",
                  )}
                >
                  {a.title}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-ink-mute">{a.blocker}</p>
              </div>
              {status === "pending" ? (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onApprovalChange(a.id, "approved")}
                    className="rounded-[var(--radius-sm)] bg-ink px-2.5 py-1 text-[11px] font-semibold text-bg hover:bg-ink-2"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprovalChange(a.id, "needs_info")}
                    className="rounded-[var(--radius-sm)] border border-rule px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:border-rule-strong hover:text-ink"
                  >
                    Info
                  </button>
                </div>
              ) : (
                <span
                  className={cn(
                    "shrink-0 rounded-[var(--radius-sm)] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
                    status === "approved"
                      ? "bg-good-soft text-good"
                      : "bg-bg-sunk text-ink-3",
                  )}
                >
                  {status === "approved" ? "Approved" : "Needs info"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
