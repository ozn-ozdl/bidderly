"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, Database, RotateCcw, Route, Sparkles, X } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type {
  ApprovalRequest,
  Extraction,
  Finding,
  GeminiAnalysis,
  ModelScore,
} from "@/lib/radar-types";

type ApprovalsViewProps = {
  approvals: ApprovalRequest[];
  approvalStatuses: Record<string, ApprovalRequest["status"]>;
  onApprovalChange: (id: string, status: ApprovalRequest["status"]) => void;
  onReset: () => void;
  isResetting: boolean;
  findings: Finding[];
  extractions: Extraction[];
  scores: ModelScore[];
  geminiAnalyses: GeminiAnalysis[];
};

export function ApprovalsView({
  approvals,
  approvalStatuses,
  onApprovalChange,
  onReset,
  isResetting,
  findings,
  extractions,
  scores,
  geminiAnalyses,
}: ApprovalsViewProps) {
  const [filter, setFilter] = useState<"pending" | "resolved">("pending");
  const filtered = approvals.filter((a) => {
    const status = approvalStatuses[a.id] ?? a.status;
    if (filter === "pending") return status === "pending";
    return status !== "pending";
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionLabel size="lg">Decisions</SectionLabel>
          <h2 className="mt-2 font-display text-3xl tracking-display">Approvals & escalations</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onReset}
            disabled={isResetting || approvals.length === 0}
            aria-label="Reset all approval requests to pending"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isResetting ? "Resetting…" : "Reset approvals"}
          </Button>
          <div className="inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-0.5">
            {(
              [
                { id: "pending", label: "Pending" },
                { id: "resolved", label: "Resolved" },
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
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-good" />
          <div className="mt-3 font-display text-lg tracking-display">All clear</div>
          <p className="mt-1 text-[13px] text-ink-mute">
            No {filter === "pending" ? "pending" : "resolved"} approvals right now.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const finding = findings.find((f) => f.id === a.findingId);
            const status = approvalStatuses[a.id] ?? a.status;
            const extraction = extractions.find((e) => e.findingId === a.findingId);
            const score = scores.find((s) => s.findingId === a.findingId);
            const gemini = geminiAnalyses.find((g) => g.findingId === a.findingId);
            return (
              <li key={a.id}>
                <Card
                  tone={status === "pending" ? "default" : "sunk"}
                  className={cn(
                    "p-5 transition-colors",
                    status === "approved" && "border-good-soft/60 bg-good-soft/30",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                        <span>{a.requester.replaceAll("_", " ")}</span>
                        <span className="text-ink-faint">·</span>
                        <span>due {new Date(a.dueAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
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
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-bg-sunk/40 px-2.5 py-1.5 text-[12px] text-ink-2">
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
                          Deny / info
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
                          status === "approved" ? "bg-good text-bg" : "bg-bg-sunk text-ink-3",
                        )}
                      >
                        {status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {status === "approved" ? "Approved" : "Needs info"}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-sm)] border border-rule bg-rule sm:grid-cols-3">
                    <CascadeStep
                      icon={Database}
                      label="GLiNER2"
                      sub={extraction ? `${Math.round(extraction.confidence * 100)}% confidence` : "no extraction"}
                      detail={
                        extraction
                          ? [
                              extraction.entities.buyerIssuer,
                              extraction.entities.budgetValue,
                              extraction.entities.deadline,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"
                          : "Finding did not produce a structured extraction."
                      }
                    />
                    <CascadeStep
                      icon={Route}
                      label="Gemma 4"
                      sub={score ? `Score ${score.worthOutreachScore} · ${score.route.replaceAll("_", " ")}` : "no score"}
                      detail={score?.rationale ?? "Router did not emit a score for this finding."}
                    />
                    <CascadeStep
                      icon={Sparkles}
                      label="Gemini"
                      sub={gemini ? "Called" : score && score.worthOutreachScore >= 70 ? "Expected" : "Skipped (gate)"}
                      detail={gemini?.summary ?? "Deep reasoning was not invoked for this finding."}
                    />
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

function CascadeStep({
  icon: Icon,
  label,
  sub,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  detail: string;
}) {
  return (
    <div className="bg-bg-elev p-3.5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">{sub}</div>
      <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink-2">{detail}</p>
    </div>
  );
}
