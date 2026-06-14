"use client";

import Link from "next/link";
import { Radar, BellRing, MessagesSquare, Settings, GitBranch, BarChart3, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/ui/brand";
import { defaultTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

export type SidebarKey =
  | "radar"
  | "approvals"
  | "negotiations"
  | "settings"
  | "pipeline"
  | "insights"
  | "pioneer";

type PrimaryKey = "radar" | "approvals" | "negotiations" | "settings";

type Item = {
  key: PrimaryKey;
  label: string;
  shortLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
};

const primaryItems: Item[] = [
  { key: "radar", label: "Radar", icon: Radar },
  { key: "approvals", label: "Approvals", icon: BellRing },
  { key: "negotiations", label: "Negotiations", shortLabel: "Deals", icon: MessagesSquare },
  { key: "settings", label: "Settings", icon: Settings },
];

const advancedItems: { key: SidebarKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pipeline", label: "Pipeline", icon: GitBranch },
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
  const isAdvanced = advancedItems.some((item) => item.key === activeView);

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-rule bg-bg-elev lg:flex">
        <div className="flex h-14 items-center gap-3 border-b border-rule px-5">
          <Link href="/" aria-label="Bidderly.win home">
            <BrandMark theme={defaultTheme} size="sm" />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {primaryItems.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={activeView === item.key}
              pendingCount={pendingCount}
              onClick={() => onView(item.key)}
            />
          ))}

          <div className="my-3 h-px bg-rule" />
          <div className="px-3 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-mute">
            Advanced
          </div>
          {advancedItems.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeView;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onView(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors",
                  active ? "bg-bg-sunk text-ink" : "text-ink-2 hover:bg-bg-sunk hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-ink-mute" />
                <span className="text-[13px] font-medium">{item.label}</span>
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
        className="pb-safe fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-rule bg-bg-elev/95 px-1 pt-1.5 backdrop-blur lg:hidden"
        aria-label="Dashboard navigation"
      >
        {primaryItems.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={activeView === item.key || (item.key === "settings" && isAdvanced)}
            pendingCount={pendingCount}
            onClick={() => onView(item.key)}
            mobile
          />
        ))}
      </nav>
    </>
  );
}

function NavButton({
  item,
  active,
  pendingCount,
  onClick,
  mobile,
}: {
  item: Item;
  active: boolean;
  pendingCount: number;
  onClick: () => void;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  const label = mobile && item.shortLabel ? item.shortLabel : item.label;

  if (mobile) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1 text-[10px] font-semibold",
          active ? "text-ink" : "text-ink-mute",
        )}
        aria-current={active ? "page" : undefined}
      >
        <span className="relative">
          <Icon className="h-5 w-5" />
          {item.key === "approvals" && pendingCount > 0 ? (
            <span className="absolute -right-1.5 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-signal px-0.5 text-[8px] font-bold text-bg">
              {pendingCount}
            </span>
          ) : null}
        </span>
        <span className="max-w-full truncate">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition-colors",
        active ? "bg-ink text-bg" : "text-ink-2 hover:bg-bg-sunk hover:text-ink",
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
}
