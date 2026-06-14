// GET /api/pioneer/train/status
//
// Polls a list of training jobs and returns the current status of
// each. In dry-run mode the in-memory job transitions
// `running -> complete` after 1.5 seconds and the response includes
// the F1/precision/recall metrics.

import { z } from "zod";

import { isPioneerDryRun, listTrainingJobs, pollTrainingJob, type TrainingJobStatus } from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    jobIds: z.array(z.string()).optional(),
  })
  .optional();

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema> = {};
  try {
    const text = await request.text();
    if (text) body = bodySchema.parse(JSON.parse(text));
  } catch {
    body = {};
  }
  const jobIds = body?.jobIds ?? [];
  const jobs: TrainingJobStatus[] = await Promise.all(
    jobIds.map((id) => pollTrainingJob(id)),
  );
  return Response.json({ pioneerDryRun: isPioneerDryRun(), jobs });
}

export async function GET() {
  const all = await listTrainingJobs();
  return Response.json({ pioneerDryRun: isPioneerDryRun(), jobs: all });
}
