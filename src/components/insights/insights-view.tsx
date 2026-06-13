"use client";

import { DeadlineTimeline } from "./deadline-timeline";
import { TenderMap } from "./tender-map";
import { ValueDistribution } from "./value-distribution";
import type { RadarSnapshot } from "@/lib/radar-types";

type InsightsViewProps = {
  snapshot: RadarSnapshot;
};

export function InsightsView({ snapshot }: InsightsViewProps) {
  return (
    <div className="space-y-4">
      <TenderMap snapshot={snapshot} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DeadlineTimeline snapshot={snapshot} />
        <ValueDistribution snapshot={snapshot} />
      </div>
    </div>
  );
}
