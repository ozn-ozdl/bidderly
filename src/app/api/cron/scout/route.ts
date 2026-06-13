import { saveRadarSnapshot } from "@/lib/db";
import { requireCronSecret } from "@/lib/env";
import { runScoutPipeline } from "@/lib/live-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  return runCronScout(request);
}

export async function POST(request: Request) {
  return runCronScout(request);
}

async function runCronScout(request: Request) {
  if (!requireCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScoutPipeline();
  await saveRadarSnapshot(result.snapshot, result.source === "live" ? "cron" : "fixture");

  return Response.json(result);
}
