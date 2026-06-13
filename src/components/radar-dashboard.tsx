"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Bot,
  CheckCircle2,
  CircleDot,
  Database,
  FileSearch,
  Gauge,
  Globe2,
  Layers3,
  LockKeyhole,
  Play,
  Radar,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  AgentEvent,
  ApprovalRequest,
  Extraction,
  Finding,
  GeminiAnalysis,
  ModelScore,
  Opportunity,
  RadarSnapshot,
  RouteDecision,
  Source,
  Urgency,
} from "@/lib/radar-types";
import type { IntegrationStatus } from "@/lib/env";

type RadarDashboardProps = {
  initialSnapshot: RadarSnapshot;
  integrationStatus: IntegrationStatus;
};

type ApprovalStatus = ApprovalRequest["status"];

const navItems = [
  { label: "Radar", icon: Radar },
  { label: "Sources", icon: Globe2 },
  { label: "Runs", icon: Activity },
  { label: "Opportunities", icon: Gauge },
  { label: "Approvals", icon: BellRing },
  { label: "Model Activity", icon: Bot },
  { label: "Settings", icon: Settings },
];

export function RadarDashboard({
  initialSnapshot,
  integrationStatus,
}: RadarDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedFindingId, setSelectedFindingId] = useState(
    initialSnapshot.findings[0]?.id ?? "",
  );
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>(initialSnapshot.events);
  const [isRunning, setIsRunning] = useState(false);
  const [approvalStatuses, setApprovalStatuses] = useState<
    Record<string, ApprovalStatus>
  >({});
  const [showAlert, setShowAlert] = useState(false);

  const selectedBundle = useMemo(
    () => getBundle(snapshot, selectedFindingId),
    [snapshot, selectedFindingId],
  );

  const pendingApprovals = snapshot.approvals.filter(
    (approval) => (approvalStatuses[approval.id] ?? approval.status) === "pending",
  );

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    const addEvent = (event: MessageEvent<string>) => {
      const agentEvent = JSON.parse(event.data) as AgentEvent;

      setLiveEvents((current) => [
        agentEvent,
        ...current.filter((item) => item.id !== agentEvent.id),
      ]);

      if (agentEvent.findingId) {
        setSelectedFindingId(agentEvent.findingId);
      }

      if (agentEvent.type === "approval_requested") {
        setShowAlert(true);
      }
    };

    [
      "scout_started",
      "finding_discovered",
      "entities_extracted",
      "finding_scored",
      "gemini_analysis",
      "approval_requested",
    ].forEach((eventName) => {
      eventSource.addEventListener(eventName, addEvent);
    });

    eventSource.addEventListener("complete", () => {
      eventSource.close();
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  async function runScout() {
    setIsRunning(true);

    try {
      const response = await fetch("/api/scout-run", { method: "POST" });
      const payload = (await response.json()) as { snapshot: RadarSnapshot };

      setSnapshot(payload.snapshot);
      setLiveEvents(payload.snapshot.events);
      setSelectedFindingId(payload.snapshot.findings[0]?.id ?? "");
      setShowAlert(true);
    } finally {
      window.setTimeout(() => setIsRunning(false), 700);
    }
  }

  function updateApproval(id: string, status: ApprovalStatus) {
    setApprovalStatuses((current) => ({ ...current, [id]: status }));
    setShowAlert(false);
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d3b46] text-white">
              <Radar size={19} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Bidderly.win</div>
              <div className="font-mono text-[11px] uppercase text-slate-500">
                Opportunity radar
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const active = index === 0;

              return (
                <button
                  key={item.label}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                  type="button"
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                <ShieldCheck size={16} />
                Pioneer cascade
              </div>
              <div className="mt-2 font-mono text-[11px] leading-5 text-teal-800">
                GLiNER2 -&gt; Gemma 4 -&gt; Gemini
              </div>
              <div className="mt-2 rounded-md bg-white/70 px-2 py-1 font-mono text-[10px] uppercase text-teal-900">
                {integrationStatus.mode.replace("-", " ")}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
                  <CircleDot className="text-teal-600" size={13} />
                  Live radar feed
                </div>
                <h1 className="truncate text-xl font-semibold tracking-tight">
                  Opportunity Radar
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label="Open approvals"
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setShowAlert(true)}
                >
                  <BellRing size={17} />
                  {pendingApprovals.length > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[10px] font-bold text-white">
                      {pendingApprovals.length}
                    </span>
                  ) : null}
                </button>
                <button
                  className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex"
                  type="button"
                >
                  <UserRound size={16} />
                  {integrationStatus.clerk ? "Clerk session" : "demo@bidderly.win"}
                </button>
                <button
                  className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isRunning}
                  type="button"
                  onClick={runScout}
                >
                  <Play size={15} />
                  {isRunning ? "Running" : "Run scout"}
                </button>
              </div>
            </div>
          </header>

          <section className="space-y-4 px-4 py-4 sm:px-6 lg:space-y-5 lg:py-5">
            <MetricStrip snapshot={snapshot} pendingApprovals={pendingApprovals} />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_430px]">
              <RadarFeed
                extractions={snapshot.extractions}
                findings={snapshot.findings}
                scores={snapshot.scores}
                selectedFindingId={selectedFindingId}
                onSelect={setSelectedFindingId}
              />
              {selectedBundle ? (
                <DetailPanel
                  approvalStatuses={approvalStatuses}
                  bundle={selectedBundle}
                  onApprovalChange={updateApproval}
                />
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
              <SourceHealth sources={snapshot.sources} />
              <ApprovalInbox
                approvals={snapshot.approvals}
                approvalStatuses={approvalStatuses}
                opportunities={snapshot.opportunities}
                onApprovalChange={updateApproval}
              />
            </div>

            <ActivityTimeline events={liveEvents} />
          </section>
        </main>
      </div>

      {showAlert && pendingApprovals.length > 0 ? (
        <ForegroundAlert
          approvals={pendingApprovals}
          onApprovalChange={updateApproval}
          onClose={() => setShowAlert(false)}
        />
      ) : null}
    </div>
  );
}

