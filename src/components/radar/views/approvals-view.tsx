"use client";

import { useState } from "react";
import { SectionLabel } from "@/components/ui/section-label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import type { ApprovalRequest, Finding } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type ApprovalsViewProps = {
  approvals: ApprovalRequest[];
  approvalStatuses: Record<string, ApprovalRequest["status"]>;
  onApprovalChange: (id: string, status: ApprovalRequest["status"]) => void;
  findings: Finding[];
};

export function ApprovalsView({
  approvals,
  approvalStatuses,
  onApprovalChange,
  findings,
}: ApprovalsViewProps) {
  const [filter, setFilter] = useState<"pending" | "all" | "resolved">("pending");
  const filtered = approvals.filter((a) => {
    const status = approvalStatuses[a.id] ?? a.status;
    if (filter === "pending") return status === "pending";
    if (filter === "resolved") return status !== "pending";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel size="lg">Decisions</SectionLabel>
          <h2 className="mt-2 font-display text-3xl tracking-display">Approvals & escalations</h2>
          <p className="mt-1.5 max-w-xl text-[13px] text-ink-3">
            The only point in the cascade where the system stops. Approve to let agents continue
            the workflow, or request info to gather more context before the next step.
          </p>
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-0.5">
          {(
            [
              { id: "pending", label: "Pending" },
              { id: "resolved", label: "Resolved" },
              { id: "all", label: "All" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={cn(
                "rounded-[calc(var(--radius-sm)-2px)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                filter === t.id ? "bg-ink text-bg" : "text-ink-3 hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-good" />
          <div className="mt-3 font-display text-lg tracking-display">All clear</div>
          <p className="mt-1 text-[13px] text-ink-mute">
            No {filter === "pending" ? "pending" : ""} approvals right now. The cascade is
            working through the queue.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const finding = findings.find((f) => f.id === a.findingId);
            const status = approvalStatuses[a.id] ?? a.status;
            return (
              <li key={a.id}>
                <Card tone={status === "pending" ? "default" : "sunk"} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                        <span>{a.requester.replaceAll("_", " ")}</span>
                        <span className="text-ink-faint">·</span>
                        <span>due {new Date(a.dueAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-ink-faint">·</span>
                        <span className={cn(
                          status === "pending" ? "text-warn" : status === "approved" ? "text-good" : "text-ink-3",
                        )}>
                          {status}
                        </span>
                      </div>
                      <h3 className="mt-1.5 font-display text-xl tracking-display">{a.title}</h3>
                      <p className="mt-1 text-[13px] text-ink-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">Blocker · </span>
                        {a.blocker}
                      </p>
                      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">
                        {a.requestedAction}
                      </p>
                      {finding ? (
                        <div className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-bg-sunk/40 px-2.5 py-1.5 text-[12px] text-ink-2">
                          <ChevronRight className="h-3 w-3 text-ink-mute" />
                          {finding.title}
                        </div>
                      ) : null}
                    </div>

                    {status === "pending" ? (
                      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                        <Button size="sm" onClick={() => onApprovalChange(a.id, "approved")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => onApprovalChange(a.id, "needs_info")}>
                          Request info
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
                          status === "approved" ? "bg-good-soft text-good" : "bg-bg-sunk text-ink-3",
                        )}
                      >
                        {status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {status}
                      </span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
