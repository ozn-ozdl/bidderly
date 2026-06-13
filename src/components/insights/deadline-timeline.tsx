"use client";

import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { Opportunity, RadarSnapshot } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type DeadlineTimelineProps = {
  snapshot: RadarSnapshot;
  /** Number of days to show from today. Default 14. */
  windowDays?: number;
};

const STATUS_COLOR: Record<Opportunity["status"], string> = {
  blocked: "var(--warn)",
  ready_for_outreach: "var(--good)",
  monitoring: "var(--info)",
  new: "var(--accent)",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(s: string): Date | null {
  // YYYY-MM-DD — treat as midnight UTC for stable math.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00Z`);
  }
  // Fallback: ISO8601.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function DeadlineTimeline({ snapshot, windowDays = 14 }: DeadlineTimelineProps) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = today.getTime() + windowDays * DAY_MS;

  type Point = { opp: Opportunity; date: Date; daysOut: number; urgent: boolean };
  const points: Point[] = [];

  for (const opp of snapshot.opportunities) {
    const d = parseDate(opp.deadline);
    if (!d) continue;
    const t = d.getTime();
    if (t < today.getTime() - DAY_MS) continue; // skip long-past
    if (t > end) continue; // skip beyond the window
    const daysOut = Math.round((t - today.getTime()) / DAY_MS);
    points.push({ opp, date: d, daysOut, urgent: daysOut <= 3 });
  }

  points.sort((a, b) => a.daysOut - b.daysOut);

  const ticks: { label: string; offset: number }[] = [];
  for (let i = 0; i <= windowDays; i += 2) {
    const d = new Date(today.getTime() + i * DAY_MS);
    ticks.push({
      label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
      offset: i,
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Deadlines ahead</SectionLabel>
          <p className="mt-2 text-[13px] text-ink-3">
            Next {windowDays} days · {points.length} tender{points.length === 1 ? "" : "s"} due
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          Today
        </div>
      </div>

      <div className="p-5">
        {points.length === 0 ? (
          <p className="text-[13px] text-ink-mute">No upcoming deadlines in this window.</p>
        ) : (
          <>
            <div className="relative h-20">
              {/* axis */}
              <div className="absolute inset-x-0 top-9 h-px bg-rule" />
              {/* today marker */}
              <div className="absolute top-7 h-3 w-px bg-ink-2" />

              {points.map((p, i) => {
                const left = (p.daysOut / windowDays) * 100;
                return (
                  <div
                    key={p.opp.id}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${Math.min(100, Math.max(0, left))}%`, top: 0 }}
                  >
                    <div
                      className={cn(
                        "h-3 w-3 rounded-full border-2 border-bg",
                        p.urgent ? "ring-2 ring-warn/40" : "",
                      )}
                      style={{ background: STATUS_COLOR[p.opp.status] }}
                      title={`${p.opp.title} — ${p.opp.deadline}`}
                    />
                    <div className="mt-1.5 w-32 -translate-x-1/2 absolute left-1/2 text-center">
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                        {p.daysOut === 0 ? "Today" : p.daysOut === 1 ? "Tomorrow" : `+${p.daysOut}d`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* axis labels */}
            <div className="relative mt-3 h-4">
              {ticks.map((t) => (
                <div
                  key={t.label}
                  className="absolute -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
                  style={{ left: `${(t.offset / windowDays) * 100}%` }}
                >
                  {t.label}
                </div>
              ))}
            </div>

            {/* legend list */}
            <ul className="mt-5 space-y-1.5">
              {points.map((p) => (
                <li key={p.opp.id} className="flex items-center gap-3 text-[13px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_COLOR[p.opp.status] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.opp.title}</span>
                  <span className="font-mono text-[11px] tnum text-ink-2">
                    {p.opp.deadline}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                    {p.daysOut === 0 ? "Today" : `+${p.daysOut}d`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
