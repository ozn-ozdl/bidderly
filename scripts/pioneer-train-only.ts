// Trains GLiNER2 base on the synthetic NER dataset we just generated
// and runs an evaluation. Conservative on credit use: nr_epochs=3,
// LoRA only.

import { config } from "dotenv";
config({ path: ".env.local" });
process.env.PIONEER_DRY_RUN = "false";

import { startTrainingJob, pollTrainingJob, listCheckpoints, downloadTrainingJob } from "../src/lib/pioneer/training";
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
  if (isPioneerDryRun()) {
    log("ABORT", "Pioneer is in dry-run.");
    process.exit(2);
  }
  if (!getPioneerApiKey()) {
    log("ABORT", "PIONEER_API_KEY is empty.");
    process.exit(2);
  }

  log("TRAIN_BEGIN", { dataset: DATASET_NAME, baseModel: BASE_MODEL });

  const job = await startTrainingJob({
    kind: "ner",
    modelName: JOB_NAME,
    baseModel: BASE_MODEL,
    datasetName: DATASET_NAME,
    trainingType: "lora",
    nrEpochs: 3,
    learningRate: 5e-5,
  });
  log("TRAIN_JOB", job);

  let status = await pollTrainingJob(job.id);
  let last = "";
  while (status.status !== "complete" && status.status !== "failed" && status.status !== "cancelled") {
    if (status.status !== last) {
      log("TRAIN_POLL", { id: status.id, status: status.status });
      last = status.status;
    }
    await sleep(10_000);
    status = await pollTrainingJob(job.id);
  }
  log("TRAIN_DONE", { status: status.status, metrics: status.metrics });
  if (status.status !== "complete") {
    log("ABORT", "training did not complete");
    process.exit(1);
  }

  const checkpoints = await listCheckpoints(job.id);
  log("CHECKPOINTS", checkpoints);

  log("EVAL_BEGIN");
  const evalJob = await runEvaluation({
    baseModel: job.id,
    datasetName: DATASET_NAME,
  });
  log("EVAL_JOB", evalJob);

  let evalResult = await getEvaluation(evalJob.id);
  let attempts = 0;
  while (evalResult.evaluation?.status !== "complete" && evalResult.evaluation?.status !== "failed" && attempts < 30) {
    log("EVAL_POLL", { status: evalResult.evaluation?.status });
    await sleep(5_000);
    evalResult = await getEvaluation(evalJob.id);
    attempts += 1;
  }
  log("EVAL_DONE", evalResult.evaluation);

  log("DOWNLOAD_BEGIN");
  try {
    const download = await downloadTrainingJob(job.id);
    log("DOWNLOAD_DONE", download);
  } catch (err) {
    log("DOWNLOAD_SKIP", err instanceof Error ? err.message : String(err));
  }

  log("DONE", {
    trainingJobId: job.id,
    trainingMetrics: status.metrics,
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
