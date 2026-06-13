"use client";

import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { HOME_BASE, MAP_VIEW, coordsForLocation, formatDistance, haversineKm, project } from "@/lib/geo";
import type { Opportunity, RadarSnapshot } from "@/lib/radar-types";
import { cn } from "@/lib/cn";

type TenderMapProps = {
  snapshot: RadarSnapshot;
  homeLabel?: string;
};

const PIN_COLORS: Record<Opportunity["status"], string> = {
  blocked: "var(--warn)",
  ready_for_outreach: "var(--good)",
  monitoring: "var(--info)",
  new: "var(--accent)",
};

const STATUS_LABEL: Record<Opportunity["status"], string> = {
  blocked: "Blocked",
  ready_for_outreach: "Ready",
  monitoring: "Monitoring",
  new: "New",
};

function pinRadius(valueM: number | null): number {
  if (valueM == null) return 4;
  if (valueM >= 10) return 9;
  if (valueM >= 5) return 7;
  if (valueM >= 2) return 6;
  return 5;
}

export function TenderMap({ snapshot, homeLabel = "Bidderly HQ · Munich" }: TenderMapProps) {
  const home = project(HOME_BASE);

  const pins = snapshot.opportunities
    .map((opp) => {
      const finding = snapshot.findings.find((f) => f.id === opp.findingId);
      const extraction = snapshot.extractions.find((e) => e.findingId === opp.findingId);
      const location = extraction?.entities.location ?? finding?.title.split(" ").slice(-1)[0];
      const coords = coordsForLocation(location);
      if (!coords) return null;
      const valueText = opp.valueBand;
      const m = Number(valueText.match(/(\d+(?:\.\d+)?)\s*M/i)?.[1] ?? 0) || null;
      return {
        opp,
        location: location ?? "—",
        coords,
        distance: Math.round(haversineKm(HOME_BASE, coords)),
        valueM: m,
        ...project(coords),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.distance - b.distance);

  const nearest = pins.slice(0, 3);

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-4">
        <div>
          <SectionLabel>Tender map</SectionLabel>
          <p className="mt-2 text-[13px] text-ink-3">
            {pins.length} qualified tender{pins.length === 1 ? "" : "s"} · distance from {homeLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          <LegendDot color="var(--warn)" label="Blocked" />
          <LegendDot color="var(--good)" label="Ready" />
          <LegendDot color="var(--info)" label="Monitoring" />
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative rounded-[var(--radius-sm)] bg-bg-sunk/40 p-3">
          <svg
            viewBox={`0 0 ${MAP_VIEW.width} ${MAP_VIEW.height}`}
            className="block h-auto w-full"
            role="img"
            aria-label="Map of qualified tenders relative to your office"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--rule)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={MAP_VIEW.width} height={MAP_VIEW.height} fill="url(#grid)" />

            {/* Connection lines from home to each pin */}
            {pins.map((p, i) => (
              <line
                key={`line-${i}`}
                x1={home.x}
                y1={home.y}
                x2={p.x}
                y2={p.y}
                stroke="var(--rule)"
                strokeWidth="0.6"
                strokeDasharray="2 3"
              />
            ))}

            {/* Home pin */}
            <g>
              <circle cx={home.x} cy={home.y} r="8" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.5" />
              <circle cx={home.x} cy={home.y} r="3" fill="var(--ink)" />
              <text
                x={home.x + 12}
                y={home.y + 3}
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                fill="var(--ink-2)"
                style={{ letterSpacing: "0.08em" }}
              >
                HOME
              </text>
            </g>

            {/* Tender pins */}
            {pins.map((p, i) => (
              <g key={`pin-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={pinRadius(p.valueM)}
                  fill={PIN_COLORS[p.opp.status]}
                  fillOpacity="0.35"
                  stroke={PIN_COLORS[p.opp.status]}
                  strokeWidth="1.5"
                />
                <text
                  x={p.x + pinRadius(p.valueM) + 4}
                  y={p.y + 3}
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                  fill="var(--ink)"
                >
                  {formatDistance(p.distance)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <ul className="space-y-2">
          {nearest.length === 0 ? (
            <li className="text-[13px] text-ink-mute">No geocoded tenders in this snapshot.</li>
          ) : (
            nearest.map((p) => (
              <li
                key={p.opp.id}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-3 py-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: PIN_COLORS[p.opp.status] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{p.opp.title}</div>
                  <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                    {p.location} · {STATUS_LABEL[p.opp.status]}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[12px] font-semibold tnum text-ink">
                    {formatDistance(p.distance)}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                    {p.valueM != null ? `€${p.valueM}M+` : "—"}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
