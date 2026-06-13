"use client";

import { SectionLabel } from "@/components/ui/section-label";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";
import type { Source } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type SourceHealthProps = {
  sources: Source[];
};

export function SourceHealth({ sources }: SourceHealthProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Sources watched</SectionLabel>
          <p className="mt-2 text-[12px] text-ink-3">{sources.length} watchlisted sources · public scope only</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          last refresh · 09:15
        </span>
      </div>
      <ul className="divide-y divide-rule">
        {sources.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-1 gap-3 px-5 py-3.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,120px)_minmax(0,80px)] sm:items-center sm:gap-4"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{s.name}</div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-ink-mute">{s.url}</div>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  s.status === "healthy" ? "bg-good" : s.status === "degraded" ? "bg-warn" : "bg-bad",
                )}
              />
              <span className="capitalize">{s.status}</span>
              <span className="text-ink-faint">·</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                {s.cadence}
              </span>
            </div>
            <div className="font-mono text-[11px] text-ink-3">{s.geography}</div>
            <div className="flex items-center gap-2 sm:justify-end">
              <Sparkline
                data={[1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, s.findingsToday]}
                width={60}
                height={16}
                stroke="var(--ink-mute)"
                className="text-ink-mute"
              />
              <span className="font-mono text-[12px] font-semibold tnum text-ink-2">
                {s.findingsToday}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
