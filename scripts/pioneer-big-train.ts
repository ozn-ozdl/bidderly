// Big E2E training run on the real Fastino API.
//
// Trains 3 models in parallel from 3 datasets that were generated
// in an earlier run (bidderly-tender-{ner,clues,scoring}-big v1):
//   - NER:           fastino/gliner2-multi-v1,  15 examples, 5 epochs
//   - Classification: fastino/gliner2-multi-v1, 100 examples, 5 epochs
//   - Decoder (SFT): Qwen/Qwen3-1.7B-Base,     60 examples, 3 epochs
//
// All three are LoRA so the only trainable params are the
// adapters. Polls each job until `status: deployed`, then runs
// three evaluations in parallel.

import { config } from "dotenv";
config({ path: ".env.local" });
process.env.PIONEER_DRY_RUN = "false";

import {
  startTrainingJob,
  pollTrainingJob,
  listCheckpoints,
} from "../src/lib/pioneer/training";
import {
  runEvaluation,
  getEvaluation,
} from "../src/lib/pioneer/evaluations";
import {
  isPioneerDryRun,
  getPioneerApiKey,
} from "../src/lib/pioneer/client";

const NER_DATASET = "bidderly-tender-ner-big";
const CLUE_DATASET = "bidderly-tender-clues-big";
const SCORING_DATASET = "bidderly-tender-scoring-big";

const NER_JOB = "bidderly-tender-ner-big";
const CLUE_JOB = "bidderly-tender-clues-big";
const SCORING_JOB = "bidderly-tender-scoring-big";

const ENCODER_BASE = "fastino/gliner2-multi-v1";
const DECODER_BASE = "Qwen/Qwen3-1.7B-Base";

const ENCODER_EPOCHS = 5;
const DECODER_EPOCHS = 3;

