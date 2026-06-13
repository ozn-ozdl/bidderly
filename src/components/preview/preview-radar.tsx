"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand";
import { LedDot } from "@/components/ui/led-dot";
import type { ThemeId } from "@/lib/theme";
import type { ThemeMeta } from "@/lib/theme";

type NavKey = "radar" | "sources" | "runs" | "opportunities" | "approvals";

const navItems: { key: NavKey; label: string }[] = [
  { key: "radar", label: "Radar" },
  { key: "sources", label: "Sources" },
  { key: "runs", label: "Runs" },
  { key: "opportunities", label: "Opportunities" },
  { key: "approvals", label: "Approvals" },
];

type PreviewRadarProps = {
  theme: ThemeId;
  meta: ThemeMeta;
};

export function PreviewRadar({ theme, meta }: PreviewRadarProps) {
  const [active, setActive] = useState<NavKey>("radar");

  return (
    <div className="flex min-h-[680px] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-rule bg-bg-elev/60 px-5 py-3">
        <div className="flex items-center gap-6">
          <BrandMark theme={theme} size="md" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute md:inline">
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="good" size="xs" dot>
            live
          </Badge>
          <span className="hidden font-mono text-[10px] text-ink-mute md:inline">run_2026_06_13_0915</span>
        </div>
      </div>

      <div className="flex flex-1">
        <nav className="hidden w-48 shrink-0 border-r border-rule bg-bg-elev/40 px-3 py-5 md:block">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.key === active;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setActive(item.key)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
                      isActive
                        ? "bg-ink text-bg"
                        : "text-ink-3 hover:bg-bg-sunk hover:text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full",
                        isActive ? "bg-bg opacity-70" : "bg-ink-faint",
                      )}
                    />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-5">
          <PreviewRadarBody />
        </main>
      </div>
    </div>
  );
}

function PreviewRadarBody() {
  const findings = [
    {
      title: "EU regional digital public services framework",
      source: "TED EU tenders",
      buyer: "European Regional Innovation Office",
      deadline: "24 Jun 2026",
      budget: "EUR 12.0M",
      score: 94,
      urgency: "high",
      route: "human_review",
      tags: ["official_tender", "deadline_near", "budget_approved"],
    },
    {
      title: "Solar roofs and monitoring for Berlin civic buildings",
      source: "Berlin energy announcements",
      buyer: "Senatsverwaltung Berlin",
      deadline: "03 Jul 2026",
      budget: "EUR 4.8M",
      score: 76,
      urgency: "medium",
      route: "qualify",
      tags: ["pre_announcement", "budget_approved"],
    },
    {
      title: "Hamburg supplier day for citizen service kiosk software",
      source: "Hamburg Service vor Ort",
      buyer: "Hamburg Service vor Ort",
      deadline: "19 Jun 2026",
      budget: "—",
      score: 64,
      urgency: "medium",
      route: "qualify",
      tags: ["supplier_call", "deadline_near"],
    },
    {
      title: "Duplicate notice: Cologne facility cleaning extension",
      source: "Bund.de procurement",
      buyer: "Köln Verwaltung",
      deadline: "—",
      budget: "—",
      score: 22,
      urgency: "low",
      route: "ignore",
      tags: ["duplicate"],
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sources" value="7" sub="3 EU · 2 DE" />
        <MetricCard label="Findings" value="18" sub="last 24h" />
        <MetricCard label="Qualified" value="3" sub="EUR 16.8M pipeline" tone="good" />
        <MetricCard label="Pending" value="2" sub="awaiting decision" tone="warn" />
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-rule bg-bg-elev">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold">Live radar feed</div>
            <div className="text-[11px] text-ink-mute">7 sources · 6 findings · GLiNER2 → Gemma 4 → Gemini</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent" size="xs">
              cascade active
            </Badge>
            <Button size="sm" variant="primary">
              Run scout
            </Button>
          </div>
        </div>

        <ul className="divide-y divide-rule">
          {findings.map((f, i) => (
            <li
              key={i}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]",
                i === 0 && "bg-bg-sunk/40",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-snug">{f.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-ink-mute">
                  {f.buyer} · {f.source}
                </div>
              </div>
              <div className="hidden flex-col gap-0.5 sm:flex">
                <div className="text-[11px] text-ink-mute">Deadline · Budget</div>
                <div className="font-mono text-[11px] font-medium tnum">
                  {f.deadline} · {f.budget}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ScorePill score={f.score} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-ink-3";
  return (
    <div className="rounded-[var(--radius)] border border-rule bg-bg-elev p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink-mute">{label}</div>
        <LedDot tone={tone === "good" ? "ok" : tone === "warn" ? "warn" : "live"} size={6} pulse={tone === "warn"} />
      </div>
      <div className={cn("mt-2 font-display text-3xl tracking-display tnum", toneClass)}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-mute">{sub}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-rule bg-bg-elev px-2 py-1">
      <span className="font-mono text-[12px] font-bold tnum">{score}</span>
    </div>
  );
}
