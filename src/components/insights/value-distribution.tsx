"use client";

import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { VALUE_BUCKETS, bucketForValue, parseValueBandM } from "@/lib/geo";
import type { Opportunity, RadarSnapshot } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type ValueDistributionProps = {
  snapshot: RadarSnapshot;
};

const STATUS_COLOR: Record<Opportunity["status"], string> = {
  blocked: "var(--warn)",
  ready_for_outreach: "var(--good)",
  monitoring: "var(--info)",
  new: "var(--accent)",
};

export function ValueDistribution({ snapshot }: ValueDistributionProps) {
  type Row = { bucket: string; count: number; valueM: number; status: Opportunity["status"] };
  const rows: Row[] = VALUE_BUCKETS.map((bucket) => {
    const inBucket = snapshot.opportunities.filter(
      (o) => bucketForValue(parseValueBandM(o.valueBand)) === bucket,
    );
    return {
      bucket,
      count: inBucket.length,
      valueM: inBucket.reduce((acc, o) => acc + (parseValueBandM(o.valueBand) ?? 0), 0),
      // representative status (mode) for the bar tint
      status: (inBucket[0]?.status ?? "new") as Opportunity["status"],
    };
  });

  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const totalValueM = rows.reduce((acc, r) => acc + r.valueM, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Value distribution</SectionLabel>
          <p className="mt-2 text-[13px] text-ink-3">
            Indicative value band of qualified opportunities · {snapshot.opportunities.length} total
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            Indicative
          </div>
          <div className="font-display text-xl tracking-display tnum text-ink">
            €{totalValueM}M+
          </div>
        </div>
      </div>

      <div className="space-y-3 p-5">
        {rows.map((r) => {
          const widthPct = (r.count / maxCount) * 100;
          return (
            <div key={r.bucket} className="grid grid-cols-[88px_minmax(0,1fr)_60px] items-center gap-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {r.bucket}
              </div>
              <div className="relative h-7 rounded-[var(--radius-sm)] bg-bg-sunk/60">
                <div
                  className={cn(
                    "h-full rounded-[var(--radius-sm)] transition-all",
                    r.count === 0 && "opacity-30",
                  )}
                  style={{
                    width: `${widthPct}%`,
                    background: STATUS_COLOR[r.status],
                    minWidth: r.count > 0 ? "8px" : "0",
                  }}
                />
                {r.count > 0 && widthPct < 30 ? (
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold tnum text-ink">
                    {r.count}
                  </span>
                ) : null}
              </div>
              <div className="text-right font-mono text-[12px] tnum text-ink-2">
                {r.count > 0 ? (
                  <>
                    {r.count}
                    <span className="ml-1 text-[10px] text-ink-mute">×</span>
                  </>
                ) : (
                  <span className="text-ink-mute">0</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
