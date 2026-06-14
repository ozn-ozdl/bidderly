"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Database, Brain, Gauge, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/cn";

type PioneerDataset = {
  name: string;
  task_type: "ner" | "classification" | "decoder";
  status: "queued" | "generating" | "ready" | "failed";
  count: number;
  version: number;
  created_at: string;
};

type GenerationJob = {
  kind: "ner" | "classification" | "decoder";
  jobId: string;
  status: string;
  source: "live" | "dry-run";
  datasetName: string;
};

type TrainingJob = {
  id: string;
  status: string;
  source?: "live" | "dry-run";
  metrics?: { f1: number; precision: number; recall: number };
  created_at?: string;
  finished_at?: string;
};

type GenerationResponse = {
  pioneerDryRun: boolean;
  jobs: GenerationJob[];
};

type DatasetsResponse = {
  pioneerDryRun: boolean;
  datasets: { source: "live" | "dry-run"; datasets: PioneerDataset[] };
};

type TrainResponse = {
  pioneerDryRun: boolean;
  jobs: Array<{ kind: string; id: string; status: string; source: "live" | "dry-run"; modelName: string; baseModel: string; datasetName: string }>;
};

type StatusResponse = {
  pioneerDryRun: boolean;
  jobs: Array<{ id: string; status: string; metrics?: { f1: number; precision: number; recall: number }; created_at?: string; finished_at?: string }>;
};

export function PioneerView() {
  const [pioneerDryRun, setPioneerDryRun] = useState(true);
  const [datasets, setDatasets] = useState<PioneerDataset[]>([]);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isTraining, setIsTraining] = useState(false);

  const refreshDatasets = useCallback(async () => {
    try {
      const response = await fetch("/api/pioneer/synthesize/status", { method: "GET" });
      if (!response.ok) return;
      const payload = (await response.json()) as DatasetsResponse;
      setPioneerDryRun(payload.pioneerDryRun);
      setDatasets(payload.datasets.datasets);
    } catch (err) {
      console.error("[pioneer] dataset list failed", err);
    }
  }, []);

  const refreshTrainingJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/pioneer/train/status", { method: "GET" });
      if (!response.ok) return;
      const payload = (await response.json()) as { pioneerDryRun: boolean; jobs: { source: "live" | "dry-run"; jobs: TrainingJob[] } };
      setPioneerDryRun(payload.pioneerDryRun);
      setTrainingJobs(payload.jobs.jobs);
    } catch (err) {
      console.error("[pioneer] training list failed", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [dRes, tRes] = await Promise.all([
          fetch("/api/pioneer/synthesize/status", { method: "GET" }),
          fetch("/api/pioneer/train/status", { method: "GET" }),
        ]);
        if (cancelled) return;
        if (dRes.ok) {
          const payload = (await dRes.json()) as DatasetsResponse;
          if (!cancelled) {
            setPioneerDryRun(payload.pioneerDryRun);
            setDatasets(payload.datasets.datasets);
          }
        }
        if (tRes.ok) {
          const payload = (await tRes.json()) as { pioneerDryRun: boolean; jobs: { source: "live" | "dry-run"; jobs: TrainingJob[] } };
          if (!cancelled) {
            setPioneerDryRun(payload.pioneerDryRun);
            setTrainingJobs(payload.jobs.jobs);
          }
        }
      } catch (err) {
        if (!cancelled) console.error("[pioneer] initial load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerSynthesize = useCallback(async () => {
    setIsSynthesizing(true);
    try {
      const response = await fetch("/api/pioneer/synthesize", { method: "POST" });
      const payload = (await response.json()) as GenerationResponse;
      setPioneerDryRun(payload.pioneerDryRun);
      setGenerationJobs(payload.jobs);
      await refreshDatasets();
    } catch (err) {
      console.error("[pioneer] synthesize failed", err);
    } finally {
      setIsSynthesizing(false);
    }
  }, [refreshDatasets]);

  const triggerTrain = useCallback(async () => {
    setIsTraining(true);
    try {
      const response = await fetch("/api/pioneer/train", { method: "POST" });
      const payload = (await response.json()) as TrainResponse;
      setPioneerDryRun(payload.pioneerDryRun);
      // Poll status for ~3 seconds.
      const ids = payload.jobs.map((j) => j.id);
      for (let i = 0; i < 6; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const statusResponse = await fetch("/api/pioneer/train/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobIds: ids }),
        });
        const statusPayload = (await statusResponse.json()) as StatusResponse;
        setTrainingJobs(statusPayload.jobs);
        if (statusPayload.jobs.every((j) => j.status === "complete" || j.status === "failed" || j.status === "cancelled")) {
          break;
        }
      }
      await refreshTrainingJobs();
    } catch (err) {
      console.error("[pioneer] train failed", err);
    } finally {
      setIsTraining(false);
    }
  }, [refreshTrainingJobs]);

  return (
    <div className="space-y-5">
      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] bg-accent text-bg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">Pioneer pipeline</div>
            <h2 className="mt-1 font-display text-2xl tracking-display sm:text-3xl">
              Fine-tune the cascade.
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-3">
              Generate synthetic tender-extraction and scoring rows, then
              fine-tune Pioneer GLiNER2 and Gemma 4 against them. The same
              rows are used to train and to align the mock tender pages
              served at <span className="font-mono">/mock-tenders</span>,
              so entity spans land on the same character offsets at train
              and serve time.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PioneerBadge dryRun={pioneerDryRun} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                api · {pioneerDryRun ? "dry-run" : "live"} · api.pioneer.ai
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-mute" />
            <SectionLabel>Datasets</SectionLabel>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            {datasets.length} ready
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={refreshDatasets} disabled={isSynthesizing}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={triggerSynthesize} disabled={isSynthesizing}>
              {isSynthesizing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Synthesizing
                </>
              ) : (
                "Synthesize rows"
              )}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["ner", "classification", "decoder"] as const).map((kind) => {
            const ds = datasets.find((d) => d.task_type === kind);
            return (
              <DatasetCard
                key={kind}
                kind={kind}
                dataset={ds}
                lastJob={generationJobs.find((j) => j.kind === kind)}
              />
            );
          })}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-ink-mute" />
            <SectionLabel>Training jobs</SectionLabel>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            {trainingJobs.length} total
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={triggerTrain} disabled={isTraining}>
              {isTraining ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Training
                </>
              ) : (
                "Train all"
              )}
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {trainingJobs.length === 0 ? (
            <div className="rounded-[var(--radius-sm)] border border-dashed border-rule p-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              no training jobs yet
            </div>
          ) : (
            trainingJobs.map((job) => <TrainingRow key={job.id} job={job} />)
          )}
        </div>
      </Card>
    </div>
  );
}

