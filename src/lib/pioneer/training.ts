// Pioneer training-jobs adapter.
//
// Wraps:
//   - POST /felix/training-jobs               -> startTrainingJob
//   - GET  /felix/training-jobs               -> listTrainingJobs
//   - GET  /felix/training-jobs/:id           -> pollTrainingJob
//   - GET  /felix/training-jobs/:id/logs      -> getTrainingLogs
//   - GET  /felix/training-jobs/:id/checkpoints -> listCheckpoints
//   - POST /felix/training-jobs/:id/stop      -> stopTrainingJob
//   - GET  /felix/training-jobs/:id/download  -> downloadTrainingJob
//
// The dry-run path simulates the requested -> running -> complete
// transition with realistic per-task metrics so the rest of the
// pipeline can be exercised without burning live credits.

import { z } from "zod";

import {
  dryRunGetTrainingJob,
  dryRunListTrainingJobs,
  dryRunNewId,
  dryRunUpsertTrainingJob,
  type DryRunTrainingJob,
} from "./dry-run-store";
import { isPioneerDryRun, pioneerFetch, PioneerError } from "./client";

const createJobResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
});

const metricsSchema = z
  .object({
    f1: z.number(),
    precision: z.number(),
    recall: z.number(),
  })
  .partial()
  .nullable();

const jobStatusSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  normalized_status: z.string().optional(),
  metrics: metricsSchema.optional(),
  created_at: z.string().optional(),
  finished_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  progress_percent: z.number().nullable().optional(),
});

const jobListSchema = z.object({
  jobs: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.string().min(1),
        normalized_status: z.string().optional(),
        metrics: metricsSchema.optional(),
        created_at: z.string().optional(),
        finished_at: z.string().optional(),
        completed_at: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const jobLogsSchema = z.object({
  logs: z.string().default(""),
});

const checkpointListSchema = z.object({
  checkpoints: z
    .array(
      z.object({
        id: z.string().min(1),
        step: z.number().int().optional(),
        metrics: metricsSchema.optional(),
      }),
    )
    .default([]),
});

export type TrainingJobStatus = z.infer<typeof jobStatusSchema>;

export type TrainingRequest =
  | {
      kind: "ner" | "classification";
      modelName: string;
      baseModel: string;
      datasetName: string;
      datasetVersion?: string;
      trainingType?: "lora" | "full";
      nrEpochs?: number;
      learningRate?: number;
    }
  | {
      kind: "decoder";
      modelName: string;
      baseModel: string;
      datasetName: string;
      datasetVersion?: string;
      trainingType?: "lora";
      trainingAlgorithm?: "sft" | "grpo" | "dpo";
      nrEpochs?: number;
      learningRate?: number;
    };

export type TrainingJobKind = TrainingRequest["kind"];

// --- Live wrappers ---------------------------------------------------------

export async function startTrainingJob(
  req: TrainingRequest,
): Promise<{ id: string; status: string; source: "live" | "dry-run" }> {
  if (isPioneerDryRun()) {
    return startDryRunTrainingJob(req);
  }

  const body =
    req.kind === "decoder"
      ? {
          model_name: req.modelName,
          base_model: req.baseModel,
          datasets: [{ name: req.datasetName, version: req.datasetVersion ?? "1" }],
          training_type: req.trainingType ?? "lora",
          training_algorithm: req.trainingAlgorithm ?? "sft",
          nr_epochs: req.nrEpochs ?? 3,
          learning_rate: req.learningRate ?? 2e-5,
        }
      : {
          model_name: req.modelName,
          base_model: req.baseModel,
          datasets: [{ name: req.datasetName, version: req.datasetVersion ?? "1" }],
          training_type: req.trainingType ?? "lora",
          nr_epochs: req.nrEpochs ?? 5,
          learning_rate: req.learningRate ?? 5e-5,
        };

  const res = await pioneerFetch<unknown>("/felix/training-jobs", {
    method: "POST",
    body,
  });
  const parsed = createJobResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /felix/training-jobs returned an unexpected body.");
  }
  return { id: parsed.data.id, status: parsed.data.status, source: "live" };
}

export async function pollTrainingJob(id: string): Promise<TrainingJobStatus> {
  if (isPioneerDryRun()) {
    return pollDryRunTrainingJob(id);
  }
  const res = await pioneerFetch<unknown>(`/felix/training-jobs/${id}`);
  const parsed = jobStatusSchema.safeParse(res.data);
  if (!parsed.success) {
    console.error("[pioneer] training job poll returned unexpected body", res.data);
    throw new PioneerError(422, "unprocessable_entity", `Pioneer /felix/training-jobs/${id} returned an unexpected body.`);
  }
  // Prefer normalized_status (Fastino uses e.g. "running", "complete") over
  // the sometimes-inconsistent "status" string.
  const status = parsed.data.normalized_status ?? parsed.data.status;
  return { ...parsed.data, status };
}

export async function listTrainingJobs(filter?: { status?: string }) {
  if (isPioneerDryRun()) {
    const all = dryRunListTrainingJobs();
    const filtered = filter
      ? all.filter((j) => j.status === filter.status)
      : all;
    return {
      source: "dry-run" as const,
      jobs: filtered.map((j) => ({
        id: j.id,
        status: j.status,
        metrics: j.metrics,
        created_at: j.createdAt,
        finished_at: j.finishedAt,
      })),
    };
  }
  const res = await pioneerFetch<unknown>("/felix/training-jobs", {
    query: filter?.status ? { status: filter.status } : undefined,
  });
  const parsed = jobListSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /felix/training-jobs (list) returned an unexpected body.");
  }
  return { source: "live" as const, jobs: parsed.data.jobs };
}

