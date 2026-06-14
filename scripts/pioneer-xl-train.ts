// Big-data E2E training run on the real Fastino API.
//
// Generates ~3-4x more synthetic data than the previous big run by
// issuing multiple parallel /generate calls per task (Pioneer's
// per-call cap on NER is ~15 examples, while classification and
// decoder can produce 100+ in one call). Trains on bigger-small
// models:
//   - fastino/gliner2-multi-large-v1  (multilingual, larger)
//   - Qwen/Qwen3-8B                   (8B params, still well under 32B)
//
// All jobs are LoRA, the encoder jobs are parallel, and the three
// evaluations run in parallel after the deployments land. Total
// wall time ~10-15 minutes; cost well under the $50 Pioneer
// credit budget.

import { config } from "dotenv";
config({ path: ".env.local" });
process.env.PIONEER_DRY_RUN = "false";

import {
  startGenerationJob,
  pollGenerationJob,
  listDatasets,
} from "../src/lib/pioneer/datasets";
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
import { ENTITY_LABELS, CLUE_LABELS } from "../src/lib/pioneer/schemas";

const NER_DATASET_BASE = "bidderly-tender-ner-xl";
const CLUE_DATASET_BASE = "bidderly-tender-clues-xl";
const SCORING_DATASET_BASE = "bidderly-tender-scoring-xl";

const NER_JOB = "bidderly-tender-ner-xl";
const CLUE_JOB = "bidderly-tender-clues-xl";
const SCORING_JOB = "bidderly-tender-scoring-xl";

const ENCODER_BASE = "fastino/gliner2-multi-large-v1";
const DECODER_BASE = "Qwen/Qwen3-8B";

// Six parallel NER calls (Pioneer caps ~15 each → ~90 examples).
const NER_CALLS = 6;
const NER_PER_CALL = 25;

// Two parallel classification calls (200 examples total).
const CLUE_CALLS = 2;
const CLUE_PER_CALL = 100;

// Two parallel decoder calls (200 examples total).
const SCORING_CALLS = 2;
const SCORING_PER_CALL = 100;

const ENCODER_EPOCHS = 5;
const DECODER_EPOCHS = 3;

const DOMAIN = [
  "Public procurement tender announcements from DACH and EU portals,",
  "written in formal German and English, covering a broad range of",
  "tender-offer fields:",
  "  - core: buyer_issuer, project_name, category, location, deadline,",
  "    budget_value, contact_persona",
  "  - mechanics: reference_number, cpv_code, procedure_type,",
  "    contract_duration, delivery_location, submission_language",
  "  - contact: contact_email, contact_phone",
  "  - submission: scope_description, eligibility_requirements,",
  "    evaluation_criteria",
  "plus procurement signal clues:",
  "  - status: budget_approved, supplier_call, pre_announcement,",
  "    official_tender, deadline_near, login_required, event_notice,",
  "    duplicate, expired",
  "  - procedure: framework_agreement, open_procedure,",
  "    restricted_procedure, negotiated_procedure, competitive_dialogue",
  "  - document: amendment, corrigendum, clarification_deadline",
  "  - logistics: consortium_allowed, lots, electronic_submission",
].join(" ");

const DECODER_PROMPT = [
  "You are a procurement sales agent scoring a tender for a B2B",
  "software vendor with DACH + EU public-sector experience. Given a",
  "raw tender announcement and a structured extraction of its",
  "entities, return strict JSON:",
  '{ "worthOutreachScore": 0-100, "urgency": "low"|"medium"|"high",',
  '  "route": "ignore"|"monitor"|"qualify"|"human_review", "rationale": string }',
  "",
  "Heuristics:",
  "- budget_approved + budget_value present  -> +25 score",
  "- deadline within 14 days                 -> urgency = high",
  "- login_required or duplicate/expired     -> route = ignore or monitor",
  "- event_notice without budget             -> route = monitor",
  "- weak_signal with no buyer/budget        -> score < 40, route = ignore",
  "- amendment / corrigendum                 -> route = monitor",
  "- open_procedure + deadline_near          -> route = qualify",
  "",
  "Always include a one-sentence rationale that cites at least one",
  "clue tag and at least one entity (e.g. a deadline or budget).",
].join("\n");

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

async function nParallel<T>(
  count: number,
  fn: (index: number) => Promise<T>,
): Promise<T[]> {
  return Promise.all(Array.from({ length: count }, (_, i) => fn(i)));
}

