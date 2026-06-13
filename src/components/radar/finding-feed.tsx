"use client";

import type { ApprovalRequest, Extraction, Finding, ModelScore } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type FindingFeedProps = {
  findings: Finding[];
  extractions: Extraction[];
  scores: ModelScore[];
  selectedFindingId: string;
  onSelect: (id: string) => void;
  approvalStatuses: Record<string, ApprovalRequest["status"]>;
};

export function FindingFeed({
  findings,
  extractions,
  scores,
  selectedFindingId,
  onSelect,
}: FindingFeedProps) {
  return (
    <ul className="divide-y divide-rule">
      {findings.map((f) => {
        const extraction = extractions.find((e) => e.findingId === f.id);
        const score = scores.find((s) => s.findingId === f.id);
        const selected = selectedFindingId === f.id;
        const approval = score?.route === "human_review" ? "needs decision" : null;
        return (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onSelect(f.id)}
              className={cn(
                "grid w-full grid-cols-1 gap-3 px-5 py-4 text-left transition-colors sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center",
                selected ? "bg-bg-sunk" : "hover:bg-bg-sunk/60",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  <span className={f.detectedLanguage === "de" ? "text-info" : "text-ink-mute"}>
                    {f.detectedLanguage}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <span className="truncate">{f.sourceName}</span>
                  {extraction ? (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span className="font-mono tnum text-ink-3">
                        {Math.round(extraction.confidence * 100)}%
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="mt-1.5 line-clamp-1 font-display text-[15px] font-medium leading-snug tracking-display">
                  {f.title}
                </div>
                <div className="mt-1 line-clamp-1 text-[12px] text-ink-3">
                  {extraction?.entities.buyerIssuer}
                  {extraction?.entities.deadline ? ` · ${extraction.entities.deadline}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {extraction?.clueTags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3"
                  >
                    {t.replaceAll("_", " ")}
                  </span>
                ))}
                {extraction && extraction.clueTags.length > 3 ? (
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute">
                    +{extraction.clueTags.length - 3}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {approval ? (
                  <span className="rounded-[var(--radius-sm)] border border-warn-soft bg-warn-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-warn">
                    {approval}
                  </span>
                ) : null}
                {score ? (
                  <span
                    className={cn(
                      "rounded-[var(--radius-sm)] border border-rule px-2 py-1 font-mono text-[11px] font-bold tnum",
                      score.worthOutreachScore >= 80
                        ? "bg-good-soft text-good"
                        : score.worthOutreachScore >= 60
                          ? "bg-accent-soft text-accent-deep"
                          : score.worthOutreachScore >= 35
                            ? "bg-warn-soft text-warn"
                            : "bg-bg-sunk text-ink-mute",
                    )}
                  >
                    {score.worthOutreachScore}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
