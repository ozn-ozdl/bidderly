"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Gauge,
  Sparkles,
} from "lucide-react";
import { Drawer, DrawerHeader, DrawerBody } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/cn";
import type {
  ApprovalRequest,
  Extraction,
  GeminiAnalysis,
  ModelScore,
  Opportunity,
} from "@/lib/radar-types";
import type { Bundle } from "./radar-shell";

type Tab = "extraction" | "score" | "gemini" | "opportunity" | "approval";

type FindingDrawerProps = {
  open: boolean;
  onClose: () => void;
  bundle: Bundle;
  approvalStatus?: ApprovalRequest["status"];
  onApprovalChange: (id: string, status: ApprovalRequest["status"]) => void;
};

export function FindingDrawer({
  open,
  onClose,
  bundle,
  approvalStatus,
  onApprovalChange,
}: FindingDrawerProps) {
  const [tab, setTab] = useState<Tab>(defaultTab(bundle));

  return (
    <Drawer open={open} onClose={onClose} width={680} ariaLabel="Finding detail">
      <DrawerHeader onClose={onClose}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            <Database className="h-3 w-3" />
            finding · {bundle.finding.id}
          </div>
          <h2 className="mt-1 line-clamp-1 font-display text-[22px] leading-tight tracking-display">
            {bundle.finding.title}
          </h2>
          <a
            href={bundle.finding.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-accent hover:text-accent-deep"
          >
            Source record <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
        {bundle.score ? <ScoreBadge score={bundle.score.worthOutreachScore} route={bundle.score.route} /> : null}
      </DrawerHeader>

      <div className="border-b border-rule bg-bg-elev/60 px-5">
        <div className="flex gap-1 overflow-x-auto py-2" role="tablist">
          <TabButton active={tab === "extraction"} onClick={() => setTab("extraction")} disabled={!bundle.extraction}>
            Extraction
          </TabButton>
          <TabButton active={tab === "score"} onClick={() => setTab("score")} disabled={!bundle.score}>
            Gemma 4
          </TabButton>
          <TabButton active={tab === "gemini"} onClick={() => setTab("gemini")} disabled={!bundle.gemini}>
            Gemini
          </TabButton>
          <TabButton
            active={tab === "opportunity"}
            onClick={() => setTab("opportunity")}
            disabled={!bundle.opportunity}
          >
            Opportunity
          </TabButton>
          <TabButton
            active={tab === "approval"}
            onClick={() => setTab("approval")}
            disabled={!bundle.approval}
            highlight
          >
            Approval
          </TabButton>
        </div>
      </div>

      <DrawerBody>
        {tab === "extraction" && bundle.extraction ? <ExtractionPanel extraction={bundle.extraction} /> : null}
        {tab === "score" && bundle.score ? <ScorePanel score={bundle.score} /> : null}
        {tab === "gemini" && bundle.gemini ? <GeminiPanel analysis={bundle.gemini} /> : null}
        {tab === "opportunity" && bundle.opportunity ? <OpportunityPanel opportunity={bundle.opportunity} /> : null}
        {tab === "approval" && bundle.approval ? (
          <ApprovalPanel
            approval={bundle.approval}
            status={approvalStatus ?? bundle.approval.status}
            onChange={(s) => onApprovalChange(bundle.approval!.id, s)}
          />
        ) : null}

        {!bundle.extraction && tab === "extraction" ? <EmptyState /> : null}
        {!bundle.score && tab === "score" ? <EmptyState /> : null}
        {!bundle.gemini && tab === "gemini" ? <GeminiSkipped score={bundle.score} /> : null}
        {!bundle.opportunity && tab === "opportunity" ? <EmptyState /> : null}
        {!bundle.approval && tab === "approval" ? <EmptyState /> : null}
      </DrawerBody>
    </Drawer>
  );
}

function defaultTab(bundle: Bundle): Tab {
  if (bundle.approval) return "approval";
  if (bundle.gemini) return "gemini";
  if (bundle.score) return "score";
  if (bundle.extraction) return "extraction";
  return "opportunity";
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-[var(--radius-sm)] px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-ink text-bg"
          : highlight
            ? "text-warn hover:text-warn"
            : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ScoreBadge({ score, route }: { score: number; route: ModelScore["route"] }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          "rounded-[var(--radius-sm)] border border-rule px-2 py-1 font-mono text-[12px] font-bold tnum",
          score >= 80 ? "bg-good-soft text-good" : score >= 60 ? "bg-accent-soft text-accent-deep" : "bg-bg-sunk text-ink-3",
        )}
      >
        {score}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        {route.replaceAll("_", " ")}
      </span>
    </div>
  );
}

