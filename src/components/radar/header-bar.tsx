"use client";

import { BellRing, Play } from "lucide-react";
import Link from "next/link";
import type { RadarSnapshot } from "@/lib/radar-types";
import type { SidebarKey } from "./sidebar";

type RadarHeaderBarProps = {
  snapshot: RadarSnapshot;
  activeView: SidebarKey;
  pendingCount: number;
  isRunning: boolean;
  onRun: () => void;
  onBellClick: () => void;
  onHomeHref: string;
  authSlot: React.ReactNode;
};

const viewTitles: Partial<Record<SidebarKey, string>> = {
  radar: "Radar",
  approvals: "Approvals",
  negotiations: "Negotiations",
  settings: "Settings",
  pipeline: "Pipeline",
  insights: "Insights",
  pioneer: "Pioneer",
};

export function RadarHeaderBar({
  snapshot,
  activeView,
  pendingCount,
  isRunning,
  onRun,
  onBellClick,
  onHomeHref,
  authSlot,
}: RadarHeaderBarProps) {
  const title = viewTitles[activeView] ?? "Dashboard";

  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-rule bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={onHomeHref}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute hover:text-ink lg:hidden"
          >
            ← Site
          </Link>
          <div className="min-w-0 lg:hidden">
            <div className="truncate text-[14px] font-semibold text-ink">{title}</div>
          </div>
          <div className="hidden text-xs text-ink-mute lg:block">
            <span className="font-mono uppercase tracking-[0.18em]">Last run</span>
            <span className="ml-2 font-mono tnum text-ink-2">{snapshot.scoutRun.id}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {authSlot}
          <button
            type="button"
            onClick={onBellClick}
            aria-label="Open approvals"
            className="relative hidden h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-rule bg-bg-elev text-ink-2 hover:bg-bg-sunk hover:text-ink lg:flex"
          >
            <BellRing className="h-4 w-4" />
            {pendingCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-[9px] font-bold text-bg">
                {pendingCount}
              </span>
            ) : null}
          </button>
          {activeView === "radar" ? (
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-ink px-3 text-[12px] font-semibold text-bg hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-ink-faint disabled:text-ink-mute sm:px-3.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isRunning ? "Running" : "Run scout"}</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