function MetricStrip({
  snapshot,
  pendingApprovals,
}: {
  snapshot: RadarSnapshot;
  pendingApprovals: ApprovalRequest[];
}) {
  const metrics = [
    {
      label: "Sources watched",
      value: snapshot.sources.length,
      sub: `${snapshot.scoutRun.sourcesScanned} scanned in last run`,
      icon: Globe2,
      tone: "text-teal-700",
    },
    {
      label: "Raw findings",
      value: snapshot.findings.length,
      sub: `${snapshot.extractions.length} structured by GLiNER2`,
      icon: FileSearch,
      tone: "text-slate-700",
    },
    {
      label: "Qualified",
      value: snapshot.opportunities.length,
      sub: "High-value opportunities",
      icon: Gauge,
      tone: "text-emerald-700",
    },
    {
      label: "Human decisions",
      value: pendingApprovals.length,
      sub: "Alert only when input is required",
      icon: BellRing,
      tone: "text-amber-700",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-500">
                  {metric.label}
                </div>
                <div className="mt-1 font-mono text-3xl font-semibold tracking-tight text-slate-950">
                  {metric.value}
                </div>
              </div>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 ${metric.tone}`}
              >
                <Icon size={17} />
              </div>
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500">{metric.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function RadarFeed({
  findings,
  extractions,
  scores,
  selectedFindingId,
  onSelect,
}: {
  findings: Finding[];
  extractions: Extraction[];
  scores: ModelScore[];
  selectedFindingId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Live radar feed</h2>
          <div className="text-xs font-medium text-slate-500">
            Watchlisted sources, Tavily enrichment, curated demo signals
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 sm:flex">
            <Search size={15} />
            Filter signals
          </div>
          <div className="flex h-9 items-center gap-2 rounded-lg bg-teal-50 px-3 text-sm font-semibold text-teal-800">
            <CircleDot size={13} />
            Live
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-collapse text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Finding</th>
              <th className="px-3 py-3 font-semibold">GLiNER entities</th>
              <th className="px-3 py-3 font-semibold">Clues</th>
              <th className="px-3 py-3 font-semibold">Gemma</th>
              <th className="px-4 py-3 font-semibold">Route</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {findings.map((finding) => {
              const extraction = extractions.find(
                (item) => item.findingId === finding.id,
              );
              const score = scores.find((item) => item.findingId === finding.id);
              const selected = selectedFindingId === finding.id;

              return (
                <tr
                  key={finding.id}
                  className={`cursor-pointer transition hover:bg-slate-50 ${
                    selected ? "bg-teal-50/70" : "bg-white"
                  }`}
                  onClick={() => onSelect(finding.id)}
                >
                  <td className="max-w-[360px] px-4 py-4 align-top">
                    <div className="font-medium leading-5 text-slate-950">
                      {finding.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{finding.sourceName}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{formatShortDate(finding.publishedAt)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="max-w-[260px] space-y-1 text-xs">
                      <EntityLine label="Buyer" value={extraction?.entities.buyerIssuer} />
                      <EntityLine
                        label="Deadline"
                        value={extraction?.entities.deadline}
                      />
                      <EntityLine label="Budget" value={extraction?.entities.budgetValue} />
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <div className="flex max-w-[240px] flex-wrap gap-1.5">
                      {extraction?.clueTags.slice(0, 4).map((tag) => (
                        <ClueTag key={tag} tag={tag} />
                      ))}
                      {extraction && extraction.clueTags.length === 0 ? (
                        <span className="text-xs text-slate-400">No clue</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-4 align-top">
                    {score ? (
                      <ScorePill score={score.worthOutreachScore} urgency={score.urgency} />
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top">
                    {score ? <RouteBadge route={score.route} /> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 lg:hidden">
        {findings.map((finding) => {
          const extraction = extractions.find((item) => item.findingId === finding.id);
          const score = scores.find((item) => item.findingId === finding.id);
          const selected = selectedFindingId === finding.id;

          return (
            <button
              key={finding.id}
              className={`w-full px-4 py-4 text-left ${
                selected ? "bg-teal-50" : "bg-white"
              }`}
              type="button"
              onClick={() => onSelect(finding.id)}
            >
              <div className="font-medium leading-5">{finding.title}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extraction?.clueTags.slice(0, 3).map((tag) => (
                  <ClueTag key={tag} tag={tag} />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{finding.sourceName}</span>
                {score ? <ScorePill score={score.worthOutreachScore} urgency={score.urgency} /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DetailPanel({
  bundle,
  approvalStatuses,
  onApprovalChange,
}: {
  bundle: Bundle;
  approvalStatuses: Record<string, ApprovalStatus>;
  onApprovalChange: (id: string, status: ApprovalStatus) => void;
}) {
  const approvalStatus = bundle.approval
    ? approvalStatuses[bundle.approval.id] ?? bundle.approval.status
    : undefined;
  const approval = bundle.approval;

  return (
    <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Opportunity detail</h2>
            <div className="mt-1 font-mono text-[11px] uppercase text-slate-500">
              {bundle.finding.id}
            </div>
          </div>
          {bundle.score ? <RouteBadge route={bundle.score.route} /> : null}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h3 className="text-lg font-semibold leading-6">{bundle.finding.title}</h3>
          <a
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-900"
            href={bundle.finding.url}
          >
            Source record
            <ArrowUpRight size={14} />
          </a>
        </div>

        <Pipeline />

        {bundle.extraction ? <ExtractionPanel extraction={bundle.extraction} /> : null}

        {bundle.score ? <ScorePanel score={bundle.score} /> : null}

        {bundle.gemini ? <GeminiPanel analysis={bundle.gemini} /> : null}

        {bundle.opportunity ? <OpportunityPanel opportunity={bundle.opportunity} /> : null}

        {approval ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                <BellRing size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-amber-950">{approval.title}</div>
                <p className="mt-1 text-sm leading-5 text-amber-900">
                  {approval.requestedAction}
                </p>
                <div className="mt-2 font-mono text-[11px] uppercase text-amber-800">
                  Due {formatShortDate(approval.dueAt)} · {approvalStatus}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="h-9 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                    disabled={approvalStatus !== "pending"}
                    type="button"
                    onClick={() => onApprovalChange(approval.id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className="h-9 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:text-slate-400"
                    disabled={approvalStatus !== "pending"}
                    type="button"
                    onClick={() => onApprovalChange(approval.id, "needs_info")}
                  >
                    Request info
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Pipeline() {
  const stages = [
    { label: "GLiNER2", icon: Layers3, sub: "Entities" },
    { label: "Gemma 4", icon: Route, sub: "Score" },
    { label: "Gemini", icon: Sparkles, sub: "Reason" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stages.map((stage) => {
        const Icon = stage.icon;

        return (
          <div
            key={stage.label}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon size={15} />
              {stage.label}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase text-slate-500">
              {stage.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExtractionPanel({ extraction }: { extraction: Extraction }) {
  const entityRows: Array<[string, string | undefined]> = [
    ["Buyer", extraction.entities.buyerIssuer],
    ["Project", extraction.entities.projectName],
    ["Category", extraction.entities.category],
    ["Location", extraction.entities.location],
    ["Deadline", extraction.entities.deadline],
    ["Budget", extraction.entities.budgetValue],
    ["Contact", extraction.entities.contactPersona],
  ];

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Database size={16} />
          GLiNER extraction
        </div>
        <div className="font-mono text-xs font-semibold text-teal-700">
          {Math.round(extraction.confidence * 100)}%
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {entityRows.map(([label, value]) =>
          value ? <EntityLine key={label} label={label} value={value} /> : null,
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {extraction.clueTags.map((tag) => (
          <ClueTag key={tag} tag={tag} />
        ))}
      </div>
    </div>
  );
}

function ScorePanel({ score }: { score: ModelScore }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Bot size={16} />
          Gemma 4 route
        </div>
        <ScorePill score={score.worthOutreachScore} urgency={score.urgency} />
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-600">{score.rationale}</p>
    </div>
  );
}

function GeminiPanel({ analysis }: { analysis: GeminiAnalysis }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles size={16} />
        Gemini analysis
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-600">{analysis.summary}</p>
      <div className="mt-3 space-y-2">
        {analysis.recommendedNextSteps.slice(0, 3).map((step) => (
          <div key={step} className="flex gap-2 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={15} />
            <span>{step}</span>
          </div>
        ))}
      </div>
      {analysis.blocker ? (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={15} />
          <span>{analysis.blocker}</span>
        </div>
      ) : null}
    </div>
  );
}

function OpportunityPanel({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <Gauge size={16} />
          Opportunity
        </div>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
          {opportunity.valueBand}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <EntityLine label="Owner" value={opportunity.owner} />
        <EntityLine label="Deadline" value={opportunity.deadline} />
      </div>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">
        {opportunity.nextAction}
      </div>
    </div>
  );
}

function SourceHealth({ sources }: { sources: Source[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight">Watched sources</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {sources.map((source) => (
          <div
            key={source.id}
            className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_120px]"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{source.name}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{source.url}</div>
            </div>
            <div className="text-sm text-slate-600">{source.cadence}</div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <StatusPill status={source.status} />
              <span className="font-mono text-xs text-slate-500">
                {source.findingsToday} today
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ApprovalInbox({
  approvals,
  opportunities,
  approvalStatuses,
  onApprovalChange,
}: {
  approvals: ApprovalRequest[];
  opportunities: Opportunity[];
  approvalStatuses: Record<string, ApprovalStatus>;
  onApprovalChange: (id: string, status: ApprovalStatus) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight">Pending decisions</h2>
        <LockKeyhole className="text-amber-600" size={17} />
      </div>
      <div className="divide-y divide-slate-100">
        {approvals.map((approval) => {
          const opportunity = opportunities.find(
            (item) => item.id === approval.opportunityId,
          );
          const status = approvalStatuses[approval.id] ?? approval.status;

          return (
            <div key={approval.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{approval.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {opportunity?.buyer ?? "Unknown buyer"}
                  </div>
                </div>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  {status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-600">
                {approval.blocker}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="h-8 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                  disabled={status !== "pending"}
                  type="button"
                  onClick={() => onApprovalChange(approval.id, "approved")}
                >
                  Approve
                </button>
                <button
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
                  disabled={status !== "pending"}
                  type="button"
                  onClick={() => onApprovalChange(approval.id, "needs_info")}
                >
                  Request info
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActivityTimeline({ events }: { events: AgentEvent[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight">
          Model and agent activity
        </h2>
      </div>
      <div className="grid gap-0 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        {events.slice(0, 8).map((event) => (
          <div key={event.id} className="flex gap-3 px-4 py-3">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              {eventIcon(event.type)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{event.title}</div>
                <span className="font-mono text-[10px] uppercase text-slate-400">
                  {event.role.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-slate-600">{event.detail}</p>
              <div className="mt-1 font-mono text-[11px] text-slate-400">
                {formatShortDate(event.at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ForegroundAlert({
  approvals,
  onApprovalChange,
  onClose,
}: {
  approvals: ApprovalRequest[];
  onApprovalChange: (id: string, status: ApprovalStatus) => void;
  onClose: () => void;
}) {
  const approval = approvals[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-amber-300 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 bg-amber-500 px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <BellRing size={18} />
            </div>
            <div>
              <div className="font-semibold">Approval needed</div>
              <div className="font-mono text-[11px] uppercase text-amber-50">
                Foreground alert
              </div>
            </div>
          </div>
          <button
            aria-label="Close alert"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15"
            type="button"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        <div className="p-4">
          <div className="font-semibold text-slate-950">{approval.title}</div>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            {approval.requestedAction}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              type="button"
              onClick={() => onApprovalChange(approval.id, "approved")}
            >
              Approve
            </button>
            <button
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              type="button"
              onClick={() => onApprovalChange(approval.id, "needs_info")}
            >
              Request info
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScorePill({ score, urgency }: { score: number; urgency: Urgency }) {
  const tone =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
        ? "bg-teal-50 text-teal-700 border-teal-200"
        : score >= 35
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${tone}`}
    >
      <span className="font-mono text-sm font-bold">{score}</span>
      <span className="text-xs font-semibold">{urgency}</span>
    </div>
  );
}

