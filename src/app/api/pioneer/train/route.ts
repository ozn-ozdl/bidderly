// POST /api/pioneer/train
//
// Submits up to three training jobs:
//   - GLiNER2 NER (buyer_issuer, project_name, ...)
//   - GLiNER2 classification (clue labels)
//   - Gemma 4 decoder (SFT scoring rows)
//
// In dry-run mode the jobs are created synchronously in the
// in-memory store and the user can poll /api/pioneer/train/status.

import { z } from "zod";

import { isPioneerDryRun, startTrainingJob, type TrainingRequest } from "@/lib/pioneer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    datasets: z
      .object({
        ner: z.string().optional(),
        clues: z.string().optional(),
        scoring: z.string().optional(),
      })
      .optional(),
    models: z
      .object({
        gliner2: z.string().optional(),
        gemma4: z.string().optional(),
      })
      .optional(),
    jobs: z
      .object({
        nerName: z.string().optional(),
        cluesName: z.string().optional(),
        scoringName: z.string().optional(),
      })
      .optional(),
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

  const nerDataset = body?.datasets?.ner ?? process.env.PIONEER_NER_DATASET ?? "bidderly-tender-ner";
  const clueDataset = body?.datasets?.clues ?? process.env.PIONEER_CLUE_DATASET ?? "bidderly-tender-clues";
  const scoringDataset = body?.datasets?.scoring ?? process.env.PIONEER_SCORING_DATASET ?? "bidderly-tender-scoring";

  const gliner2Model = body?.models?.gliner2 ?? process.env.PIONEER_GLINER2_MODEL ?? "fastino/gliner2-base-v1";
  const gemma4Model = body?.models?.gemma4 ?? process.env.PIONEER_GEMMA4_MODEL ?? "google/gemma-4-9b-it";

  const nerName = body?.jobs?.nerName ?? process.env.PIONEER_NER_JOB_NAME ?? "bidderly-tender-ner";
  const clueName = body?.jobs?.cluesName ?? process.env.PIONEER_CLUE_JOB_NAME ?? "bidderly-tender-clues";
  const scoringName = body?.jobs?.scoringName ?? process.env.PIONEER_SCORING_JOB_NAME ?? "bidderly-tender-scoring";

  const requests: TrainingRequest[] = [
    {
      kind: "ner",
      modelName: nerName,
      baseModel: gliner2Model,
      datasetName: nerDataset,
      trainingType: "lora",
      nrEpochs: 5,
      learningRate: 5e-5,
    },
    {
      kind: "classification",
      modelName: clueName,
      baseModel: gliner2Model,
      datasetName: clueDataset,
      trainingType: "lora",
      nrEpochs: 5,
      learningRate: 5e-5,
    },
    {
      kind: "decoder",
      modelName: scoringName,
      baseModel: gemma4Model,
      datasetName: scoringDataset,
      trainingType: "lora",
      trainingAlgorithm: "sft",
      nrEpochs: 3,
      learningRate: 2e-5,
    },
  ];

  const jobs = await Promise.all(requests.map((req) => startTrainingJob(req)));

  return Response.json({
    pioneerDryRun: isPioneerDryRun(),
    jobs: jobs.map((job, index) => ({
      kind: requests[index].kind,
      id: job.id,
      status: job.status,
      source: job.source,
      modelName: requests[index].modelName,
      baseModel: requests[index].baseModel,
      datasetName: requests[index].datasetName,
    })),
  });
}
