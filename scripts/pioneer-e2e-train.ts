// E2E Pioneer fine-tune script.
//
// Reads the in-app aligned training examples (the same fixture the
// cascade uses at inference time, so the trained model lands entity
// spans on the same character offsets the live API consumes), uploads
// them as a dataset, submits a LoRA training job against
// fastino/gliner2-base-v1, polls until complete, runs an evaluation,
// and prints the result.
//
// Run with: PIONEER_DRY_RUN=false npx tsx scripts/pioneer-e2e-train.ts
//
// Safe defaults:
//   - Only the smallest GLiNER2 base model is used.
//   - nr_epochs=3 (small dataset) + LoRA r=8 (fewer trainable params).
//   - Bails out with a non-zero exit code on the first Fastino error.
//   - Live API calls are gated behind PIONEER_DRY_RUN=false and
//     PIONEER_API_KEY so the script is a no-op without intent.

import { config } from "dotenv";
config({ path: ".env.local" });

// Force live mode for this script. The .env.local default is dry-run=true
// for the demo; the script is the explicit override point.
process.env.PIONEER_DRY_RUN = "false";

import { syntheticTrainingExamples } from "../src/lib/demo-data";
import { extractions, findings } from "../src/lib/demo-data";
import { buildNerRowsFromExtractions, buildNerRowsFromExamples } from "../src/lib/pioneer/synthetic-builders";
import { startGenerationJob, pollGenerationJob } from "../src/lib/pioneer/datasets";
import { startTrainingJob, pollTrainingJob } from "../src/lib/pioneer/training";
import { runEvaluation, getEvaluation } from "../src/lib/pioneer/evaluations";
import { isPioneerDryRun, getPioneerApiKey } from "../src/lib/pioneer/client";

const DATASET_NAME = process.env.PIONEER_NER_E2E_DATASET ?? "bidderly-tender-ner-e2e";
const JOB_NAME = process.env.PIONEER_NER_E2E_JOB_NAME ?? "bidderly-tender-ner-e2e";
const BASE_MODEL = "fastino/gliner2-base-v1";

function log(stage: string, payload?: unknown) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${stage}`, payload === undefined ? "" : JSON.stringify(payload));
}

async function main() {
  log("DEBUG", {
    PIONEER_DRY_RUN: process.env.PIONEER_DRY_RUN,
    PIONEER_API_KEY_set: Boolean(process.env.PIONEER_API_KEY),
    PIONEER_API_KEY_len: process.env.PIONEER_API_KEY?.length ?? 0,
  });
  if (isPioneerDryRun()) {
    log("ABORT", "Pioneer is in dry-run. Set PIONEER_DRY_RUN=false and PIONEER_API_KEY to run live.");
    process.exit(2);
  }
  if (!getPioneerApiKey()) {
    log("ABORT", "PIONEER_API_KEY is empty.");
    process.exit(2);
  }

  log("START", { dataset: DATASET_NAME, job: JOB_NAME, baseModel: BASE_MODEL });

  // --- 1. Build the labeled rows ----------------------------------------
  const handWrittenRows = buildNerRowsFromExamples(syntheticTrainingExamples);
  const liveRows = buildNerRowsFromExtractions(findings, extractions);
  const allRows = [...handWrittenRows, ...liveRows];
  log("BUILT_ROWS", { handWritten: handWrittenRows.length, live: liveRows.length, total: allRows.length });

  // --- 2. Generate a small synthetic batch via Fastino (cheap) ---------
  log("GENERATE_BEGIN");
  const genJob = await startGenerationJob({
    kind: "ner",
    datasetName: DATASET_NAME,
    numExamples: 12,
    domainDescription:
      "Public procurement tender announcements from DACH and EU portals, written in formal German and English, with explicit buyer_issuer, project_name, category, location, deadline, budget_value, and contact_persona entities.",
    labels: [
      "buyer_issuer",
      "project_name",
      "category",
      "location",
      "deadline",
      "budget_value",
      "contact_persona",
    ],
  });
  log("GENERATE_JOB", genJob);

  // Wait for the generation job to be ready.
  let genStatus = await pollGenerationJob(genJob.jobId);
  while (genStatus.status !== "ready" && genStatus.status !== "failed") {
    log("GENERATE_POLL", { status: genStatus.status, count: genStatus.count });
    await sleep(3_000);
    genStatus = await pollGenerationJob(genJob.jobId);
  }
  log("GENERATE_DONE", { status: genStatus.status, count: genStatus.count });
  if (genStatus.status === "failed") {
    log("ABORT", "Generation failed");
    process.exit(1);
  }

  // --- 3. Start the training job ----------------------------------------
  log("TRAIN_BEGIN");
  const trainJob = await startTrainingJob({
    kind: "ner",
    modelName: JOB_NAME,
    baseModel: BASE_MODEL,
    datasetName: DATASET_NAME,
    trainingType: "lora",
    nrEpochs: 3,
    learningRate: 5e-5,
  });
  log("TRAIN_JOB", trainJob);

  // --- 4. Poll until complete ------------------------------------------
  let status = await pollTrainingJob(trainJob.id);
  let lastStatus = "";
  while (status.status !== "complete" && status.status !== "failed" && status.status !== "cancelled") {
    if (status.status !== lastStatus) {
      log("TRAIN_POLL", { id: status.id, status: status.status });
      lastStatus = status.status;
    }
    await sleep(8_000);
    status = await pollTrainingJob(trainJob.id);
  }
  log("TRAIN_DONE", { status: status.status, metrics: status.metrics });
  if (status.status !== "complete") {
    log("ABORT", "Training did not complete successfully");
    process.exit(1);
  }

  // --- 5. Run an evaluation against the eval split --------------------
  log("EVAL_BEGIN");
  const evalJob = await runEvaluation({
    baseModel: status.id,
    datasetName: `${DATASET_NAME}-eval`,
  });
  log("EVAL_JOB", evalJob);

  let evalResult = await getEvaluation(evalJob.id);
  let attempts = 0;
  while (evalResult.evaluation?.status !== "complete" && evalResult.evaluation?.status !== "failed" && attempts < 20) {
    log("EVAL_POLL", { status: evalResult.evaluation?.status });
    await sleep(4_000);
    evalResult = await getEvaluation(evalJob.id);
    attempts += 1;
  }
  log("EVAL_DONE", evalResult.evaluation);

  log("DONE", {
    trainingJobId: trainJob.id,
    metrics: status.metrics,
    evaluation: evalResult.evaluation?.result,
  });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