function RouteBadge({ route }: { route: RouteDecision }) {
  const styles: Record<RouteDecision, string> = {
    human_review: "bg-amber-50 text-amber-700 border-amber-200",
    qualify: "bg-emerald-50 text-emerald-700 border-emerald-200",
    monitor: "bg-slate-50 text-slate-600 border-slate-200",
    ignore: "bg-zinc-50 text-zinc-500 border-zinc-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${styles[route]}`}
    >
      {route.replace("_", " ")}
    </span>
  );
}

function ClueTag({ tag }: { tag: string }) {
  const urgent = ["deadline_near", "login_required", "official_tender"].includes(tag);

  return (
    <span
      className={`rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase ${
        urgent ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {tag.replaceAll("_", " ")}
    </span>
  );
}

function EntityLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[70px_minmax(0,1fr)] gap-2 text-sm">
      <div className="text-xs font-medium uppercase text-slate-400">{label}</div>
      <div className="min-w-0 truncate font-medium text-slate-700">
        {value ?? "Unknown"}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Source["status"] }) {
  const tone: Record<Source["status"], string> = {
    healthy: "bg-emerald-50 text-emerald-700",
    degraded: "bg-amber-50 text-amber-700",
    blocked: "bg-rose-50 text-rose-700",
  };

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone[status]}`}>
      {status}
    </span>
  );
}

