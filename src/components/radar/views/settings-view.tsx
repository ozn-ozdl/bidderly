"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  GitBranch,
  Network,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/cn";
import type { IntegrationStatus } from "@/lib/env";
import type { AgentEvent } from "@/lib/radar-types";
import type { SidebarKey } from "../sidebar";

type SettingsViewProps = {
  integrationStatus: IntegrationStatus;
  connected: boolean;
  liveEvents: AgentEvent[];
  onResetApprovals: () => void;
  isResetting: boolean;
  onNavigate: (view: SidebarKey) => void;
  clerkConfigured: boolean;
};

export function SettingsView({
  integrationStatus,
  connected,
  liveEvents,
  onResetApprovals,
  isResetting,
  onNavigate,
  clerkConfigured,
}: SettingsViewProps) {
  const { user } = useUser();
  const [confirmReset, setConfirmReset] = useState(false);

  const name = user?.fullName ?? user?.firstName ?? "Guest";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Not signed in";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Settings</SectionLabel>
        <h1 className="mt-1 font-display text-2xl tracking-display sm:text-3xl">Account & system</h1>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <UserRound className="h-4 w-4 text-ink-mute" />
          Account
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-bg">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">{name}</div>
            <div className="truncate text-[12px] text-ink-3">{email}</div>
          </div>
          {clerkConfigured ? (
            <div className="flex h-9 items-center rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-2">
              <UserButton />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Network className="h-4 w-4 text-ink-mute" />
            System
          </div>
          <ModePill mode={integrationStatus.mode} />
        </div>
        <dl className="mt-4 space-y-2 text-[12px]">
          <DiagRow label="API" value="This deployment" mono />
          <DiagRow
            label="Realtime"
            value={process.env.NEXT_PUBLIC_REALTIME_URL ?? "SSE /api/events"}
            mono
          />
          <div className="flex items-center justify-between gap-3 py-1">
            <dt className="text-ink-3">Connection</dt>
            <dd
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
                connected ? "bg-good-soft text-good" : "bg-warn-soft text-warn",
              )}
            >
              {connected ? "Connected" : "Offline"}
            </dd>
          </div>
        </dl>
        <div className="my-4 h-px bg-rule" />
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
          Integrations
        </div>
        <div className="mt-3 space-y-1.5">
          <IntegrationRow label="Clerk" on={integrationStatus.clerk} />
          <IntegrationRow label="Database" on={integrationStatus.database} />
          <IntegrationRow label="Tavily" on={integrationStatus.tavily} />
          <IntegrationRow label="Pioneer GLiNER2" on={integrationStatus.pioneerGliner2} />
          <IntegrationRow label="Pioneer clues" on={integrationStatus.pioneerClues} />
          <IntegrationRow label="Pioneer scoring" on={integrationStatus.pioneerScoring} />
          <IntegrationRow label="Gemini" on={integrationStatus.gemini} />
          {integrationStatus.mockTenderBaseUrl ? (
            <DiagRow label="Mock portals" value={integrationStatus.mockTenderBaseUrl} mono />
          ) : null}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <CheckCircle2 className="h-4 w-4 text-ink-mute" />
          Approval queue
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          Sends every decision back to pending on the server and on this device.
        </p>
        {confirmReset ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-rule bg-bg-elev text-[13px] font-semibold text-ink-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResetting}
              onClick={() => {
                onResetApprovals();
                setConfirmReset(false);
              }}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[var(--radius-sm)] bg-bad text-[13px] font-semibold text-bg disabled:opacity-60"
            >
              {isResetting ? "Resetting…" : "Confirm reset"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-ink text-[13px] font-semibold text-bg hover:bg-ink-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset approvals
          </button>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <BellRing className="h-4 w-4 text-ink-mute" />
          Alerts
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          Pending approvals surface as a toast above the tab bar. Approve or request info from the
          Approvals tab or finding detail.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <Activity className="h-4 w-4 text-ink-mute" />
            Cascade log
          </div>
          <button
            type="button"
            onClick={() => onNavigate("pipeline")}
            className="text-[12px] font-semibold text-accent hover:text-accent-deep"
          >
            Full pipeline →
          </button>
        </div>
        <ul className="max-h-64 divide-y divide-rule overflow-y-auto">
          {liveEvents.slice(0, 12).map((event) => (
            <li key={event.id} className="px-5 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                {event.role.replaceAll("_", " ")} · {relativeTime(event.at)}
              </div>
              <div className="mt-0.5 text-[13px] font-semibold text-ink">{event.title}</div>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-3">{event.detail}</p>
            </li>
          ))}
          {liveEvents.length === 0 ? (
            <li className="px-5 py-8 text-center text-[12px] text-ink-mute">No events yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card className="p-5">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
          Advanced
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <AdvancedLink icon={GitBranch} label="Pipeline" onClick={() => onNavigate("pipeline")} />
          <AdvancedLink icon={BarChart3} label="Insights" onClick={() => onNavigate("insights")} />
          <AdvancedLink icon={Sparkles} label="Pioneer" onClick={() => onNavigate("pioneer")} />
        </div>
      </Card>
    </div>
  );
}

function ModePill({ mode }: { mode: IntegrationStatus["mode"] }) {
  const label =
    mode === "fixture" ? "sandbox" : mode === "live-ready" ? "production" : "partial live";
  return (
    <span className="rounded-full border border-rule bg-bg-sunk px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
      {label}
    </span>
  );
}

function DiagRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 text-right text-ink-2", mono && "font-mono text-[11px] break-all")}>
        {value}
      </dd>
    </div>
  );
}

function IntegrationRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-ink-3">{label}</span>
      <span
        className={cn(
          "font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
          on ? "text-good" : "text-ink-mute",
        )}
      >
        {on ? "On" : "Off"}
      </span>
    </div>
  );
}

function AdvancedLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-3 py-2.5 text-left text-[13px] font-semibold text-ink hover:border-rule-strong"
    >
      <Icon className="h-4 w-4 text-ink-mute" />
      {label}
    </button>
  );
}

function relativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
