"use client";

import { useEffect, useMemo, useState } from "react";
import { Show, UserButton } from "@clerk/nextjs";
import { BellRing, UserRound } from "lucide-react";

import type {
  AgentEvent,
  ApprovalRequest,
  RadarSnapshot,
} from "@/lib/radar-types";
import type { IntegrationStatus } from "@/lib/env";

import { RadarSidebar, type SidebarKey } from "./sidebar";
import { RadarHeaderBar } from "./header-bar";
import { RadarMetricStrip } from "./metric-strip";
import { RadarView } from "./views/radar-view";
import { PipelineView } from "./views/pipeline-view";
import { ApprovalsView } from "./views/approvals-view";
import { FindingDrawer } from "./finding-drawer";
import { ApprovalToast } from "./approval-toast";

type RadarShellProps = {
  initialSnapshot: RadarSnapshot;
  integrationStatus: IntegrationStatus;
};

type ApprovalStatus = ApprovalRequest["status"];

export function RadarShell({ initialSnapshot, integrationStatus }: RadarShellProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>(initialSnapshot.events);
  const [selectedFindingId, setSelectedFindingId] = useState(
    initialSnapshot.findings[0]?.id ?? "",
  );
  const [isRunning, setIsRunning] = useState(false);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, ApprovalStatus>>({});
  const [activeView, setActiveView] = useState<SidebarKey>("radar");
  const [dismissedToastId, setDismissedToastId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pendingApprovals = useMemo(
    () =>
      snapshot.approvals.filter(
        (approval) => (approvalStatuses[approval.id] ?? approval.status) === "pending",
      ),
    [snapshot.approvals, approvalStatuses],
  );

  const approvalByFinding = useMemo(() => {
    const map = new Map<string, ApprovalRequest>();
    snapshot.approvals.forEach((a) => map.set(a.findingId, a));
    return map;
  }, [snapshot.approvals]);

  const toastApproval = useMemo(() => {
    if (pendingApprovals.length === 0) return undefined;
    if (dismissedToastId && pendingApprovals.some((a) => a.id === dismissedToastId)) {
      return pendingApprovals.find((a) => a.id === dismissedToastId);
    }
    return pendingApprovals[0];
  }, [pendingApprovals, dismissedToastId]);

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
        setDismissedToastId(null);
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

    eventSource.addEventListener("complete", () => eventSource.close());
    eventSource.onerror = () => eventSource.close();

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setDismissedToastId(null);
      } else if (e.key.toLowerCase() === "a") {
        const target = pendingApprovals[0];
        if (target) updateApproval(target.id, "approved");
      } else if (e.key.toLowerCase() === "i") {
        const target = pendingApprovals[0];
        if (target) updateApproval(target.id, "needs_info");
      } else if (e.key.toLowerCase() === "r" && !isRunning) {
        void runScout();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = snapshot.findings.findIndex((f) => f.id === selectedFindingId);
        const next = snapshot.findings[Math.min(idx + 1, snapshot.findings.length - 1)];
        if (next) setSelectedFindingId(next.id);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = snapshot.findings.findIndex((f) => f.id === selectedFindingId);
        const next = snapshot.findings[Math.max(idx - 1, 0)];
        if (next) setSelectedFindingId(next.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pendingApprovals, snapshot.findings, selectedFindingId, isRunning]);

  async function runScout() {
    setIsRunning(true);
    try {
      const response = await fetch("/api/scout-run", { method: "POST" });
      const payload = (await response.json()) as { snapshot: RadarSnapshot };
      setSnapshot(payload.snapshot);
      setLiveEvents(payload.snapshot.events);
      setSelectedFindingId(payload.snapshot.findings[0]?.id ?? "");
    } finally {
      window.setTimeout(() => setIsRunning(false), 700);
    }
  }

  function updateApproval(id: string, status: ApprovalStatus) {
    setApprovalStatuses((current) => ({ ...current, [id]: status }));
  }

  const selectedBundle = useMemo(() => getBundle(snapshot, selectedFindingId), [
    snapshot,
    selectedFindingId,
  ]);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="flex min-h-screen">
        <RadarSidebar
          activeView={activeView}
          onView={setActiveView}
          pendingCount={pendingApprovals.length}
        />

        <main className="min-w-0 flex-1">
          <RadarHeaderBar
            snapshot={snapshot}
            pendingCount={pendingApprovals.length}
            isRunning={isRunning}
            onRun={runScout}
            onBellClick={() => setActiveView("approvals")}
            onHomeHref="/"
            authSlot={<AuthControls clerkConfigured={integrationStatus.clerk} />}
          />

          <div className="mx-auto w-full max-w-[1480px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
            <RadarMetricStrip snapshot={snapshot} pendingApprovals={pendingApprovals} />

            {activeView === "radar" ? (
              <RadarView
                snapshot={snapshot}
                selectedFindingId={selectedFindingId}
                onSelect={(id) => {
                  setSelectedFindingId(id);
                  setDrawerOpen(true);
                }}
                approvalStatuses={approvalStatuses}
                onApprovalChange={updateApproval}
              />
            ) : null}

            {activeView === "pipeline" ? (
              <PipelineView
                snapshot={snapshot}
                liveEvents={liveEvents}
                approvalByFinding={approvalByFinding}
              />
            ) : null}

            {activeView === "approvals" ? (
              <ApprovalsView
                approvals={snapshot.approvals}
                approvalStatuses={approvalStatuses}
                onApprovalChange={updateApproval}
                findings={snapshot.findings}
              />
            ) : null}
          </div>
        </main>
      </div>

      {selectedBundle ? (
        <FindingDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          bundle={selectedBundle}
          approvalStatus={
            selectedBundle.approval
              ? approvalStatuses[selectedBundle.approval.id] ?? selectedBundle.approval.status
              : undefined
          }
          onApprovalChange={updateApproval}
        />
      ) : null}

      {toastApproval ? (
        <ApprovalToast
          approval={toastApproval}
          onApprove={() => updateApproval(toastApproval.id, "approved")}
          onNeedsInfo={() => updateApproval(toastApproval.id, "needs_info")}
          onDismiss={() => setDismissedToastId(toastApproval.id)}
        />
      ) : null}

      {pendingApprovals.length > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-rule bg-bg-elev/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute shadow-[var(--shadow-1)] backdrop-blur sm:flex">
          <BellRing className="h-3 w-3" />
          <span>
            {pendingApprovals.length} pending · press A to approve · I for info
          </span>
        </div>
      ) : null}
    </div>
  );
}

