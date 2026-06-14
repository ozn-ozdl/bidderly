"use client";

import { ChevronRight, Clock, Globe, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  ApprovalRequest,
  Extraction,
  Finding,
  ModelScore,
  Opportunity,
  RouteDecision,
  Urgency,
} from "@/lib/radar-types";

type DecideRowProps = {
  approval: ApprovalRequest;
  status: ApprovalRequest["status"];
  onOpen: () => void;
};

export function DecideRow({ approval, status, onOpen }: DecideRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-[var(--radius)] border border-rule bg-bg-elev p-3.5 text-left shadow-[var(--shadow-1)] transition-colors hover:border-rule-strong"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-semibold leading-snug text-ink">{approval.title}</span>
          <ApprovalStatusBadge status={status} />
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-warn">
          <Clock className="h-3 w-3" />
          Due {formatDue(approval.dueAt)}
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] text-ink-3">{approval.blocker}</p>
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
    </button>
  );
}

type OpportunityRowProps = {
  opportunity: Opportunity;
  watched: boolean;
  onToggleWatch: () => void;
  onOpen: () => void;
};

export function OpportunityRow({ opportunity, watched, onToggleWatch, onOpen }: OpportunityRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius)] border border-rule bg-bg-elev p-3.5 shadow-[var(--shadow-1)]">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <OpportunityStatusBadge status={opportunity.status} />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            {opportunity.valueBand}
          </span>
        </div>
        <div className="mt-1 text-[13px] font-semibold leading-snug text-ink">{opportunity.title}</div>
        <div className="mt-1 text-[12px] text-ink-3">{opportunity.buyer}</div>
        <div className="mt-1 text-[11px] text-ink-mute">{opportunity.nextAction}</div>
      </button>
      <button
        type="button"
        aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        aria-pressed={watched}
        onClick={(e) => {
          e.stopPropagation();
          onToggleWatch();
        }}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
          watched ? "bg-accent-soft text-accent-deep" : "text-ink-faint hover:bg-bg-sunk hover:text-ink",
        )}
      >
        <Star className={cn("h-4 w-4", watched && "fill-current")} />
      </button>
    </div>
  );
}

type FindingRowProps = {
  finding: Finding;
  score?: ModelScore;
  extraction?: Extraction;
  onOpen: () => void;
};

export function FindingRow({ finding, score, extraction, onOpen }: FindingRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[var(--radius)] border border-rule bg-bg-elev p-3.5 text-left shadow-[var(--shadow-1)] transition-colors hover:border-rule-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <StageBadge stage={finding.stage} />
        {score ? <ScorePill score={score.worthOutreachScore} urgency={score.urgency} /> : null}
      </div>
      <div className="mt-2 text-[13px] font-semibold leading-snug text-ink">{finding.title}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-mute">
        <Globe className="h-3 w-3 shrink-0" />
        <span className="truncate">{finding.sourceName}</span>
        <span className="ml-auto shrink-0 font-mono tnum">{relativeDate(finding.publishedAt)}</span>
      </div>
      {score ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RouteBadge route={score.route} />
          {(extraction?.clueTags ?? []).slice(0, 3).map((tag) => (
            <ClueTag key={tag} tag={tag} />
          ))}
        </div>
      ) : null}
    </button>
  );
}

function ApprovalStatusBadge({ status }: { status: ApprovalRequest["status"] }) {
  const styles =
    status === "pending"
      ? "border-warn-soft bg-warn-soft text-warn"
      : status === "approved"
        ? "border-good-soft bg-good-soft text-good"
        : "border-rule bg-bg-sunk text-ink-3";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em]",
        styles,
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function OpportunityStatusBadge({ status }: { status: Opportunity["status"] }) {
  const styles =
    status === "ready_for_outreach" || status === "new"
      ? "border-good-soft bg-good-soft text-good"
      : status === "blocked"
        ? "border-warn-soft bg-warn-soft text-warn"
        : "border-rule bg-bg-sunk text-ink-3";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em]",
        styles,
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

function StageBadge({ stage }: { stage: Finding["stage"] }) {
  return (
    <span className="rounded-full border border-rule bg-bg-sunk px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink-3">
      {stage}
    </span>
  );
}

function ScorePill({ score, urgency }: { score: number; urgency: Urgency }) {
  const color =
    urgency === "high" ? "text-bad" : urgency === "medium" ? "text-warn" : "text-good";
  return (
    <span
      className={cn(
        "rounded-full border border-rule bg-bg-sunk px-2 py-0.5 font-mono text-[10px] font-bold tnum",
        color,
      )}
    >
      {score}
    </span>
  );
}

function RouteBadge({ route }: { route: RouteDecision }) {
  return (
    <span className="rounded-full border border-accent-soft bg-accent-soft px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-deep">
      {route.replaceAll("_", " ")}
    </span>
  );
}

function ClueTag({ tag }: { tag: string }) {
  return (
    <span className="rounded-full border border-rule bg-bg-sunk px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-mute">
      {tag.replaceAll("_", " ")}
    </span>
  );
}

function formatDue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function relativeDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
