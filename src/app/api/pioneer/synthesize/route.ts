// POST /api/pioneer/synthesize
//
// Triggers a synthetic-data generation job for each of the three Pioneer
// datasets we own: NER, classification (clue labels), and decoder
// (Gemma 4 scoring rows). In dry-run mode the rows are produced
// synchronously and persisted in the in-memory store so the rest of
// the pipeline can train against realistic data.

import { z } from "zod";

import {
  isPioneerDryRun,
  makeGenerationRequests,
  startGenerationJob,
  type GenerationRequest,
} from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    nerDataset: z.string().optional(),
    clueDataset: z.string().optional(),
    scoringDataset: z.string().optional(),
    nerExamples: z.number().int().positive().optional(),
    clueExamples: z.number().int().positive().optional(),
    scoringExamples: z.number().int().positive().optional(),
  })
  .optional();

export async function POST(request: Request) {
  let overrides: z.infer<typeof bodySchema> = {};
  try {
    const text = await request.text();
    if (text) overrides = bodySchema.parse(JSON.parse(text));
  } catch {
    overrides = {};
  }

  const requests: GenerationRequest[] = makeGenerationRequests(overrides ?? undefined);
  const jobs = await Promise.all(requests.map((req) => startGenerationJob(req)));

  return Response.json({
    pioneerDryRun: isPioneerDryRun(),
    jobs: jobs.map((job, index) => ({
      kind: requests[index].kind,
      jobId: job.jobId,
      status: job.status,
      source: job.source,
      datasetName: requests[index].datasetName,
    })),
  });
}