function AuthControls({ clerkConfigured }: { clerkConfigured: boolean }) {
  if (!clerkConfigured) {
    return (
      <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute sm:inline-flex">
        <UserRound className="h-3 w-3" />
        demo@bidderly.win
      </span>
    );
  }
  return (
    <Show when="signed-in">
      <div className="flex h-9 items-center rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-2">
        <UserButton />
      </div>
    </Show>
  );
}

export type Bundle = {
  finding: RadarSnapshot["findings"][number];
  extraction?: RadarSnapshot["extractions"][number];
  score?: RadarSnapshot["scores"][number];
  gemini?: RadarSnapshot["geminiAnalyses"][number];
  opportunity?: RadarSnapshot["opportunities"][number];
  approval?: ApprovalRequest;
};

function getBundle(snapshot: RadarSnapshot, findingId: string): Bundle | null {
  const finding = snapshot.findings.find((item) => item.id === findingId);
  if (!finding) return null;
  return {
    finding,
    extraction: snapshot.extractions.find((item) => item.findingId === findingId),
    score: snapshot.scores.find((item) => item.findingId === findingId),
    gemini: snapshot.geminiAnalyses.find((item) => item.findingId === findingId),
    opportunity: snapshot.opportunities.find((item) => item.findingId === findingId),
    approval: snapshot.approvals.find((item) => item.findingId === findingId),
  };
}
