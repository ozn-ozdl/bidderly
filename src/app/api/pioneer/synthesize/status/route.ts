// GET /api/pioneer/synthesize/status
//
// Polls a list of generation jobs and returns the current status of
// each. In dry-run mode the job is created synchronously and is
// immediately "ready" with a row count.

import { z } from "zod";

import { getDataset, isPioneerDryRun, listDatasets, pollGenerationJob } from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    jobIds: z.array(z.string()).optional(),
    datasetNames: z.array(z.string()).optional(),
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
  const polledJobs = await Promise.all(
    jobIds.map(async (jobId) => ({ jobId, status: await pollGenerationJob(jobId) })),
  );

  const datasetNames = body?.datasetNames ?? [];
  const datasets = await Promise.all(datasetNames.map((name) => getDataset(name)));

  return Response.json({
    pioneerDryRun: isPioneerDryRun(),
    jobs: polledJobs.map((row) => row.status),
    datasets,
  });
}

export async function GET() {
  const all = await listDatasets();
  return Response.json({ pioneerDryRun: isPioneerDryRun(), datasets: all });
}
