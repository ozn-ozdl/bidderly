"use client";

import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { FindingFeed } from "../finding-feed";
import { CascadeFlow } from "../cascade-flow";
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
      <CascadeFlow findings={snapshot.findings} scores={snapshot.scores} selectedFindingId={selectedFindingId} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
            <div>
              <SectionLabel>Live radar feed</SectionLabel>
              <p className="mt-2 text-[13px] text-ink-3">
                {snapshot.findings.length} findings · {snapshot.extractions.length} structured · {snapshot.scores.length} scored
              </p>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              click a row to open
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
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  status === "pending"
                    ? "bg-warn"
                    : status === "approved"
                      ? "bg-good"
                      : "bg-ink-faint"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{a.title}</div>
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
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  {status}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