function DatasetCard({
  kind,
  dataset,
  lastJob,
}: {
  kind: "ner" | "classification" | "decoder";
  dataset: PioneerDataset | undefined;
  lastJob: GenerationJob | undefined;
}) {
  const title = kind === "ner" ? "GLiNER2 NER" : kind === "classification" ? "GLiNER2 clues" : "Gemma 4 scoring";
  const subtitle =
    kind === "ner"
      ? "Buyer, project, deadline, budget..."
      : kind === "classification"
        ? "budget_approved, deadline_near, ..."
        : "Decoder SFT rows for score + route";
  const count = dataset?.count ?? 0;
  const version = dataset?.version ?? 0;
  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-rule bg-bg-sunk px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute">
          {kind}
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          v{version}
        </span>
      </div>
      <div className="mt-2 font-display text-lg tracking-display">{title}</div>
      <p className="mt-1 text-[12px] text-ink-3">{subtitle}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl tracking-display tnum">{count}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">rows</span>
      </div>
      <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        {dataset ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-good" />
            {dataset.status}
          </>
        ) : lastJob ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {lastJob.status}
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3 text-ink-faint" />
            not generated
          </>
        )}
      </div>
    </div>
  );
}

function TrainingRow({ job }: { job: TrainingJob }) {
  const isComplete = job.status === "complete";
  const isFailed = job.status === "failed" || job.status === "cancelled";
  return (
    <div className="grid grid-cols-1 gap-3 rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr] sm:items-center">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{job.id}</div>
        <div className="mt-0.5 truncate font-display text-base tracking-display">
          {job.created_at ? new Date(job.created_at).toLocaleString() : "queued"}
        </div>
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        {job.source ?? "live"}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em]">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5",
            isComplete
              ? "border-good-soft bg-good-soft text-good"
              : isFailed
                ? "border-signal-soft bg-signal-soft text-signal"
                : "border-warn-soft bg-warn-soft text-warn",
          )}
        >
          {job.status}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ink-2">
        <Gauge className="h-3.5 w-3.5 text-ink-mute" />
        {job.metrics ? (
          <span className="font-mono tnum">
            f1 {(job.metrics.f1 * 100).toFixed(1)} · p {(job.metrics.precision * 100).toFixed(1)} · r {(job.metrics.recall * 100).toFixed(1)}
          </span>
        ) : (
          <span className="font-mono text-ink-mute">—</span>
        )}
      </div>
    </div>
  );
}

function PioneerBadge({ dryRun }: { dryRun: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]",
        dryRun
          ? "border-warn-soft bg-warn-soft text-warn"
          : "border-good-soft bg-good-soft text-good",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dryRun ? "bg-warn" : "bg-good")} />
      {dryRun ? "dry-run" : "live"}
    </span>
  );
}