function log(stage: string, payload?: unknown) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${stage}`, payload === undefined ? "" : JSON.stringify(payload));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForJob(
  label: string,
  poll: () => Promise<{ status: string; id: string }>,
  doneStatuses: string[],
  pollEveryMs: number,
) {
  let last = "";
  while (true) {
    const s = await poll();
    if (s.status !== last) {
      log(`${label}_POLL`, { id: s.id, status: s.status });
      last = s.status;
    }
    if (doneStatuses.includes(s.status)) return s;
    await sleep(pollEveryMs);
  }
}

async function main() {
  if (isPioneerDryRun() || !getPioneerApiKey()) {
    log("ABORT", "Pioneer is in dry-run or key missing.");
    process.exit(2);
  }

  log("START", {
    NER_DATASET,
    CLUE_DATASET,
    SCORING_DATASET,
    ENCODER_BASE,
    DECODER_BASE,
    ENCODER_EPOCHS,
    DECODER_EPOCHS,
  });

  // --- 1. Top up the NER dataset ---------------------------------------
  // The first NER generation produced 15 examples; the second returned 0
  // valid samples. We pin training to the v1 (15-example) dataset to keep
  // the pipeline moving. The classification (100) and scoring (60) datasets
  // are at the requested volume.
  log("NER_TOPUP_SKIP", "Pinning to v1 of bidderly-tender-ner-big (15 examples). Classification and scoring datasets are at 100 and 60 examples respectively.");

  // --- 2. Submit three training jobs in parallel ----------------------
  log("TRAIN_BEGIN");
  const [nerTrain, clueTrain, scoreTrain] = await Promise.all([
    startTrainingJob({
      kind: "ner",
      modelName: NER_JOB,
      baseModel: ENCODER_BASE,
      datasetName: NER_DATASET,
      datasetVersion: "1",
      trainingType: "lora",
      nrEpochs: ENCODER_EPOCHS,
      learningRate: 5e-5,
    }),
    startTrainingJob({
      kind: "classification",
      modelName: CLUE_JOB,
      baseModel: ENCODER_BASE,
      datasetName: CLUE_DATASET,
      datasetVersion: "1",
      trainingType: "lora",
      nrEpochs: ENCODER_EPOCHS,
      learningRate: 5e-5,
    }),
    startTrainingJob({
      kind: "decoder",
      modelName: SCORING_JOB,
      baseModel: DECODER_BASE,
      datasetName: SCORING_DATASET,
      datasetVersion: "1",
      trainingType: "lora",
      trainingAlgorithm: "sft",
      nrEpochs: DECODER_EPOCHS,
      learningRate: 2e-5,
    }),
  ]);
  log("TRAIN_JOBS", { ner: nerTrain, clue: clueTrain, scoring: scoreTrain });

  // --- 3. Wait for all three to deploy -------------------------------
  const [nerTrainFinal, clueTrainFinal, scoreTrainFinal] = await Promise.all([
    waitForJob("NER_TRAIN", () => pollTrainingJob(nerTrain.id), ["complete", "failed", "cancelled"], 20_000),
    waitForJob("CLUE_TRAIN", () => pollTrainingJob(clueTrain.id), ["complete", "failed", "cancelled"], 20_000),
    waitForJob("SCORE_TRAIN", () => pollTrainingJob(scoreTrain.id), ["complete", "failed", "cancelled"], 20_000),
  ]);
  log("TRAIN_DONE", {
    ner: nerTrainFinal,
    clue: clueTrainFinal,
    scoring: scoreTrainFinal,
  });
  if (
    nerTrainFinal.status !== "complete" ||
    clueTrainFinal.status !== "complete" ||
    scoreTrainFinal.status !== "complete"
  ) {
    log("ABORT", "At least one training job did not complete");
    process.exit(1);
  }
  log("TRAIN_DONE", {
    ner: nerTrainFinal,
    clue: clueTrainFinal,
    scoring: scoreTrainFinal,
  });
  if (
    nerTrainFinal.status !== "complete" ||
    clueTrainFinal.status !== "complete" ||
    scoreTrainFinal.status !== "complete"
  ) {
    log("ABORT", "At least one training job did not complete");
    process.exit(1);
  }

  const [nerCkp, clueCkp, scoreCkp] = await Promise.all([
    listCheckpoints(nerTrain.id),
    listCheckpoints(clueTrain.id),
    listCheckpoints(scoreTrain.id),
  ]);
  log("CHECKPOINTS", { ner: nerCkp, clue: clueCkp, scoring: scoreCkp });

  // --- 4. Three evaluations in parallel --------------------------------
  log("EVAL_BEGIN");
  const [nerEval, clueEval, scoreEval] = await Promise.all([
    runEvaluation({ baseModel: nerTrain.id, datasetName: NER_DATASET }),
    runEvaluation({ baseModel: clueTrain.id, datasetName: CLUE_DATASET }),
    runEvaluation({ baseModel: scoreTrain.id, datasetName: SCORING_DATASET }),
  ]);
  log("EVAL_JOBS", { ner: nerEval, clue: clueEval, scoring: scoreEval });

  await Promise.all([
    waitForJob(
      "NER_EVAL",
      async () => {
        const r = await getEvaluation(nerEval.id);
        return { id: r.evaluation?.id ?? nerEval.id, status: r.evaluation?.status ?? "unknown" };
      },
      ["complete", "failed"],
      5_000,
    ),
    waitForJob(
      "CLUE_EVAL",
      async () => {
        const r = await getEvaluation(clueEval.id);
        return { id: r.evaluation?.id ?? clueEval.id, status: r.evaluation?.status ?? "unknown" };
      },
      ["complete", "failed"],
      5_000,
    ),
    waitForJob(
      "SCORE_EVAL",
      async () => {
        const r = await getEvaluation(scoreEval.id);
        return { id: r.evaluation?.id ?? scoreEval.id, status: r.evaluation?.status ?? "unknown" };
      },
      ["complete", "failed"],
      5_000,
    ),
  ]);

  const [nerEvalFull, clueEvalFull, scoreEvalFull] = await Promise.all([
    getEvaluation(nerEval.id),
    getEvaluation(clueEval.id),
    getEvaluation(scoreEval.id),
  ]);

  log("DONE", {
    jobs: {
      nerTraining: nerTrain.id,
      clueTraining: clueTrain.id,
      scoringTraining: scoreTrain.id,
      nerEval: nerEval.id,
      clueEval: clueEval.id,
      scoringEval: scoreEval.id,
    },
    evaluation: {
      ner: nerEvalFull.evaluation,
      clue: clueEvalFull.evaluation,
      scoring: scoreEvalFull.evaluation,
    },
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
