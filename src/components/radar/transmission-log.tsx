"use client";

import {
  BellRing,
  Database,
  FileSearch,
  Gauge,
  Radar,
  Route,
  Sparkles,
  X,
} from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { Card } from "@/components/ui/card";
import type { AgentEvent } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type TransmissionLogProps = {
  events: AgentEvent[];
};

const roleIcon: Record<AgentEvent["role"], React.ComponentType<{ className?: string }>> = {
  research_scout: Radar,
  extraction_agent: Database,
  scoring_router: Route,
  reasoning_agent: Sparkles,
  human_escalation_agent: BellRing,
};

const eventIcon: Record<AgentEvent["type"], React.ComponentType<{ className?: string }>> = {
  scout_started: Radar,
  finding_discovered: FileSearch,
  entities_extracted: Database,
  finding_scored: Route,
  gemini_analysis: Sparkles,
  approval_requested: BellRing,
  opportunity_created: Gauge,
  finding_ignored: X,
};

export function TransmissionLog({ events }: TransmissionLogProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Transmission log</SectionLabel>
          <p className="mt-2 text-[12px] text-ink-3">Live agent events. Click an event to inspect the related finding.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          <span className="h-1.5 w-1.5 rounded-full bg-good" style={{ animation: "blink 2s var(--ease) infinite" }} />
          streaming
        </span>
      </div>

      <ol className="divide-y divide-rule">
        {events.slice(0, 10).map((event) => {
          const EventIcon = eventIcon[event.type];
          const RoleIcon = roleIcon[event.role];
          const ignored = event.type === "finding_ignored";
          return (
            <li
              key={event.id}
              className={cn(
                "flex items-start gap-3 px-5 py-3",
                ignored && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border",
                  event.type === "approval_requested"
                    ? "border-warn-soft bg-warn-soft text-warn"
                    : event.type === "gemini_analysis"
                      ? "border-accent-soft bg-accent-soft text-accent-deep"
                      : "border-rule bg-bg-sunk text-ink-2",
                )}
              >
                <EventIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
                  <span>{event.title}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
                    <RoleIcon className="h-2.5 w-2.5" />
                    {event.role.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-3">{event.detail}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  {formatTime(event.at)}
                </div>
                {event.findingId ? (
                  <div className="mt-0.5 font-mono text-[10px] text-ink-faint">{event.findingId.replace("find_", "#")}</div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}
