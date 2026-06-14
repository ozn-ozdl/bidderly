"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BellRing, CheckCircle2, ChevronRight, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { ApprovalRequest, Finding, Opportunity, RadarSnapshot } from "@/lib/radar-types";
import { useUserState } from "@/components/realtime/user-state-provider";
import { DecideRow, FindingRow, OpportunityRow } from "../radar-rows";

type FindingStageFilter = "all" | "qualified" | "scored" | "ignored";

type RadarViewProps = {
  snapshot: RadarSnapshot;
  pendingApprovals: ApprovalRequest[];
  approvalStatuses: Record<string, ApprovalRequest["status"]>;
  pendingCount: number;
  onOpenApprovals: () => void;
  onOpenFinding: (findingId: string) => void;
};

export function RadarView({
  snapshot,
  pendingApprovals,
  approvalStatuses,
  pendingCount,
  onOpenApprovals,
  onOpenFinding,
}: RadarViewProps) {
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<FindingStageFilter>("all");
  const { state, actions } = useUserState();
  const watchset = new Set(state.watchlist.map((w) => w.findingId));

  const scoreByFinding = useMemo(() => {
    const map = new Map<string, (typeof snapshot.scores)[number]>();
    snapshot.scores.forEach((s) => map.set(s.findingId, s));
    return map;
  }, [snapshot.scores]);

  const extractionByFinding = useMemo(() => {
    const map = new Map<string, (typeof snapshot.extractions)[number]>();
    snapshot.extractions.forEach((e) => map.set(e.findingId, e));
    return map;
  }, [snapshot.extractions]);

  const opportunityGroups = useMemo(() => groupOpportunities(snapshot.opportunities), [snapshot.opportunities]);

  const filteredFindings = useMemo(() => {
    return snapshot.findings
      .filter((f) => matchesStageFilter(f, stageFilter))
      .filter(
        (f) =>
          !query ||
          f.title.toLowerCase().includes(query.toLowerCase()) ||
          f.sourceName.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => {
        const l = scoreByFinding.get(a.id)?.worthOutreachScore ?? -1;
        const r = scoreByFinding.get(b.id)?.worthOutreachScore ?? -1;
        return r - l;
      });
  }, [query, scoreByFinding, snapshot.findings, stageFilter]);

  return (
    <div className="space-y-4">
      <div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
          Opportunity radar
        </div>
        <h1 className="mt-1 font-display text-2xl tracking-display sm:text-3xl">What needs you?</h1>
      </div>

      <GlanceHero pendingCount={pendingCount} onOpenApprovals={onOpenApprovals} />
      <GlancePipeline snapshot={snapshot} />
      <GlanceStatus snapshot={snapshot} />

      {pendingApprovals.length > 0 ? (
        <section className="space-y-2">
          <SectionHeader
            title="Decide"
            count={pendingApprovals.length}
            hint="Tap a card to review and decide in the finding detail."
          />
          <div className="space-y-2">
            {pendingApprovals.map((approval) => (
              <DecideRow
                key={approval.id}
                approval={approval}
                status={approvalStatuses[approval.id] ?? approval.status}
                onOpen={() => onOpenFinding(approval.findingId)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {opportunityGroups.ready.length > 0 ? (
        <section className="space-y-2">
          <SectionHeader
            title="Outreach"
            count={opportunityGroups.ready.length}
            hint="Qualified and unblocked. Act now or mark watched."
          />
          <div className="space-y-2">
            {opportunityGroups.ready.map((opportunity) => (
              <OpportunityRow
                key={opportunity.id}
                opportunity={opportunity}
                watched={watchset.has(opportunity.findingId)}
                onToggleWatch={() => actions.toggleWatch(opportunity.findingId, !watchset.has(opportunity.findingId))}
                onOpen={() => onOpenFinding(opportunity.findingId)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {opportunityGroups.monitoring.length > 0 ? (
        <section className="space-y-2">
          <SectionHeader
            title="Monitoring"
            count={opportunityGroups.monitoring.length}
            hint="Long-tail. Worth-outreach score below the active bar."
          />
          <div className="space-y-2">
            {opportunityGroups.monitoring.map((opportunity) => (
              <OpportunityRow
                key={opportunity.id}
                opportunity={opportunity}
                watched={watchset.has(opportunity.findingId)}
                onToggleWatch={() => actions.toggleWatch(opportunity.findingId, !watchset.has(opportunity.findingId))}
                onOpen={() => onOpenFinding(opportunity.findingId)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeader
          title="All findings"
          count={snapshot.findings.length}
          hint="Every finding the cascade touched, scored high to low."
        />
        <FilterBar query={query} onQueryChange={setQuery} stageFilter={stageFilter} onStageFilter={setStageFilter} />
        {filteredFindings.length === 0 ? (
          <EmptyState
            title="No findings yet"
            message={snapshot.findings.length === 0 ? "Run a scout to populate the cascade." : "No findings match your filter."}
          />
        ) : (
          <div className="space-y-2">
            {filteredFindings.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                score={scoreByFinding.get(finding.id)}
                extraction={extractionByFinding.get(finding.id)}
                onOpen={() => onOpenFinding(finding.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GlanceHero({ pendingCount, onOpenApprovals }: { pendingCount: number; onOpenApprovals: () => void }) {
  const isClear = pendingCount === 0;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-bg",
            isClear ? "bg-good" : "bg-warn",
          )}
        >
          {isClear ? <CheckCircle2 className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-ink sm:text-lg">
            {isClear
              ? "Inbox zero"
              : `${pendingCount} approval${pendingCount === 1 ? "" : "s"} need your decision`}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {isClear
              ? "The cascade is working through the queue. You'll be alerted when something needs you."
              : "The cascade is blocked until you decide. Tap to review each request."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenApprovals}
        className={cn(
          "mt-4 flex w-full items-center justify-between rounded-[var(--radius-sm)] px-4 py-3 text-[13px] font-semibold text-bg",
          isClear ? "bg-ink hover:bg-ink-2" : "bg-warn hover:opacity-90",
        )}
      >
        {isClear ? "Open approvals" : `Review ${pendingCount} approval${pendingCount === 1 ? "" : "s"}`}
        <ArrowRight className="h-4 w-4" />
      </button>
    </Card>
  );
}

function GlancePipeline({ snapshot }: { snapshot: RadarSnapshot }) {
  const stages = [
    ["Scanned", snapshot.scoutRun.sourcesScanned],
    ["Discovered", snapshot.findings.length],
    ["Structured", snapshot.extractions.length],
    ["Scored", snapshot.scores.length],
    ["Qualified", snapshot.opportunities.length],
  ] as const;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-ink">Pipeline</div>
        <span className="font-mono text-[10px] text-ink-mute">{snapshot.scoutRun.id}</span>
      </div>
      <div className="-mx-1 mt-3 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-2 px-1">
          {stages.map(([name, value], index) => (
            <div key={name} className="flex items-center gap-2">
              <div className="flex min-w-[3.5rem] flex-col items-center gap-0.5">
                <span className="font-display text-xl font-bold tnum text-ink">{value}</span>
                <span className="text-[11px] text-ink-mute">{name}</span>
              </div>
              {index < stages.length - 1 ? <ChevronRight className="h-3.5 w-3.5 text-ink-faint" /> : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function GlanceStatus({ snapshot }: { snapshot: RadarSnapshot }) {
  const degraded = snapshot.sources.filter((s) => s.status !== "healthy").length;
  const ok = degraded === 0;
  const lastRun = (() => {
    const date = new Date(snapshot.scoutRun.startedAt);
    if (Number.isNaN(date.getTime())) return snapshot.scoutRun.id;
    return `Last run ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  })();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius)] border border-rule bg-bg-elev/80 px-4 py-3 text-[12px] text-ink-mute">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", ok ? "bg-good" : "bg-warn")} />
        <span>{ok ? "All models responding" : `${degraded} source${degraded === 1 ? "" : "s"} degraded`}</span>
      </div>
      <span className="font-mono tnum text-ink-2">{lastRun}</span>
    </div>
  );
}

function SectionHeader({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
        {title} · {count}
      </div>
      <p className="mt-0.5 text-[12px] text-ink-mute">{hint}</p>
    </div>
  );
}

function FilterBar({
  query,
  onQueryChange,
  stageFilter,
  onStageFilter,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  stageFilter: FindingStageFilter;
  onStageFilter: (value: FindingStageFilter) => void;
}) {
  const filters: { key: FindingStageFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "qualified", label: "Qualified" },
    { key: "scored", label: "Scored" },
    { key: "ignored", label: "Ignored" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-ink-mute" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search findings or sources"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
        {query ? (
          <button type="button" onClick={() => onQueryChange("")} aria-label="Clear search">
            <X className="h-4 w-4 text-ink-mute" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onStageFilter(filter.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              stageFilter === filter.key ? "bg-ink text-bg" : "border border-rule bg-bg-elev text-ink-3",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-rule px-6 py-10 text-center">
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[13px] text-ink-mute">{message}</p>
    </div>
  );
}

function groupOpportunities(opportunities: Opportunity[]) {
  return {
    ready: opportunities.filter((o) => o.status === "ready_for_outreach" || o.status === "new"),
    monitoring: opportunities.filter((o) => o.status === "monitoring"),
  };
}

function matchesStageFilter(finding: Finding, filter: FindingStageFilter) {
  switch (filter) {
    case "all":
      return true;
    case "qualified":
      return finding.stage === "qualified";
    case "scored":
      return finding.stage === "scored";
    case "ignored":
      return finding.stage === "ignored";
  }
}
