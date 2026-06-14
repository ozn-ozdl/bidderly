// Alignment contract — single source of truth for the label vocabularies,
// span shape, scoring JSON schema, and prompt header that flow through
// every layer of the Bidderly cascade.
//
// Imported by:
//   - src/lib/scraper/*        (used to validate scraper output)
//   - src/lib/demo-data.ts     (mirror in the static fixtures)
//   - src/lib/pioneer/synthetic-builders.ts (row builders for Fastino)
//   - src/lib/pioneer/inference.ts          (request schema for /inference)
//   - src/components/radar/views/pioneer-view.tsx (UI display)
//
// Change a label or a field here, the entire stack updates.

import { z } from "zod";

import type {
  EntitySpan,
  ExtractedEntities,
  ProcurementClue,
} from "@/lib/radar-types";

// --- GLiNER2 NER label set -------------------------------------------------

export const ENTITY_LABELS = [
  "buyer_issuer",
  "project_name",
  "category",
  "location",
  "deadline",
  "budget_value",
  "contact_persona",
] as const;

export type EntityLabel = (typeof ENTITY_LABELS)[number];

export const entityLabelSchema = z.enum(ENTITY_LABELS);

// --- Procurement clue label set --------------------------------------------

export const CLUE_LABELS = [
  "budget_approved",
  "supplier_call",
  "pre_announcement",
  "official_tender",
  "deadline_near",
  "login_required",
  "event_notice",
  "duplicate",
  "expired",
] as const;

export type ClueLabel = (typeof CLUE_LABELS)[number];

export const clueLabelSchema = z.enum(CLUE_LABELS);

// --- Scoring label set (Gemma 4 decoder head) ------------------------------

export const SCORING_ROUTES = ["ignore", "monitor", "qualify", "human_review"] as const;
export const SCORING_URGENCIES = ["low", "medium", "high"] as const;

export const scoringResultSchema = z.object({
  worthOutreachScore: z.number().min(0).max(100),
  urgency: z.enum(SCORING_URGENCIES),
  route: z.enum(SCORING_ROUTES),
  rationale: z.string().min(1),
});

export type ScoringResult = z.infer<typeof scoringResultSchema>;

// --- Prompt header for the scoring decoder ---------------------------------
//
// Kept identical between synthetic-data generation and live inference so a
// fine-tuned Gemma 4 sees the same instruction at train and serve time.

export const SCORING_PROMPT_HEADER = [
  "You are a procurement sales agent scoring a tender for a B2B software",
  "vendor with DACH + EU public-sector experience. Given a raw tender",
  "announcement and a structured extraction of its entities, return strict",
  "JSON:",
  '{ "worthOutreachScore": 0-100, "urgency": "low"|"medium"|"high",',
  '  "route": "ignore"|"monitor"|"qualify"|"human_review", "rationale": string }',
  "",
  "Heuristics:",
  "- budget_approved + budget_value present  -> +25 score",
  "- deadline within 14 days                 -> urgency = high",
  "- login_required or duplicate/expired     -> route = ignore or monitor",
  "- event_notice without budget             -> route = monitor",
  "- weak_signal with no buyer/budget        -> score < 40, route = ignore",
].join("\n");

// --- Pioneer row shapes ----------------------------------------------------

export const pioneerNerRowSchema = z.object({
  text: z.string().min(1),
  entities: z
    .array(
      z.object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
        label: z.string().min(1),
        text: z.string().min(1),
      }),
    )
    .default([]),
});

export type PioneerNerRow = z.infer<typeof pioneerNerRowSchema>;

export const pioneerClueRowSchema = z.object({
  text: z.string().min(1),
  labels: z.array(clueLabelSchema).default([]),
});

export type PioneerClueRow = z.infer<typeof pioneerClueRowSchema>;

export type PioneerScoringRow = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

// --- Span validation -------------------------------------------------------

export function validateSpan(span: EntitySpan, text: string): boolean {
  if (span.start < 0 || span.end > text.length || span.start >= span.end) {
    return false;
  }
  return text.slice(span.start, span.end) === span.text;
}

// --- Display helpers -------------------------------------------------------

export function labelToHuman(label: string): string {
  return label.replaceAll("_", " ");
}

export function isEntityLabel(value: string): value is EntityLabel {
  return (ENTITY_LABELS as readonly string[]).includes(value);
}

export function isClueLabel(value: string): value is ClueLabel {
  return (CLUE_LABELS as readonly string[]).includes(value);
}

export const emptyExtraction: ExtractedEntities = Object.freeze({});
export const emptyClueTags: readonly ProcurementClue[] = Object.freeze([]) as readonly ProcurementClue[];
