"use client";

import { BellRing, Play } from "lucide-react";
import Link from "next/link";
import type { RadarSnapshot } from "@/lib/radar-types";

type RadarHeaderBarProps = {
  snapshot: RadarSnapshot;
  pendingCount: number;
  isRunning: boolean;
  onRun: () => void;
  onBellClick: () => void;
  onHomeHref: string;
  authSlot: React.ReactNode;
};

export function RadarHeaderBar({
  snapshot,
  pendingCount,
  isRunning,
  onRun,
  onBellClick,
  onHomeHref,
  authSlot,
}: RadarHeaderBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={onHomeHref}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute hover:text-ink lg:hidden"
          >
            ← Site
          </Link>
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
            className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-rule bg-bg-elev text-ink-2 hover:bg-bg-sunk hover:text-ink"
          >
            <BellRing className="h-4 w-4" />
            {pendingCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-[9px] font-bold text-bg">
                {pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-ink px-3.5 text-[12px] font-semibold text-bg hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-ink-faint disabled:text-ink-mute"
          >
            <Play className="h-3.5 w-3.5" />
            {isRunning ? "Running" : "Run scout"}
          </button>
        </div>
      </div>
    </header>
  );
}
