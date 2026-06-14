// Provider client adapters.
//
// Three external surfaces are called from the cascade:
//
//   1. Tavily  — search / enrichment for raw tender URLs.
//   2. Pioneer — fine-tuned GLiNER2 extraction + clue tagging, and
//                Gemma 4 scoring. The actual API calls live in
//                src/lib/pioneer/inference.ts; this module is the
//                thin façade that maps Pioneer output to the typed
//                shapes the cascade consumes.
//   3. Gemini  — final reasoning step, called only when the cascade
//                gate is open.

import { z } from "zod";

import { inferExtractionAndClues, inferScoring } from "@/lib/pioneer";
import type {
  Extraction,
  Finding,
  GeminiAnalysis,
  ModelScore,
  ProcurementClue,
  RouteDecision,
  Urgency,
} from "@/lib/radar-types";

// --- Tavily ---------------------------------------------------------------

const tavilyResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().url().optional(),
  content: z.string().optional(),
  raw_content: z.string().optional().nullable(),
  published_date: z.string().optional().nullable(),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).default([]),
});

export async function searchTenderSignals() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is required for live search.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.TAVILY_PROJECT_ID
        ? { "X-Project-ID": process.env.TAVILY_PROJECT_ID }
        : {}),
    },
    body: JSON.stringify({
      query:
        "Germany EU public procurement software tender pre-announcement supplier call budget deadline",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: "markdown",
      include_images: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`);
  }

  const payload = tavilyResponseSchema.parse(await response.json());
  const now = new Date().toISOString();

  return payload.results.map((result, index): Finding => {
    const title = result.title ?? `Live procurement signal ${index + 1}`;
    const rawText = result.raw_content ?? result.content ?? title;

    return {
      id: `find_live_${stableId(result.url ?? title)}`,
      sourceId: "src_tavily_live",
      sourceName: "Tavily live search",
      sourceType: "tavily_search",
      title,
      url: result.url ?? "https://api.tavily.com/search",
      rawText,
      detectedLanguage: rawText.match(/[äöüß]/i) ? "de" : "en",
      publishedAt: result.published_date ?? now,
      stage: "raw",
    };
  });
}

// --- Pioneer (extraction + clues, multi-head) -----------------------------

export async function extractWithGliner(finding: Finding): Promise<Extraction> {
  const result = await inferExtractionAndClues({
    id: finding.id,
    rawText: finding.rawText,
    sourceType: finding.sourceType,
    url: finding.url,
    detectedLanguage: finding.detectedLanguage,
  });

  const entities: Record<string, string> = {};
  for (const entity of result.entities) {
    if (result.rawSpans.length === 0) continue;
    const cleaned = entity.label.toLowerCase();
    if (cleaned === "buyer_issuer" || cleaned === "project_name" || cleaned === "category" ||
        cleaned === "location" || cleaned === "deadline" || cleaned === "budget_value" ||
        cleaned === "contact_persona") {
      entities[cleaned] = entity.text;
    }
  }

  return {
    id: `ext_${finding.id}`,
    findingId: finding.id,
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: result.confidence,
    entities: {
      buyerIssuer: entities.buyer_issuer,
      projectName: entities.project_name,
      category: entities.category,
      location: entities.location,
      deadline: entities.deadline,
      budgetValue: entities.budget_value,
      contactPersona: entities.contact_persona,
    },
    clueTags: result.clueTags as ProcurementClue[],
    spans: result.rawSpans,
  };
}

export async function scoreWithGemma(
  finding: Finding,
  extraction: Extraction,
): Promise<ModelScore> {
  const score = await inferScoring(
    {
      id: finding.id,
      title: finding.title,
      sourceName: finding.sourceName,
      sourceType: finding.sourceType,
      detectedLanguage: finding.detectedLanguage,
      publishedAt: finding.publishedAt,
      rawText: finding.rawText,
    },
    extraction,
  );

  return {
    id: `score_${finding.id}`,
    findingId: finding.id,
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: score.worthOutreachScore,
    urgency: score.urgency as Urgency,
    route: score.route as RouteDecision,
    rationale: score.rationale,
  };
}

// --- Gemini ---------------------------------------------------------------

const geminiResponseSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.string()).default([]),
  recommendedNextSteps: z.array(z.string()).default([]),
  blocker: z.string().optional(),
});

export async function analyzeWithGemini(
  finding: Finding,
  extraction: Extraction,
  score: ModelScore,
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for deep reasoning.");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Analyze this procurement opportunity for a B2B sales team.",
                  "Return strict JSON with summary, risks, recommendedNextSteps, and optional blocker.",
                  JSON.stringify({ finding, extraction, score }),
                ].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              risks: { type: "array", items: { type: "string" } },
              recommendedNextSteps: { type: "array", items: { type: "string" } },
              blocker: { type: "string" },
            },
            required: ["summary", "risks", "recommendedNextSteps"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini analysis failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned no JSON text.");
  }

  const parsed = geminiResponseSchema.parse(JSON.parse(text));

  return {
    id: `gem_${finding.id}`,
    findingId: finding.id,
    model: "Gemini deep reasoning",
    summary: parsed.summary,
    risks: parsed.risks,
    recommendedNextSteps: parsed.recommendedNextSteps,
    blocker: parsed.blocker,
  };
}

// --- helpers --------------------------------------------------------------

function stableId(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