async function generateBatch(
  taskType: "ner" | "classification" | "decoder",
  datasetNameBase: string,
  count: number,
  numExamplesPerCall: number,
  labels?: readonly string[],
) {
  const calls = Math.ceil(count / numExamplesPerCall);
  const examplesPerCall = Math.ceil(count / calls);
  log("GEN_BATCH_BEGIN", { taskType, datasetNameBase, calls, examplesPerCall });

  // Each call gets its own dataset name so Pioneer doesn't dedupe
  // concurrent writes against the same dataset/version.
  const datasetNames = Array.from(
    { length: calls },
    (_, i) => `${datasetNameBase}-part${i + 1}`,
  );

  const started = await nParallel(calls, (i) => {
    const datasetName = datasetNames[i] ?? datasetNameBase;
    if (taskType === "ner") {
      return startGenerationJob({
        kind: "ner",
        datasetName,
        numExamples: examplesPerCall,
        labels: (labels ?? []) as never,
        domainDescription: DOMAIN,
      });
    }
    if (taskType === "classification") {
      return startGenerationJob({
        kind: "classification",
        datasetName,
        numExamples: examplesPerCall,
        labels: (labels ?? []) as never,
        domainDescription: DOMAIN,
      });
    }
    return startGenerationJob({
      kind: "decoder",
      datasetName,
      numExamples: examplesPerCall,
      domainDescription: DOMAIN,
      prompt: DECODER_PROMPT,
    });
  });
  log("GEN_BATCH_JOBS", started.map((j, i) => ({ call: i, dataset: datasetNames[i], jobId: j.jobId, status: j.status })));

  const finished = await Promise.all(
    started.map((j, i) =>
      waitForJob(
        `GEN_${taskType.toUpperCase()}_${i}`,
        () => pollGenerationJob(j.jobId).then((s) => ({ id: s.job_id, status: s.status })),
        ["ready", "failed"],
        8_000,
      ),
    ),
  );
  const failed = finished.filter((f) => f.status === "failed").length;
  log("GEN_BATCH_DONE", { taskType, calls, failed });
  if (failed > 0) {
    log("GEN_BATCH_WARN", `${failed}/${calls} generation jobs failed; continuing with whatever rows landed`);
  }
  return { finished, datasetNames };
}

