"use client";

import Link from "next/link";
import { Activity, BellRing, GitBranch, Radar } from "lucide-react";
import { BrandMark } from "@/components/ui/brand";
import { defaultTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

export type SidebarKey = "radar" | "pipeline" | "approvals";

type Item = {
  key: SidebarKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
};

const items: Item[] = [
  { key: "radar", label: "Radar", icon: Radar, hint: "Live findings" },
  { key: "pipeline", label: "Pipeline", icon: GitBranch, hint: "Sources · runs · events" },
  { key: "approvals", label: "Approvals", icon: BellRing, hint: "Human decisions" },
];

type RadarSidebarProps = {
  activeView: SidebarKey;
  onView: (key: SidebarKey) => void;
  pendingCount: number;
};

export function RadarSidebar({ activeView, onView, pendingCount }: RadarSidebarProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-rule bg-bg-elev lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-rule px-5">
          <Link href="/" aria-label="Bidderly.win home">
            <BrandMark theme={defaultTheme} size="sm" />
          </Link>
          <div className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            live
          </div>
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
                  "group flex w-full items-start gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-ink text-bg"
                    : "text-ink-2 hover:bg-bg-sunk hover:text-ink",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-bg" : "text-ink-mute")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[13px] font-semibold leading-tight">
                    {item.label}
                    {item.key === "approvals" && pendingCount > 0 ? (
                      <span
                        className={cn(
                          "ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold tnum",
                          active ? "bg-bg text-ink" : "bg-signal text-bg",
                        )}
                      >
                        {pendingCount}
                      </span>
                    ) : null}
                  </span>
                  {item.hint ? (
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px] leading-tight",
                        active ? "text-bg/70" : "text-ink-mute",
                      )}
                    >
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-rule px-3 py-3">
          <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk/60 p-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
              <Activity className="h-3 w-3" />
              pioneer cascade
            </div>
            <div className="mt-1.5 font-mono text-[11px] tnum text-ink-2">
              GLiNER2 → Gemma 4 → Gemini
            </div>
            <div className="mt-2 text-[10px] text-ink-mute">
              Gemini called on 2 / 18 findings today
            </div>
          </div>
        </div>
      </aside>

      <nav
        className="sticky bottom-0 z-20 flex items-center justify-around border-t border-rule bg-bg-elev/95 px-2 py-1.5 backdrop-blur lg:hidden"
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