function eventIcon(type: AgentEvent["type"]) {
  const className = "h-4 w-4";

  switch (type) {
    case "scout_started":
      return <Radar className={className} />;
    case "finding_discovered":
      return <FileSearch className={className} />;
    case "entities_extracted":
      return <Database className={className} />;
    case "finding_scored":
      return <Route className={className} />;
    case "gemini_analysis":
      return <Sparkles className={className} />;
    case "approval_requested":
      return <BellRing className={className} />;
    case "opportunity_created":
      return <Gauge className={className} />;
    case "finding_ignored":
      return <X className={className} />;
  }
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

type Bundle = {
  finding: Finding;
  extraction?: Extraction;
  score?: ModelScore;
  gemini?: GeminiAnalysis;
  opportunity?: Opportunity;
  approval?: ApprovalRequest;
};

function getBundle(snapshot: RadarSnapshot, findingId: string): Bundle | null {
  const finding = snapshot.findings.find((item) => item.id === findingId);

  if (!finding) {
    return null;
  }

  return {
    finding,
    extraction: snapshot.extractions.find((item) => item.findingId === findingId),
    score: snapshot.scores.find((item) => item.findingId === findingId),
    gemini: snapshot.geminiAnalyses.find((item) => item.findingId === findingId),
    opportunity: snapshot.opportunities.find((item) => item.findingId === findingId),
    approval: snapshot.approvals.find((item) => item.findingId === findingId),
  };
}
