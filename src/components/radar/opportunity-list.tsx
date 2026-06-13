"use client";

import { SectionLabel } from "@/components/ui/section-label";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, Gauge, Star } from "lucide-react";
import type { Opportunity } from "@/lib/radar-types";
import { useUserState } from "@/components/realtime/user-state-provider";
import { cn } from "@/lib/cn";

type OpportunityListProps = {
  opportunities: Opportunity[];
};

export function OpportunityList({ opportunities }: OpportunityListProps) {
  const { state, actions } = useUserState();
  const watchset = new Set(state.watchlist.map((w) => w.findingId));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Opportunities</SectionLabel>
          <p className="mt-2 text-[12px] text-ink-3">Qualified findings the cascade promoted</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          {opportunities.length} open
        </span>
      </div>
      <ul className="divide-y divide-rule">
        {opportunities.map((o) => {
          const watched = watchset.has(o.findingId);
          return (
            <li key={o.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-accent-soft bg-accent-soft text-accent-deep">
                  <Gauge className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    <span>{o.buyer}</span>
                    <span className="text-ink-faint">·</span>
                    <span className="font-mono tnum text-ink-3">{o.valueBand}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[14px] font-semibold">{o.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                    <span>Owner: {o.owner}</span>
                    <span className="text-ink-faint">·</span>
                    <span className="font-mono tnum">{o.deadline}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]",
                        o.status === "ready_for_outreach"
                          ? "border-good-soft bg-good-soft text-good"
                          : o.status === "blocked"
                            ? "border-warn-soft bg-warn-soft text-warn"
                            : "border-rule bg-bg-sunk text-ink-3",
                      )}
                    >
                      {o.status.replaceAll("_", " ")}
                    </span>
                    <span className="text-[12px] text-ink-2">{o.nextAction}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
                  aria-pressed={watched}
                  onClick={() => actions.toggleWatch(o.findingId, !watched)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
                    watched
                      ? "bg-accent-soft text-accent-deep"
                      : "text-ink-faint hover:bg-bg-sunk hover:text-ink",
                  )}
                >
                  <Star className={cn("h-3.5 w-3.5", watched && "fill-current")} />
                </button>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
