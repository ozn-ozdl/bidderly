// Pioneer evaluation adapter.
//
// Wraps:
//   - POST /felix/evaluations          -> runEvaluation
//   - GET  /felix/evaluations/:id      -> getEvaluation
//
// Per Pioneer docs, an evaluation runs a fine-tuned model against a
// labeled dataset and returns f1, precision, recall, plus a per-entity
// breakdown.

import { z } from "zod";

import {
  dryRunGetEvaluation,
  dryRunListEvaluations,
  dryRunNewId,
  dryRunUpsertEvaluation,
  type DryRunEvaluation,
} from "./dry-run-store";
import { isPioneerDryRun, pioneerFetch, PioneerError } from "./client";
import { dryRunGetTrainingJob } from "./dry-run-store";

const createEvaluationResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
});

const evaluationResultSchema = z
  .object({
    f1: z.number().optional(),
    f1_score: z.number().optional(),
    precision: z.number().optional(),
    precision_score: z.number().optional(),
    recall: z.number().optional(),
    recall_score: z.number().optional(),
    per_entity: z
      .array(
        z.object({
          label: z.string(),
          f1: z.number().optional(),
          f1_score: z.number().optional(),
          precision: z.number().optional(),
          precision_score: z.number().optional(),
          recall: z.number().optional(),
          recall_score: z.number().optional(),
          support: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
    per_label: z
      .array(
        z.object({
          label: z.string(),
          f1: z.number().optional(),
          f1_score: z.number().optional(),
          precision: z.number().optional(),
          precision_score: z.number().optional(),
          recall: z.number().optional(),
          recall_score: z.number().optional(),
          support: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
  })
  .partial();

const evaluationEnvelopeSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  result: evaluationResultSchema.optional(),
  f1_score: z.number().nullable().optional(),
  precision_score: z.number().nullable().optional(),
  recall_score: z.number().nullable().optional(),
  created_at: z.string().optional(),
  finished_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type EvaluationEnvelope = z.infer<typeof evaluationEnvelopeSchema>;

// --- Live wrappers ---------------------------------------------------------

export async function runEvaluation(req: { baseModel: string; datasetName: string }) {
  if (isPioneerDryRun()) {
    return startDryRunEvaluation(req);
  }
  // Fastino's evaluation endpoint expects snake_case field names.
  const res = await pioneerFetch<unknown>("/felix/evaluations", {
    method: "POST",
    body: { base_model: req.baseModel, dataset_name: req.datasetName },
  });
  // Response is wrapped in { success, evaluations: [...] }
  const wrapped = res.data as { success?: boolean; evaluations?: Array<{ id: string; status: string }> };
  const eval0 = wrapped.evaluations?.[0];
  if (eval0) {
    return { id: eval0.id, status: eval0.status, source: "live" as const };
  }
  const parsed = createEvaluationResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /felix/evaluations returned an unexpected body.");
  }
  return { id: parsed.data.id, status: parsed.data.status, source: "live" as const };
}

export async function getEvaluation(id: string) {
  if (isPioneerDryRun()) {
    return pollDryRunEvaluation(id);
  }
  const res = await pioneerFetch<unknown>(`/felix/evaluations/${id}`);
  // Fastino returns the evaluation object directly (no envelope). Normalize
  // snake_case fields into a result sub-object so the dry-run and live
  // shapes are interchangeable.
  const raw = res.data as Record<string, unknown>;
  if (raw && !raw.result) {
    const normalized = {
      id: String(raw.id ?? id),
      status: String(raw.status ?? "unknown"),
      result: {
        f1: (raw.f1_score ?? raw.f1) as number | undefined,
        precision: (raw.precision_score ?? raw.precision) as number | undefined,
        recall: (raw.recall_score ?? raw.recall) as number | undefined,
        per_entity: (raw.per_entity as unknown[] | undefined) ?? [],
      },
      created_at: (raw.created_at as string | undefined) ?? undefined,
      finished_at: (raw.completed_at as string | null | undefined) ?? (raw.finished_at as string | undefined) ?? undefined,
    };
    return { source: "live" as const, evaluation: normalized };
  }
  const parsed = evaluationEnvelopeSchema.safeParse(res.data);
  if (!parsed.success) {
    console.error("[pioneer] evaluation poll returned unexpected body", res.data);
    throw new PioneerError(422, "unprocessable_entity", `Pioneer /felix/evaluations/${id} returned an unexpected body.`);
  }
  return { source: "live" as const, evaluation: parsed.data };
}

export async function listEvaluations() {
  if (isPioneerDryRun()) {
    return {
      source: "dry-run" as const,
      evaluations: dryRunListEvaluations().map((e) => ({
        id: e.id,
        status: e.status,
        baseModel: e.baseModel,
        datasetName: e.datasetName,
        result: e.results,
        createdAt: e.createdAt,
        finishedAt: e.finishedAt,
      })),
    };
  }
  // Fastino does not document a list endpoint for evaluations; we
  // surface the dry-run analogue only.
  return { source: "live" as const, evaluations: [] };
}

// --- Dry-run implementation -----------------------------------------------

function startDryRunEvaluation(req: { baseModel: string; datasetName: string }): {
  id: string;
  status: string;
  source: "dry-run";
} {
  const id = dryRunNewId("eval");
  const ev: DryRunEvaluation = {
    id,
    baseModel: req.baseModel,
    datasetName: req.datasetName,
    status: "running",
    createdAt: new Date().toISOString(),
    results: {
      f1: 0,
      precision: 0,
      recall: 0,
      perClass: [],
    },
  };
  dryRunUpsertEvaluation(ev);
  return { id, status: "running", source: "dry-run" };
}

function pollDryRunEvaluation(id: string) {
  const ev = dryRunGetEvaluation(id);
  if (!ev) {
    return { source: "dry-run" as const, evaluation: null };
  }
  if (ev.status === "running") {
    const ageMs = Date.now() - Date.parse(ev.createdAt);
    if (ageMs > 800) {
      const trainingJob = dryRunGetTrainingJob(ev.baseModel);
      const base = trainingJob?.metrics ?? { f1: 0.9, precision: 0.91, recall: 0.89 };
      const perClass = [
        "buyer_issuer",
        "project_name",
        "category",
        "location",
        "deadline",
        "budget_value",
        "contact_persona",
      ].map((label, idx) => ({
        label,
        f1: clamp01(base.f1 - idx * 0.005 - Math.random() * 0.01),
        precision: clamp01(base.precision - idx * 0.004 - Math.random() * 0.01),
        recall: clamp01(base.recall - idx * 0.006 - Math.random() * 0.01),
        support: 10 + Math.floor(Math.random() * 30),
      }));
      const finishedAt = new Date().toISOString();
      const macro = average(perClass);
      dryRunUpsertEvaluation({
        ...ev,
        status: "complete",
        finishedAt,
        results: {
          f1: macro.f1,
          precision: macro.precision,
          recall: macro.recall,
          perClass,
        },
      });
    }
  }
  const updated = dryRunGetEvaluation(id);
  if (!updated) return { source: "dry-run" as const, evaluation: null };
  return {
    source: "dry-run" as const,
    evaluation: {
      id: updated.id,
      status: updated.status,
      result: updated.results,
      created_at: updated.createdAt,
      finished_at: updated.finishedAt,
    },
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number(v.toFixed(4))));
}

function average(rows: Array<{ f1: number; precision: number; recall: number }>) {
  const n = rows.length || 1;
  return {
    f1: clamp01(rows.reduce((s, r) => s + r.f1, 0) / n),
    precision: clamp01(rows.reduce((s, r) => s + r.precision, 0) / n),
    recall: clamp01(rows.reduce((s, r) => s + r.recall, 0) / n),
  };
}
