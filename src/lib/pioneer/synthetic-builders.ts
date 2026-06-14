// Synthetic data builders.
//
// Converts the in-app SyntheticTrainingExample + the live extractions and
// scores into the three row shapes Fastino's /generate and /felix/datasets
// accept: NER rows, classification rows, and decoder rows. The same
// builders are used in three places:
//
//   1. /api/pioneer/synthesize — when the user triggers fresh generation
//   2. Dry-run path of /api/pioneer/synthesize — the rows feed the
//      in-memory dry-run store so the rest of the pipeline can train
//      and evaluate on realistic data without a live key
//   3. /api/pioneer/align — a /GET endpoint that previews the rows that
//      would be sent, so the jury can read them during the demo
//
// The NER row shape mirrors docs.pioneer.ai/guides/fine-tune-ner.md:
//   { "text": str, "entities": [{ "start": n, "end": n, "label": str, "text": str }] }
//
// The classification row shape mirrors docs.pioneer.ai/guides/fine-tune-classification.md:
//   { "text": str, "labels": [str, ...] }     (multi-label)
//
// The decoder row shape mirrors docs.pioneer.ai/guides/fine-tune-llm.md (SFT):
//   { "messages": [{ role, content }, ...] }

import { SCORING_PROMPT_HEADER, type ScoringResult, validateSpan } from "./schemas";
import type {
  EntitySpan,
  ExtractedEntities,
  Extraction,
  Finding,
  ModelScore,
  ProcurementClue,
  SyntheticTrainingExample,
} from "@/lib/radar-types";
import type {
  PioneerClueRow,
  PioneerNerRow,
  PioneerScoringRow,
} from "./schemas";

// --- NER rows --------------------------------------------------------------

export function buildNerRow(text: string, spans: EntitySpan[]): PioneerNerRow {
  const entities = spans.filter((span) => validateSpan(span, text));
  return { text, entities };
}

export function buildNerRowsFromExamples(
  examples: SyntheticTrainingExample[],
): PioneerNerRow[] {
  return examples.map((example) => buildNerRow(example.text, example.expectedEntities));
}

export function buildNerRowsFromExtractions(
  findings: Finding[],
  extractions: Extraction[],
): PioneerNerRow[] {
  const out: PioneerNerRow[] = [];
  for (const extraction of extractions) {
    const finding = findings.find((f) => f.id === extraction.findingId);
    if (!finding) continue;
    out.push(buildNerRow(finding.rawText, extraction.spans));
  }
  return out;
}

// --- Classification rows (clue labels) -------------------------------------

export function buildClueRow(text: string, labels: ProcurementClue[]): PioneerClueRow {
  return { text, labels: [...new Set(labels)] };
}

export function buildClueRowsFromExamples(
  examples: SyntheticTrainingExample[],
): PioneerClueRow[] {
  return examples.map((example) => buildClueRow(example.text, example.clueLabels));
}

export function buildClueRowsFromExtractions(
  findings: Finding[],
  extractions: Extraction[],
): PioneerClueRow[] {
  const out: PioneerClueRow[] = [];
  for (const extraction of extractions) {
    const finding = findings.find((f) => f.id === extraction.findingId);
    if (!finding) continue;
    out.push(buildClueRow(finding.rawText, extraction.clueTags));
  }
  return out;
}

// --- Decoder rows (Gemma 4 scoring) ---------------------------------------

export function buildScoringPrompt(
  finding: Finding,
  extraction: Extraction | undefined,
  entities: ExtractedEntities,
): string {
  const extractionBlock = extraction
    ? `Extraction (model: ${extraction.model}, confidence: ${extraction.confidence.toFixed(2)}):\n${JSON.stringify(extraction.entities, null, 2)}\nClue tags: ${extraction.clueTags.join(", ") || "none"}\nEntity spans: ${extraction.spans.length}`
    : `No extraction available. Hint entities: ${JSON.stringify(entities)}`;

  return [
    SCORING_PROMPT_HEADER,
    "",
    "Tender:",
    `Title: ${finding.title}`,
    `Source: ${finding.sourceName} (${finding.sourceType})`,
    `Language: ${finding.detectedLanguage}`,
    `Published: ${finding.publishedAt}`,
    "",
    "Raw announcement:",
    finding.rawText,
    "",
    extractionBlock,
    "",
    "Return strict JSON only.",
  ].join("\n");
}

export function buildScoringRow(
  finding: Finding,
  extraction: Extraction | undefined,
  score: ModelScore,
): PioneerScoringRow {
  const entities = extraction?.entities ?? {};
  const user = buildScoringPrompt(finding, extraction, entities);
  const assistant: ScoringResult = {
    worthOutreachScore: score.worthOutreachScore,
    urgency: score.urgency,
    route: score.route,
    rationale: score.rationale,
  };

  return {
    messages: [
      { role: "system", content: SCORING_PROMPT_HEADER },
      { role: "user", content: user },
      { role: "assistant", content: JSON.stringify(assistant) },
    ],
  };
}

export function buildScoringRows(
  findings: Finding[],
  extractions: Extraction[],
  scores: ModelScore[],
): PioneerScoringRow[] {
  const out: PioneerScoringRow[] = [];
  for (const score of scores) {
    const finding = findings.find((f) => f.id === score.findingId);
    if (!finding) continue;
    const extraction = extractions.find((e) => e.findingId === score.findingId);
    out.push(buildScoringRow(finding, extraction, score));
  }
  return out;
}
