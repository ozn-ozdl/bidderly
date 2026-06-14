// Pioneer dataset and synthetic data generation adapter.
//
// Wraps:
//   - POST /generate                  -> startSyntheticGenerationJob
//   - GET  /generate/jobs/:id         -> pollGenerationJob
//   - GET  /felix/datasets            -> listDatasets
//   - GET  /felix/datasets/:name      -> getDataset
//
// The dry-run path produces NER, classification, and decoder rows from
// the in-app fixtures and lands them in the in-memory store so the rest
// of the pipeline can train/evaluate against realistic data.

import { z } from "zod";

import {
  dryRunGetDataset,
  dryRunGetGenerationJob,
  dryRunListDatasets,
  dryRunNewId,
  dryRunUpsertDataset,
  dryRunUpsertGenerationJob,
  type DryRunDataset,
} from "./dry-run-store";
import {
  buildClueRowsFromExamples,
  buildClueRowsFromExtractions,
  buildNerRowsFromExamples,
  buildNerRowsFromExtractions,
  buildScoringRows,
} from "./synthetic-builders";
import {
  isPioneerDryRun,
  pioneerFetch,
  PioneerError,
} from "./client";
import { syntheticTrainingExamples } from "@/lib/demo-data";
import { getRadarSnapshot } from "@/lib/demo-data";
import {
  type ClueLabel,
  clueLabelSchema,
  type EntityLabel,
  type PioneerClueRow,
  type PioneerNerRow,
  type PioneerScoringRow,
  SCORING_PROMPT_HEADER,
} from "./schemas";
import type { Extraction, Finding, ModelScore, SyntheticTrainingExample } from "@/lib/radar-types";

// --- Live schemas (subset of what Fastino returns) -------------------------

const generateJobResponseSchema = z.object({
  job_id: z.string().min(1),
  status: z.string().min(1),
});