async function main() {
  if (isPioneerDryRun() || !getPioneerApiKey()) {
    log("ABORT", "Pioneer is in dry-run or key missing.");
    process.exit(2);
  }

  log("START", {
    NER_DATASET_BASE,
    CLUE_DATASET_BASE,
    SCORING_DATASET_BASE,
    ENCODER_BASE,
    DECODER_BASE,
    NER_CALLS,
    NER_PER_CALL,
    CLUE_CALLS,
    CLUE_PER_CALL,
    SCORING_CALLS,
    SCORING_PER_CALL,
    ENCODER_EPOCHS,
    DECODER_EPOCHS,
  });

  // --- 1. Generate three datasets in parallel batches ----------------
  const [nerGen, clueGen, scoreGen] = await Promise.all([
    generateBatch("ner", NER_DATASET_BASE, NER_CALLS * NER_PER_CALL, NER_PER_CALL, [...ENTITY_LABELS]),
    generateBatch("classification", CLUE_DATASET_BASE, CLUE_CALLS * CLUE_PER_CALL, CLUE_PER_CALL, [...CLUE_LABELS]),
    generateBatch("decoder", SCORING_DATASET_BASE, SCORING_CALLS * SCORING_PER_CALL, SCORING_PER_CALL),
  ]);

  // Discover the dataset version count for each part.
  type DatasetListing = {
    name: string;
    version?: number;
    count?: number;
    status?: string;
    created_at?: string;
  };
  const allDatasets = await listDatasets();
  const partsByBase = (base: string) =>
    (allDatasets.datasets as DatasetListing[]).filter((d) => d.name.startsWith(`${base}-part`));
  const nerParts = partsByBase(NER_DATASET_BASE);
  const clueParts = partsByBase(CLUE_DATASET_BASE);
  const scoreParts = partsByBase(SCORING_DATASET_BASE);
  log("DATASETS_READY", {
    ner: nerParts.map((d) => ({ name: d.name, v: d.version, count: d.count, status: d.status })),
    clue: clueParts.map((d) => ({ name: d.name, v: d.version, count: d.count, status: d.status })),
    scoring: scoreParts.map((d) => ({ name: d.name, v: d.version, count: d.count, status: d.status })),
  });

  // Use the first ready part of each for training (we'll point the
  // training job at one dataset per task; the multiple parts exist
  // for downstream experiments that need a bigger eval pool).
  const firstReadyVersion = (list: DatasetListing[]) => {
    const ready = list.filter((d) => d.status === "ready" && typeof d.version === "number");
    if (ready.length === 0) return "1";
    return String(ready[0]?.version ?? "1");
  };
  const nerVersion = firstReadyVersion(nerParts);
  const clueVersion = firstReadyVersion(clueParts);
  const scoreVersion = firstReadyVersion(scoreParts);
  const nerDatasetName = nerParts[0]?.name ?? NER_DATASET_BASE;
  const clueDatasetName = clueParts[0]?.name ?? CLUE_DATASET_BASE;
  const scoreDatasetName = scoreParts[0]?.name ?? SCORING_DATASET_BASE;
  log("TRAIN_VERSIONS", { nerDatasetName, nerVersion, clueDatasetName, clueVersion, scoreDatasetName, scoreVersion });

  if (nerParts.length === 0) {
    log("ABORT", "No NER dataset parts are ready; aborting");
    process.exit(1);
  }
  void nerGen; void clueGen; void scoreGen;

  // --- 2. Submit three training jobs in parallel ----------------------
  log("TRAIN_BEGIN");
  const [nerTrain, clueTrain, scoreTrain] = await Promise.all([
    startTrainingJob({
      kind: "ner",
      modelName: NER_JOB,
      baseModel: ENCODER_BASE,
      datasetName: nerDatasetName,
      datasetVersion: nerVersion,
      trainingType: "lora",
      nrEpochs: ENCODER_EPOCHS,
      learningRate: 5e-5,
    }),
    startTrainingJob({
      kind: "classification",
      modelName: CLUE_JOB,
      baseModel: ENCODER_BASE,
      datasetName: clueDatasetName,
      datasetVersion: clueVersion,
      trainingType: "lora",
      nrEpochs: ENCODER_EPOCHS,
      learningRate: 5e-5,
    }),
    startTrainingJob({
      kind: "decoder",
      modelName: SCORING_JOB,
      baseModel: DECODER_BASE,
      datasetName: scoreDatasetName,
      datasetVersion: scoreVersion,
      trainingType: "lora",
      trainingAlgorithm: "sft",
      nrEpochs: DECODER_EPOCHS,
      learningRate: 2e-5,
    }),
  ]);
  log("TRAIN_JOBS", { ner: nerTrain, clue: clueTrain, scoring: scoreTrain });

  // --- 3. Wait for all three to deploy -------------------------------
  const [nerTrainFinal, clueTrainFinal, scoreTrainFinal] = await Promise.all([
    waitForJob("NER_TRAIN", () => pollTrainingJob(nerTrain.id), ["complete", "failed", "cancelled"], 30_000),
    waitForJob("CLUE_TRAIN", () => pollTrainingJob(clueTrain.id), ["complete", "failed", "cancelled"], 30_000),
    waitForJob("SCORE_TRAIN", () => pollTrainingJob(scoreTrain.id), ["complete", "failed", "cancelled"], 30_000),
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

  const [nerCkp, clueCkp, scoreCkp] = await Promise.all([
    listCheckpoints(nerTrain.id),
    listCheckpoints(clueTrain.id),
    listCheckpoints(scoreTrain.id),
  ]);
  log("CHECKPOINTS", {
    ner: nerCkp,
    clue: clueCkp,
    scoring: scoreCkp,
  });

  // --- 4. Three evaluations in parallel --------------------------------
  log("EVAL_BEGIN");
  const [nerEval, clueEval, scoreEval] = await Promise.all([
    runEvaluation({ baseModel: nerTrain.id, datasetName: nerDatasetName }),
    runEvaluation({ baseModel: clueTrain.id, datasetName: clueDatasetName }),
    runEvaluation({ baseModel: scoreTrain.id, datasetName: scoreDatasetName }),
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
      8_000,
    ),
    waitForJob(
      "CLUE_EVAL",
      async () => {
        const r = await getEvaluation(clueEval.id);
        return { id: r.evaluation?.id ?? clueEval.id, status: r.evaluation?.status ?? "unknown" };
      },
      ["complete", "failed"],
      8_000,
    ),
    waitForJob(
      "SCORE_EVAL",
      async () => {
        const r = await getEvaluation(scoreEval.id);
        return { id: r.evaluation?.id ?? scoreEval.id, status: r.evaluation?.status ?? "unknown" };
      },
      ["complete", "failed"],
      8_000,
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
    datasetVersions: { nerVersion, clueVersion, scoreVersion },
    datasetNames: { ner: nerDatasetName, clue: clueDatasetName, scoring: scoreDatasetName },
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
