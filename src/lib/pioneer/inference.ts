// Pioneer inference adapter.
//
// Wraps the Pioneer /inference endpoint for three task shapes we need:
//
//   1. NER + classification in a single call (multi-head GLiNER2)
//      -> inferExtractionAndClues(finding) replaces the env-var
//         PIONEER_GLINER_ENDPOINT that the cascade used to call.
//
//   2. Decoder call (Gemma 4 scoring)
//      -> inferScoring(finding, extraction) replaces the env-var
//         PIONEER_GEMMA4_ENDPOINT. The prompt is the same one the
//         synthetic scoring rows were trained on (see
//         SCORING_PROMPT_HEADER), so a fine-tuned Gemma 4 sees the
//         same instruction at train and serve time.
//
// Live mode calls POST /inference with the right schema. Dry-run mode
// short-circuits to the canned entities/clues/score that match the
// fixture so the radar UI behaves identically with or without a key.

import { z } from "zod";

import { isPioneerDryRun, pioneerFetch, PioneerError } from "./client";
import { dryRunGetDataset } from "./dry-run-store";
import { extractions, scores, getRadarSnapshot } from "@/lib/demo-data";
import {
  CLUE_LABELS,
  clueLabelSchema,
  ENTITY_LABELS,
  type PioneerScoringRow,
  SCORING_PROMPT_HEADER,
  scoringResultSchema,
} from "./schemas";
import type {
  EntitySpan,
  Extraction,
  ModelScore,
  ProcurementClue,
} from "@/lib/radar-types";
import { buildScoringPrompt } from "./synthetic-builders";

// --- Common inference types ------------------------------------------------

const pioneerInferenceEnvelopeSchema = z.object({
  result: z.unknown(),
  model_id: z.string().optional(),
  confidence: z.number().optional(),
});

type PioneerNerPrediction = {
  label: string;
  text: string;
  start: number;
  end: number;
};

type PioneerClassificationPrediction = {
  task: string;
  labels: string[];
  scores: number[];
};

type PioneerInferenceResponse = {
  result: unknown;
  model_id?: string;
  confidence?: number;
};

export type ExtractionAndClues = {
  entities: ExtractedEntity[];
  clueTags: ProcurementClue[];
  confidence: number;
  rawSpans: Array<PioneerNerPrediction>;
};

export type ExtractedEntity = {
  label: string;
  text: string;
  start: number;
  end: number;
};

// --- NER + classification (multi-head) -------------------------------------

export async function inferExtractionAndClues(finding: {
  rawText: string;
  sourceType?: string;
  url?: string;
  detectedLanguage?: "de" | "en";
  id: string;
  /**
   * Override the entity-extraction model id. When omitted we use the
   * PIONEER_GLINER2_MODEL env var. Two separate model ids only make
   * sense if the operator has trained separate NER and clue
   * classification jobs on Pioneer; for a single multi-head model
   * the operator should set only PIONEER_GLINER2_MODEL and leave
   * PIONEER_CLUES_MODEL unset (it defaults to the same value).
   */
  entityModelId?: string;
  /** Override the classification model id. Defaults to entityModelId. */
  cluesModelId?: string;
}): Promise<ExtractionAndClues> {
  if (isPioneerDryRun()) {
    return dryRunExtractionAndClues(finding);
  }

  const entityModelId = finding.entityModelId ?? process.env.PIONEER_GLINER2_MODEL ?? "fastino/gliner2-base-v1";
  const cluesModelId = finding.cluesModelId ?? entityModelId;
  const useSeparateModels = entityModelId !== cluesModelId;

  if (useSeparateModels) {
    const [entityRes, clues] = await Promise.all([
      runExtractionCall(finding, entityModelId),
      runCluesCall(finding, cluesModelId),
    ]);
    return {
      entities: entityRes.entities as ExtractedEntity[],
      clueTags: clues,
      confidence: entityRes.confidence,
      rawSpans: entityRes.entities as PioneerNerPrediction[],
    };
  }

  const res = await runMultiHeadCall(finding, entityModelId);
  return parseExtractionResponse(res);
}

async function runMultiHeadCall(
  finding: { rawText: string },
  modelId: string,
): Promise<PioneerInferenceResponse> {
  const body = {
    model_id: modelId,
    text: finding.rawText,
    schema: {
      entities: [...ENTITY_LABELS],
      classifications: [
        {
          task: "procurement_clues",
          labels: [...CLUE_LABELS],
          multi_label: true,
        },
      ],
    },
    threshold: 0.4,
  };
  const res = await pioneerFetch<unknown>("/inference", {
    method: "POST",
    body,
  });
  const parsed = pioneerInferenceEnvelopeSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /inference (multi-head) returned an unexpected body.");
  }
  return parsed.data as PioneerInferenceResponse;
}

