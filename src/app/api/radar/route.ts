import { getLatestRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot, syntheticTrainingExamples } from "@/lib/demo-data";
import { getIntegrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = (await getLatestRadarSnapshot()) ?? getRadarSnapshot();

  return Response.json({
    ...snapshot,
    syntheticTrainingExamples,
    cascade: {
      extraction: "fine-tuned GLiNER2 procurement radar",
      scoring: "Pioneer Gemma 4 scoring router",
      reasoning: "Gemini deep reasoning",
      geminiGate:
        "score >= 70 OR route == human_review OR urgency == high OR human blocker exists",
    },
    integrations: getIntegrationStatus(),
  });
}