function ExtractionPanel({ extraction }: { extraction: Extraction }) {
  const rows: Array<[string, string | undefined]> = [
    ["Buyer", extraction.entities.buyerIssuer],
    ["Project", extraction.entities.projectName],
    ["Category", extraction.entities.category],
    ["Location", extraction.entities.location],
    ["Deadline", extraction.entities.deadline],
    ["Budget", extraction.entities.budgetValue],
    ["Contact", extraction.entities.contactPersona],
  ];

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>GLiNER2 extraction</SectionLabel>
        <p className="mt-2 text-[12px] text-ink-3">
          Fine-tuned model produced this entity set with{" "}
          <span className="font-mono tnum text-ink-2">{Math.round(extraction.confidence * 100)}%</span> confidence.
        </p>
      </div>
      <dl className="grid gap-px overflow-hidden rounded-[var(--radius-sm)] border border-rule bg-rule">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="grid grid-cols-[110px_1fr] gap-3 bg-bg-elev px-4 py-2.5 text-[13px]">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{label}</dt>
              <dd className="text-ink-2">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <div>
        <SectionLabel>Procurement clue tags</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {extraction.clueTags.map((t) => (
            <span
              key={t}
              className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2"
            >
              {t.replaceAll("_", " ")}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScorePanel({ score }: { score: ModelScore }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Gemma 4 route</SectionLabel>
        <p className="mt-2 text-[12px] text-ink-3">
          {score.model}
        </p>
      </div>

      <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk/40 p-4">
        <div className="flex items-baseline justify-between">
          <div className="font-display text-5xl tracking-display tnum">{score.worthOutreachScore}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">/ 100 worth</div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-2">
          <span>urgency:</span>
          <span
            className={cn(
              "rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
              score.urgency === "high"
                ? "bg-signal-soft text-signal"
                : score.urgency === "medium"
                  ? "bg-warn-soft text-warn"
                  : "bg-bg-sunk text-ink-3",
            )}
          >
            {score.urgency}
          </span>
          <span>· route:</span>
          <span className="rounded-[var(--radius-sm)] border border-rule bg-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-2">
            {score.route.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      <p className="text-[14px] leading-relaxed text-ink-2">{score.rationale}</p>
    </div>
  );
}

function GeminiPanel({ analysis }: { analysis: GeminiAnalysis }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Gemini reasoning</SectionLabel>
        <p className="mt-2 text-[12px] text-ink-3">
          {analysis.model}. Called because this finding passed the cascade gate.
        </p>
      </div>

      <p className="text-[14px] leading-relaxed text-ink-2">{analysis.summary}</p>

      <div>
        <SectionLabel>Risks</SectionLabel>
        <ul className="mt-3 space-y-1.5 text-[13px] text-ink-2">
          {analysis.risks.map((r) => (
            <li key={r} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <SectionLabel>Recommended next steps</SectionLabel>
        <ul className="mt-3 space-y-1.5 text-[13px] text-ink-2">
          {analysis.recommendedNextSteps.map((s) => (
            <li key={s} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {analysis.blocker ? (
        <div className="rounded-[var(--radius-sm)] border border-warn-soft bg-warn-soft/60 p-3 text-[13px] text-ink-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">Blocker</div>
          <p className="mt-1">{analysis.blocker}</p>
        </div>
      ) : null}
    </div>
  );
}

function GeminiSkipped({ score }: { score?: ModelScore }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-rule py-12 text-center">
      <Sparkles className="h-5 w-5 text-ink-faint" />
      <div className="mt-3 font-display text-lg tracking-display">Gemini was not called</div>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-mute">
        {score
          ? `Score ${score.worthOutreachScore} and route "${score.route.replaceAll("_", " ")}" did not pass the cascade gate.`
          : "The cascade did not require deep reasoning for this finding."}
      </p>
    </div>
  );
}

function OpportunityPanel({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel>Opportunity</SectionLabel>
        <p className="mt-2 text-[12px] text-ink-3">A qualified opportunity surfaced from this finding.</p>
      </div>
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-sm)] border border-rule bg-rule sm:grid-cols-2">
        <Field label="Title" value={opportunity.title} />
        <Field label="Buyer" value={opportunity.buyer} />
        <Field label="Owner" value={opportunity.owner} />
        <Field label="Value band" value={opportunity.valueBand} mono />
        <Field label="Deadline" value={opportunity.deadline} mono />
        <Field label="Status" value={opportunity.status.replaceAll("_", " ")} mono />
      </div>
      <div className="rounded-[var(--radius-sm)] border border-accent-soft bg-accent-soft/40 p-3.5 text-[13px] text-ink-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-deep">
          <Gauge className="h-3 w-3" /> Next action
        </div>
        <p className="mt-1">{opportunity.nextAction}</p>
      </div>
    </div>
  );
}

function ApprovalPanel({
  approval,
  status,
  onChange,
}: {
  approval: ApprovalRequest;
  status: ApprovalRequest["status"];
  onChange: (status: ApprovalRequest["status"]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel tone="warn">Human approval</SectionLabel>
        <p className="mt-2 text-[12px] text-ink-3">
          This is the only point in the cascade where we stop and wait.
        </p>
      </div>
      <div className="rounded-[var(--radius-sm)] border border-warn-soft bg-warn-soft/40 p-4">
        <div className="font-display text-xl tracking-display">{approval.title}</div>
        <div className="mt-2 text-[13px] leading-relaxed text-ink-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warn">Blocker · </span>
          {approval.blocker}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{approval.requestedAction}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="md"
          disabled={status !== "pending"}
          onClick={() => onChange("approved")}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={status !== "pending"}
          onClick={() => onChange("needs_info")}
        >
          Request info
        </Button>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          due · {new Date(approval.dueAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {status !== "pending" ? (
        <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk/40 p-3 text-[12px] text-ink-2">
          Recorded as <span className="font-mono uppercase tracking-[0.14em]">{status}</span>. The agent
          will continue the workflow.
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-bg-elev px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{label}</div>
      <div className={cn("mt-0.5 text-[13px] text-ink-2", mono && "font-mono tnum")}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-rule py-12 text-center">
      <Database className="h-5 w-5 text-ink-faint" />
      <div className="mt-3 font-display text-lg tracking-display">Not available</div>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-mute">
        This stage did not produce a record for this finding.
      </p>
    </div>
  );
}