async function runExtractionCall(
  finding: { rawText: string },
  modelId: string,
): Promise<{ entities: PioneerNerPrediction[]; confidence: number }> {
  const body = {
    model_id: modelId,
    text: finding.rawText,
    schema: { entities: [...ENTITY_LABELS] },
    threshold: 0.4,
  };
  const res = await pioneerFetch<unknown>("/inference", {
    method: "POST",
    body,
  });
  const parsed = pioneerInferenceEnvelopeSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /inference (NER) returned an unexpected body.");
  }
  const payload = parsed.data as PioneerInferenceResponse;
  const result = (payload.result ?? {}) as { entities?: PioneerNerPrediction[] };
  return {
    entities: result.entities ?? [],
    confidence: payload.confidence ?? 0.85,
  };
}

async function runCluesCall(
  finding: { rawText: string },
  modelId: string,
): Promise<ProcurementClue[]> {
  const body = {
    model_id: modelId,
    text: finding.rawText,
    schema: {
      classifications: [
        {
          task: "procurement_clues",
          labels: [...CLUE_LABELS],
          multi_label: true,
        },
      ],
    },
    threshold: 0.4,
  };
  const res = await pioneerFetch<unknown>("/inference", {
    method: "POST",
    body,
  });
  const parsed = pioneerInferenceEnvelopeSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /inference (clues) returned an unexpected body.");
  }
  const payload = parsed.data as PioneerInferenceResponse;
  const result = (payload.result ?? {}) as {
    classifications?: PioneerClassificationPrediction[];
  };
  const pred = (result.classifications ?? []).find(
    (c) => c.task === "procurement_clues",
  );
  if (!pred) return [];
  const out: ProcurementClue[] = [];
  for (const label of pred.labels) {
    const ok = clueLabelSchema.safeParse(label);
    if (ok.success) out.push(ok.data);
  }
  return out;
}

// --- Decoder (Gemma 4 scoring) --------------------------------------------

export async function inferScoring(
  finding: {
    id: string;
    title: string;
    sourceName?: string;
    sourceType: string;
    detectedLanguage: "de" | "en";
    publishedAt: string;
    rawText: string;
  },
  extraction: Extraction | undefined,
): Promise<ModelScore> {
  if (isPioneerDryRun()) {
    return dryRunScoring(finding, extraction);
  }

  const baseModel = process.env.PIONEER_GEMMA4_MODEL ?? "google/gemma-4-9b-it";
  const prompt = buildScoringPrompt(finding as never, extraction, extraction?.entities ?? {});

  const res = await pioneerFetch<unknown>("/inference", {
    method: "POST",
    body: {
      model_id: baseModel,
      task: "generate",
      messages: [
        { role: "system", content: SCORING_PROMPT_HEADER },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    },
  });
  const parsed = pioneerInferenceEnvelopeSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new PioneerError(422, "unprocessable_entity", "Pioneer /inference (decoder) returned an unexpected body.");
  }

  return parseScoringResponse(parsed.data as PioneerInferenceResponse, finding.id);
}

// --- Parsers ---------------------------------------------------------------

function parseExtractionResponse(payload: PioneerInferenceResponse): ExtractionAndClues {
  const result = (payload.result ?? {}) as {
    entities?: PioneerNerPrediction[];
    classifications?: PioneerClassificationPrediction[];
  };

  const entities = (result.entities ?? []).map((e) => ({
    label: e.label,
    text: e.text,
    start: e.start,
    end: e.end,
  }));

  const cluePrediction = (result.classifications ?? []).find(
    (c) => c.task === "procurement_clues",
  );
  const clueTags: ProcurementClue[] = [];
  if (cluePrediction) {
    for (const label of cluePrediction.labels) {
      const ok = clueLabelSchema.safeParse(label);
      if (ok.success) clueTags.push(ok.data);
    }
  }

  return {
    entities: entities as ExtractedEntity[],
    clueTags,
    confidence: payload.confidence ?? 0.85,
    rawSpans: entities as PioneerNerPrediction[],
  };
}

function parseScoringResponse(
  payload: PioneerInferenceResponse,
  findingId: string,
): ModelScore {
  const text = extractText(payload.result);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!json && typeof payload.result === "object" && payload.result !== null) {
    json = payload.result;
  }

  const parsed = scoringResultSchema.safeParse(json);
  if (!parsed.success) {
    throw new PioneerError(
      422,
      "unprocessable_entity",
      "Gemma 4 returned a scoring payload that did not match the expected schema.",
    );
  }
  return {
    id: `score_${findingId}`,
    findingId,
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: parsed.data.worthOutreachScore,
    urgency: parsed.data.urgency,
    route: parsed.data.route,
    rationale: parsed.data.rationale,
  };
}

