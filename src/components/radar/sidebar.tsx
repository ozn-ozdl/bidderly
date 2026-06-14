"use client";

import Link from "next/link";
import { Radar, GitBranch, BellRing, BarChart3, Sparkles, MessagesSquare } from "lucide-react";
import { BrandMark } from "@/components/ui/brand";
import { defaultTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

export type SidebarKey = "radar" | "pipeline" | "approvals" | "negotiations" | "insights" | "pioneer";

type Item = {
  key: SidebarKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const items: Item[] = [
  { key: "radar", label: "Radar", icon: Radar },
  { key: "pipeline", label: "Pipeline", icon: GitBranch },
  { key: "approvals", label: "Approvals", icon: BellRing },
  { key: "negotiations", label: "Negotiations", icon: MessagesSquare },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "pioneer", label: "Pioneer", icon: Sparkles },
];

type RadarSidebarProps = {
  activeView: SidebarKey;
  onView: (key: SidebarKey) => void;
  pendingCount: number;
  lastRunId: string;
};

export function RadarSidebar({ activeView, onView, pendingCount, lastRunId }: RadarSidebarProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-rule bg-bg-elev lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-rule px-5">
          <Link href="/" aria-label="Bidderly.win home">
            <BrandMark theme={defaultTheme} size="sm" />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeView;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onView(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-ink text-bg"
                    : "text-ink-2 hover:bg-bg-sunk hover:text-ink",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-bg" : "text-ink-mute")} />
                <span className="flex-1 text-[13px] font-semibold">{item.label}</span>
                {item.key === "approvals" && pendingCount > 0 ? (
                  <span
                    className={cn(
                      "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold tnum",
                      active ? "bg-bg text-ink" : "bg-signal text-bg",
                    )}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-rule px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">Last run</div>
          <div className="mt-0.5 font-mono text-[11px] tnum text-ink-2">{lastRunId}</div>
        </div>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-rule bg-bg-elev/95 px-2 py-1.5 backdrop-blur lg:hidden"
        aria-label="Dashboard navigation"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.key === activeView;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onView(item.key)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-sm)] py-1.5 text-[10px] font-medium uppercase tracking-[0.1em]",
                active ? "text-ink" : "text-ink-mute",
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {item.key === "approvals" && pendingCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-signal px-1 text-[8px] font-bold text-bg">
                    {pendingCount}
                  </span>
                ) : null}
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