const generateJobStatusSchema = z.object({
  job_id: z.string().min(1),
  status: z.string().min(1),
  dataset_name: z.string().optional(),
  count: z.number().int().nonnegative().nullable().optional(),
  data: z.unknown().nullable().optional(),
  error: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

const datasetVersionSchema = z.object({
  status: z.string().min(1),
  count: z.number().int().nonnegative().optional(),
  version: z.number().int().optional(),
  created_at: z.string().optional(),
});

// Live API returns a flat list — each item is one version, not a
// "dataset with latest_version" wrapper. Field names also differ
// from the docs: `dataset_name` (not `name`), `sample_size` (not
// `count` in latest_version), `version_number` (returned as a
// STRING, e.g. "1"). We accept both shapes so dry-run and live
// callers can use the same surface.
const datasetListItemSchema = z.object({
  name: z.string().min(1).optional(),
  dataset_name: z.string().min(1).optional(),
  task_type: z.string().optional(),
  dataset_type: z.string().optional(),
  version: z.union([z.number().int(), z.string()]).optional(),
  version_number: z.union([z.number().int(), z.string()]).optional(),
  count: z.number().int().nonnegative().optional(),
  sample_size: z.number().int().nonnegative().nullable().optional(),
  status: z.string().min(1).optional(),
  latest_version: datasetVersionSchema.optional(),
  created_at: z.string().optional(),
});

const datasetListSchema = z.object({
  datasets: z.array(datasetListItemSchema).default([]),
  // Live API also returns { success, count } alongside `datasets`; we
  // ignore them in callers but allow them in the schema.
  success: z.boolean().optional(),
  count: z.number().int().nonnegative().optional(),
});

export type GenerateJobStatus = z.infer<typeof generateJobStatusSchema>;

// --- Public surface: live + dry-run ----------------------------------------

export type GenerationRequest =
  | {
      kind: "ner";
      datasetName: string;
      numExamples: number;
      domainDescription: string;
      labels: readonly EntityLabel[];
    }
  | {
      kind: "classification";
      datasetName: string;
      numExamples: number;
      domainDescription: string;
      labels: readonly ClueLabel[];
    }
  | {
      kind: "decoder";
      datasetName: string;
      numExamples: number;
      domainDescription: string;
      prompt: string;
    };

export async function startGenerationJob(
  req: GenerationRequest,
): Promise<{ jobId: string; status: string; source: "live" | "dry-run" }> {
  if (isPioneerDryRun()) {
    return startDryRunGenerationJob(req);
  }

  const body =
    req.kind === "decoder"
      ? {
          task_type: "decoder",
          dataset_name: req.datasetName,
          num_examples: req.numExamples,
          domain_description: req.domainDescription,
          prompt: req.prompt,
        }
      : {
          task_type: req.kind,
          dataset_name: req.datasetName,
          num_examples: req.numExamples,
          labels: [...req.labels],
          domain_description: req.domainDescription,
        };

  const res = await pioneerFetch<unknown>("/generate", {
    method: "POST",
    body,
  });
  const parsed = generateJobResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /generate returned an unexpected body.");
  }
  return { jobId: parsed.data.job_id, status: parsed.data.status, source: "live" };
}

export async function pollGenerationJob(
  jobId: string,
): Promise<GenerateJobStatus> {
  if (isPioneerDryRun()) {
    return pollDryRunGenerationJob(jobId);
  }

  const res = await pioneerFetch<unknown>(`/generate/jobs/${jobId}`);
  const parsed = generateJobStatusSchema.safeParse(res.data);
  if (!parsed.success) {
    // Surface the raw body so we can diagnose unexpected schemas live.
    console.error("[pioneer] generate job poll returned unexpected body", res.data);
    throw new PioneerError(422, "unprocessable_entity", `Pioneer /generate/jobs/${jobId} returned an unexpected body.`);
  }
  return parsed.data;
}

export async function listDatasets() {
  if (isPioneerDryRun()) {
    return {
      source: "dry-run" as const,
      datasets: dryRunListDatasets().map((d) => ({
        name: d.name,
        task_type: d.taskType,
        status: d.status,
        count: d.rows.length,
        version: d.version,
        created_at: d.createdAt,
      })),
    };
  }

  const res = await pioneerFetch<unknown>("/felix/datasets");
  const parsed = datasetListSchema.safeParse(res.data);
  if (!parsed.success) {
    console.error("[pioneer] /felix/datasets returned unexpected body", res.data);
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /felix/datasets returned an unexpected body.");
  }
  // Normalize live items so callers see the same shape regardless of source.
  const datasets = parsed.data.datasets.map((d) => {
    const v = d.latest_version?.version ?? d.version ?? d.version_number;
    return {
      name: d.name ?? d.dataset_name ?? "",
      task_type: (d.task_type ?? d.dataset_type) as "ner" | "classification" | "decoder" | undefined,
      status: d.latest_version?.status ?? d.status,
      count: d.latest_version?.count ?? d.count ?? d.sample_size ?? 0,
      version: typeof v === "string" ? Number(v) : v,
      created_at: d.latest_version?.created_at ?? d.created_at,
    };
  });
  return { source: "live" as const, datasets };
}

export async function getDataset(name: string) {
  if (isPioneerDryRun()) {
    const ds = dryRunGetDataset(name);
    if (!ds) return { source: "dry-run" as const, dataset: null };
    return {
      source: "dry-run" as const,
      dataset: {
        name: ds.name,
        task_type: ds.taskType,
        status: ds.status,
        count: ds.rows.length,
        version: ds.version,
        created_at: ds.createdAt,
      },
    };
  }
  const res = await pioneerFetch<unknown>(`/felix/datasets/${name}`);
  const parsed = datasetListItemSchema.safeParse(res.data);
  if (!parsed.success) {
    return { source: "live" as const, dataset: null };
  }
  const d = parsed.data;
  const v = d.latest_version?.version ?? d.version ?? d.version_number;
  return {
    source: "live" as const,
    dataset: {
      name: d.name ?? d.dataset_name ?? name,
      task_type: (d.task_type ?? d.dataset_type) as "ner" | "classification" | "decoder" | undefined,
      status: d.latest_version?.status ?? d.status,
      count: d.latest_version?.count ?? d.count ?? d.sample_size ?? 0,
      version: typeof v === "string" ? Number(v) : v,
      created_at: d.latest_version?.created_at ?? d.created_at,
    },
  };
}

// --- Dry-run implementation ------------------------------------------------

async function startDryRunGenerationJob(
  req: GenerationRequest,
): Promise<{ jobId: string; status: string; source: "dry-run" }> {
  const jobId = dryRunNewId("gen");
  const job = {
    jobId,
    datasetName: req.datasetName,
    status: "generating" as const,
    createdAt: new Date().toISOString(),
    count: 0,
  };
  dryRunUpsertGenerationJob(job);

  // The rows we would have sent to Fastino are persisted synchronously so
  // the alignment preview is deterministic.
  const rows = await buildDryRunRows(req);
  const ds: DryRunDataset = {
    name: req.datasetName,
    taskType: req.kind,
    rows,
    status: "ready",
    createdAt: new Date().toISOString(),
    version: (dryRunGetDataset(req.datasetName)?.version ?? 0) + 1,
  };
  dryRunUpsertDataset(ds);

  dryRunUpsertGenerationJob({
    ...job,
    status: "ready",
    count: rows.length,
  });

  return { jobId, status: "ready", source: "dry-run" };
}

async function buildDryRunRows(
  req: GenerationRequest,
): Promise<PioneerNerRow[] | PioneerClueRow[] | PioneerScoringRow[]> {
  const snapshot = getRadarSnapshot();

  if (req.kind === "ner") {
    const handWritten = buildNerRowsFromExamples(syntheticTrainingExamples);
    const fromLive = buildNerRowsFromExtractions(snapshot.findings, snapshot.extractions);
    return [...handWritten, ...fromLive];
  }

  if (req.kind === "classification") {
    const handWritten = buildClueRowsFromExamples(syntheticTrainingExamples);
    const fromLive = buildClueRowsFromExtractions(snapshot.findings, snapshot.extractions);
    return [...handWritten, ...fromLive];
  }

  return buildScoringRows(snapshot.findings, snapshot.extractions, snapshot.scores);
}

async function pollDryRunGenerationJob(jobId: string): Promise<GenerateJobStatus> {
  const job = dryRunGetGenerationJob(jobId);
  if (!job) {
    return { job_id: jobId, status: "failed", error: "Unknown job id." };
  }
  return {
    job_id: job.jobId,
    status: job.status,
    dataset_name: job.datasetName,
    count: job.count,
    created_at: job.createdAt,
    error: null,
  };
}

// --- Convenience: build the domain description shared by all jobs ---------

export const PIONEER_DOMAIN_DESCRIPTION = [
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

export const PIONEER_DECODER_PROMPT = [
  SCORING_PROMPT_HEADER,
  "",
  "Score 0-100. Pick urgency low/medium/high. Pick route",
  "ignore/monitor/qualify/human_review. Always include a one-sentence",
  "rationale that cites at least one clue tag and at least one entity",
  "(e.g. a deadline or budget entity).",
].join("\n");

// --- Convenience used by the synthesize route ------------------------------

export function makeGenerationRequests(
  overrides?: Partial<{
    nerDataset: string;
    clueDataset: string;
    scoringDataset: string;
    nerExamples: number;
    clueExamples: number;
    scoringExamples: number;
  }>,
): GenerationRequest[] {
  const ENTITY_LABELS_FALLBACK: readonly EntityLabel[] = [
    "buyer_issuer",
    "project_name",
    "category",
    "location",
    "deadline",
    "budget_value",
    "contact_persona",
  ] as const;
  const CLUE_LABELS_FALLBACK: readonly ClueLabel[] = clueLabelSchema.options;

  return [
    {
      kind: "ner",
      datasetName: overrides?.nerDataset ?? process.env.PIONEER_NER_DATASET ?? "bidderly-tender-ner",
      numExamples: overrides?.nerExamples ?? 50,
      labels: ENTITY_LABELS_FALLBACK,
      domainDescription: PIONEER_DOMAIN_DESCRIPTION,
    },
    {
      kind: "classification",
      datasetName: overrides?.clueDataset ?? process.env.PIONEER_CLUE_DATASET ?? "bidderly-tender-clues",
      numExamples: overrides?.clueExamples ?? 50,
      labels: CLUE_LABELS_FALLBACK,
      domainDescription: PIONEER_DOMAIN_DESCRIPTION,
    },
    {
      kind: "decoder",
      datasetName: overrides?.scoringDataset ?? process.env.PIONEER_SCORING_DATASET ?? "bidderly-tender-scoring",
      numExamples: overrides?.scoringExamples ?? 30,
      domainDescription: PIONEER_DOMAIN_DESCRIPTION,
      prompt: PIONEER_DECODER_PROMPT,
    },
  ];
}

// Re-export the entity/clue labels so callers can read them without a second
// import path. (Keeps the synthetic-builders import graph shallow.)
export { clueLabelSchema };

// Type re-exports to keep callers decoupled from the schemas file path.
export type { PioneerClueRow, PioneerNerRow, PioneerScoringRow };

// Suppress unused-export lint while keeping the surface for type re-exports.
type _Keep = Extraction | Finding | ModelScore | SyntheticTrainingExample;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _keep: _Keep | undefined = undefined;