function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
    if (Array.isArray((obj as { choices?: unknown[] }).choices)) {
      const choice = (obj as { choices: Array<{ message?: { content?: string } }> }).choices[0];
      if (choice?.message?.content) return choice.message.content;
    }
  }
  return "";
}

// --- Dry-run implementations ----------------------------------------------

function dryRunExtractionAndClues(finding: { id: string; rawText: string }): ExtractionAndClues {
  // Prefer a live training-time extraction if one exists in the fixture.
  const extraction = extractions.find((e) => e.findingId === finding.id);
  if (extraction) {
    return {
      entities: extraction.spans.map((s) => ({
        label: s.label,
        text: s.text,
        start: s.start,
        end: s.end,
      })),
      clueTags: extraction.clueTags,
      confidence: extraction.confidence,
      rawSpans: extraction.spans,
    };
  }

  // Otherwise derive a minimal extraction from the training dry-run dataset
  // so unknown findings still produce something the UI can render.
  const dataset = dryRunGetDataset(process.env.PIONEER_NER_DATASET ?? "bidderly-tender-ner");
  const matches: PioneerNerPrediction[] = [];
  if (dataset) {
    for (const row of dataset.rows as Array<{ text: string; entities: PioneerNerPrediction[] }>) {
      if (row.text === finding.rawText) {
        matches.push(...row.entities);
        break;
      }
    }
  }
  return {
    entities: matches.map((e) => ({ label: e.label, text: e.text, start: e.start, end: e.end })),
    clueTags: [],
    confidence: matches.length > 0 ? 0.85 : 0.5,
    rawSpans: matches,
  };
}

function dryRunScoring(
  finding: { id: string; title: string; sourceName?: string; sourceType: string; detectedLanguage: "de" | "en"; publishedAt: string; rawText: string },
  extraction: Extraction | undefined,
): ModelScore {
  const score = scores.find((s) => s.findingId === finding.id);
  if (score) return score;

  // If the user has generated synthetic scoring rows, reuse one with a
  // matching finding id and re-score using the row's assistant message.
  const dataset = dryRunGetDataset(process.env.PIONEER_SCORING_DATASET ?? "bidderly-tender-scoring");
  if (dataset) {
    const matchingRow = (dataset.rows as PioneerScoringRow[]).find((row) =>
      row.messages.some(
        (m) => m.role === "user" && m.content.includes(finding.title),
      ),
    );
    if (matchingRow) {
      const assistant = matchingRow.messages.find((m) => m.role === "assistant");
      if (assistant) {
        try {
          const parsed = scoringResultSchema.safeParse(JSON.parse(assistant.content));
          if (parsed.success) {
            return {
              id: `score_${finding.id}`,
              findingId: finding.id,
              model: "Pioneer Gemma 4 scoring router",
              worthOutreachScore: parsed.data.worthOutreachScore,
              urgency: parsed.data.urgency,
              route: parsed.data.route,
              rationale: parsed.data.rationale,
            };
          }
        } catch {
          // fall through to default
        }
      }
    }
  }

  // Final fallback: derive a deterministic score from the extraction.
  const tags = extraction?.clueTags ?? [];
  const budgetApproved = tags.includes("budget_approved");
  const deadlineNear = tags.includes("deadline_near");
  const duplicate = tags.includes("duplicate") || tags.includes("expired");
  const worth = duplicate
    ? 15
    : budgetApproved && deadlineNear
      ? 85
      : budgetApproved
        ? 60
        : deadlineNear
          ? 45
          : 30;
  return {
    id: `score_${finding.id}`,
    findingId: finding.id,
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: worth,
    urgency: deadlineNear ? "high" : budgetApproved ? "medium" : "low",
    route: worth >= 80 ? "human_review" : worth >= 60 ? "qualify" : worth >= 35 ? "monitor" : "ignore",
    rationale: duplicate
      ? "Duplicate or expired; suppress."
      : budgetApproved && deadlineNear
        ? "Budget approved and deadline near; escalate for human review."
        : budgetApproved
          ? "Budget approved; qualify."
          : "Low-signal finding; monitor.",
  };
}

// --- Cross-check: ensure the live snapshot can also be scored from the
//     synthetic scoring rows we generated. Used by /api/pioneer/align.
export function snapshotScoringRows() {
  const snapshot = getRadarSnapshot();
  return snapshot.findings.map((f) => {
    const row = scores.find((s) => s.findingId === f.id);
    return {
      findingId: f.id,
      title: f.title,
      score: row?.worthOutreachScore ?? null,
    };
  });
}

// EntitySpan import re-export to keep callers decoupled.
export type { EntitySpan };
