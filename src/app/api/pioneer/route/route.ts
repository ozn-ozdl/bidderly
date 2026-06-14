// GET /api/pioneer/route
//
// Returns the current Pioneer routing state (which model ids the
// cascade should target for extraction + scoring). Picked up from
// env vars today; the full per-user override is a follow-up.

import { isPioneerDryRun } from "@/lib/pioneer";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    pioneerDryRun: isPioneerDryRun(),
    gliner2Model: process.env.PIONEER_GLINER2_MODEL ?? "fastino/gliner2-base-v1",
    gemma4Model: process.env.PIONEER_GEMMA4_MODEL ?? "google/gemma-4-9b-it",
  });
}
