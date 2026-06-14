// In-memory dry-run state for the Pioneer integration.
//
// The dry-run path returns realistic-looking responses that match the
// Fastino API shapes documented at https://docs.pioneer.ai/. The same
// row formats produced by synthetic-builders.ts feed this store so the
// downstream "training" + "evaluation" steps have real data to work
// with, not empty stubs.
//
// This module is server-only. It is loaded by the inference, dataset,
// training, and evaluation adapters whenever isPioneerDryRun() returns
// true.

import type {
  PioneerClueRow,
  PioneerNerRow,
  PioneerScoringRow,
} from "./schemas";

export type DryRunDataset = {
  name: string;
  taskType: "ner" | "classification" | "decoder";
  rows: PioneerNerRow[] | PioneerClueRow[] | PioneerScoringRow[];
  status: "queued" | "ready" | "failed";
  createdAt: string;
  version: number;
};

export type DryRunTrainingJob = {
  id: string;
  modelName: string;
  baseModel: string;
  trainingType: "lora" | "full";
  trainingAlgorithm: "sft" | "grpo" | "dpo";
  datasetName: string;
  status: "requested" | "running" | "complete" | "failed" | "cancelled";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  metrics?: { f1: number; precision: number; recall: number };
  logs: string[];
  evalSplitName?: string;
  nrEpochs?: number;
  kind?: "ner" | "classification" | "decoder";
};

export type DryRunEvaluation = {
  id: string;
  baseModel: string;
  datasetName: string;
  status: "queued" | "running" | "complete" | "failed";
  createdAt: string;
  finishedAt?: string;
  results: {
    f1: number;
    precision: number;
    recall: number;
    perClass: Array<{ label: string; f1: number; precision: number; recall: number; support: number }>;
  };
};

// Singleton state — survives across requests inside the same Node process.
type State = {
  datasets: Map<string, DryRunDataset>;
  trainingJobs: Map<string, DryRunTrainingJob>;
  evaluations: Map<string, DryRunEvaluation>;
  // Generation jobs are tracked separately because the Pioneer docs model
  // them as a thin async job that eventually lands rows in a dataset.
  generationJobs: Map<
    string,
    {
      jobId: string;
      datasetName: string;
      status: "queued" | "generating" | "ready" | "failed";
      createdAt: string;
      count: number;
    }
  >;
};

declare global {
  var __pioneerDryRun: State | undefined;
}

function state(): State {
  if (!globalThis.__pioneerDryRun) {
    globalThis.__pioneerDryRun = {
      datasets: new Map(),
      trainingJobs: new Map(),
      evaluations: new Map(),
      generationJobs: new Map(),
    };
  }
  return globalThis.__pioneerDryRun;
}

export function dryRunGetDataset(name: string): DryRunDataset | undefined {
  return state().datasets.get(name);
}

export function dryRunUpsertDataset(ds: DryRunDataset): void {
  state().datasets.set(ds.name, ds);
}

export function dryRunListDatasets(): DryRunDataset[] {
  return Array.from(state().datasets.values());
}

export function dryRunGetGenerationJob(jobId: string) {
  return state().generationJobs.get(jobId);
}

export function dryRunUpsertGenerationJob(
  job: NonNullable<ReturnType<typeof dryRunGetGenerationJob>>,
): void {
  state().generationJobs.set(job.jobId, job);
}

export function dryRunGetTrainingJob(id: string): DryRunTrainingJob | undefined {
  return state().trainingJobs.get(id);
}

export function dryRunUpsertTrainingJob(job: DryRunTrainingJob): void {
  state().trainingJobs.set(job.id, job);
}

export function dryRunListTrainingJobs(): DryRunTrainingJob[] {
  return Array.from(state().trainingJobs.values());
}

export function dryRunGetEvaluation(id: string): DryRunEvaluation | undefined {
  return state().evaluations.get(id);
}

export function dryRunUpsertEvaluation(ev: DryRunEvaluation): void {
  state().evaluations.set(ev.id, ev);
}

export function dryRunListEvaluations(): DryRunEvaluation[] {
  return Array.from(state().evaluations.values());
}

export function dryRunReset(): void {
  state().datasets.clear();
  state().trainingJobs.clear();
  state().evaluations.clear();
  state().generationJobs.clear();
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function dryRunNewId(prefix: string): string {
  return nextId(prefix);
}