export async function getTrainingLogs(id: string) {
  if (isPioneerDryRun()) {
    const job = dryRunGetTrainingJob(id);
    return { source: "dry-run" as const, logs: job?.logs.join("\n") ?? "" };
  }
  const res = await pioneerFetch<unknown>(`/felix/training-jobs/${id}/logs`);
  const parsed = jobLogsSchema.safeParse(res.data);
  if (!parsed.success) {
    return { source: "live" as const, logs: "" };
  }
  return { source: "live" as const, logs: parsed.data.logs };
}

export async function listCheckpoints(id: string) {
  if (isPioneerDryRun()) {
    const job = dryRunGetTrainingJob(id);
    if (!job) {
      return { source: "dry-run" as const, checkpoints: [] as Array<{ id: string; step?: number; metrics?: { f1?: number; precision?: number; recall?: number } }> };
    }
    const idBase = job.id;
    const epochs = job.nrEpochs ?? 3;
    return {
      source: "dry-run" as const,
      checkpoints: [
        { id: `${idBase}-ckpt-1`, step: Math.max(1, Math.floor(epochs / 3)) },
        { id: `${idBase}-ckpt-2`, step: Math.max(2, Math.floor((epochs * 2) / 3)) },
        { id: `${idBase}-ckpt-final`, step: epochs, metrics: job.metrics },
      ],
    };
  }
  const res = await pioneerFetch<unknown>(`/felix/training-jobs/${id}/checkpoints`);
  const parsed = checkpointListSchema.safeParse(res.data);
  if (!parsed.success) {
    return { source: "live" as const, checkpoints: [] };
  }
  return { source: "live" as const, checkpoints: parsed.data.checkpoints };
}

export async function stopTrainingJob(id: string) {
  if (isPioneerDryRun()) {
    const job = dryRunGetTrainingJob(id);
    if (job && (job.status === "requested" || job.status === "running")) {
      dryRunUpsertTrainingJob({ ...job, status: "cancelled", finishedAt: new Date().toISOString() });
    }
    return { source: "dry-run" as const, status: "cancelled" };
  }
  await pioneerFetch<unknown>(`/felix/training-jobs/${id}/stop`, { method: "POST" });
  return { source: "live" as const, status: "cancelled" };
}

