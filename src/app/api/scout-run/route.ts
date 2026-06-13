import { saveRadarSnapshot } from "@/lib/db";
import { syntheticTrainingExamples } from "@/lib/demo-data";
import { runScoutPipeline } from "@/lib/live-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await runScoutPipeline();
  const snapshot = result.snapshot;
  await saveRadarSnapshot(snapshot, result.source === "live" ? "manual" : "fixture");

  return Response.json({
    run: {
      ...snapshot.scoutRun,
      status: "completed",
    },
    summary: {
      sourcesScanned: snapshot.sources.length,
      rawFindings: snapshot.findings.length,
      extractedFindings: snapshot.extractions.length,
      qualifiedOpportunities: snapshot.opportunities.length,
      pendingApprovals: snapshot.approvals.filter(
        (approval) => approval.status === "pending",
      ).length,
      syntheticTrainingExamples: syntheticTrainingExamples.length,
    },
    source: result.source,
    warnings: result.warnings,
    snapshot,
  });
}