export async function downloadTrainingJob(id: string) {
  if (isPioneerDryRun()) {
    const job = dryRunGetTrainingJob(id);
    if (!job || job.status !== "complete") {
      throw new PioneerError(409, "not_ready", "Training job has not completed yet.");
    }
    return {
      source: "dry-run" as const,
      downloadUrl: `https://example.invalid/dry-run/${job.id}.tar.gz`,
      sizeBytes: 1024 * 1024,
    };
  }
  const res = await pioneerFetch<{ url?: string; size_bytes?: number }>(
    `/felix/training-jobs/${id}/download`,
  );
  return {
    source: "live" as const,
    downloadUrl: res.data.url ?? "",
    sizeBytes: res.data.size_bytes ?? 0,
  };
}

// --- Dry-run implementation -----------------------------------------------

const KIND_BASE_METRICS: Record<TrainingJobKind, { f1: number; precision: number; recall: number }> = {
  ner: { f1: 0.93, precision: 0.94, recall: 0.92 },
  classification: { f1: 0.91, precision: 0.93, recall: 0.89 },
  decoder: { f1: 0.88, precision: 0.89, recall: 0.87 },
};

function startDryRunTrainingJob(
  req: TrainingRequest,
): { id: string; status: string; source: "dry-run" } {
  const id = dryRunNewId("job");
  const now = new Date().toISOString();
  const job: DryRunTrainingJob = {
    id,
    modelName: req.modelName,
    baseModel: req.baseModel,
    trainingType: req.trainingType ?? "lora",
    trainingAlgorithm: req.kind === "decoder" ? req.trainingAlgorithm ?? "sft" : "sft",
    datasetName: req.datasetName,
    status: "running",
    createdAt: now,
    startedAt: now,
    logs: [
      `[${now}] provisioning compute`,
      `[${now}] loading base model ${req.baseModel}`,
      `[${now}] adapter r=16 alpha=32 target_modules=q_proj,v_proj`,
      `[${now}] training on dataset ${req.datasetName}`,
    ],
    evalSplitName: req.datasetName.replace(/-train$/, "-eval"),
    nrEpochs: req.nrEpochs ?? (req.kind === "decoder" ? 3 : 5),
    kind: req.kind,
  };

  dryRunUpsertTrainingJob(job);
  return { id, status: job.status, source: "dry-run" };
}

function pollDryRunTrainingJob(id: string): TrainingJobStatus {
  const job = dryRunGetTrainingJob(id);
  if (!job) {
    return { id, status: "failed" };
  }

  if (job.status === "running") {
    const createdAt = Date.parse(job.createdAt);
    const ageMs = Date.now() - createdAt;
    const shouldFinish = ageMs > 1_500;
    if (shouldFinish) {
      const base = KIND_BASE_METRICS[job.kind ?? deriveKindFromBase(job.baseModel)];
      const metrics = jitterMetrics(base);
      const finishedAt = new Date().toISOString();
      dryRunUpsertTrainingJob({
        ...job,
        status: "complete",
        finishedAt,
        metrics,
        logs: [
          ...job.logs,
          `[${finishedAt}] epoch ${job.nrEpochs ?? "?"} complete`,
          `[${finishedAt}] eval f1=${metrics.f1.toFixed(3)} precision=${metrics.precision.toFixed(3)} recall=${metrics.recall.toFixed(3)}`,
          `[${finishedAt}] checkpoint final -> deployed`,
        ],
      });
    } else {
      dryRunUpsertTrainingJob({
        ...job,
        logs: [
          ...job.logs,
          `[${new Date().toISOString()}] step ${Math.floor(ageMs / 200)} loss=...`,
        ],
      });
    }
  }

  const updated = dryRunGetTrainingJob(id)!;
  return {
    id: updated.id,
    status: updated.status,
    metrics: updated.metrics,
    created_at: updated.createdAt,
    finished_at: updated.finishedAt,
  };
}

function deriveKindFromBase(baseModel: string): TrainingJobKind {
  if (baseModel.includes("gemma") || baseModel.includes("llama") || baseModel.includes("qwen") || baseModel.includes("deepseek")) {
    return "decoder";
  }
  return "classification";
}

function jitterMetrics(base: { f1: number; precision: number; recall: number }) {
  const jitter = (v: number) => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.02));
  return {
    f1: Number(jitter(base.f1).toFixed(4)),
    precision: Number(jitter(base.precision).toFixed(4)),
    recall: Number(jitter(base.recall).toFixed(4)),
  };
}
