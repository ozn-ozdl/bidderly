import { z } from "zod";

import type {
  Extraction,
  Finding,
  GeminiAnalysis,
  ModelScore,
  ProcurementClue,
  RouteDecision,
  Urgency,
} from "./radar-types";

const clueSchema = z.enum([
  "budget_approved",
  "supplier_call",
  "pre_announcement",
  "official_tender",
  "deadline_near",
  "login_required",
  "event_notice",
  "duplicate",
  "expired",
]);

const routeSchema = z.enum(["ignore", "monitor", "qualify", "human_review"]);
const urgencySchema = z.enum(["low", "medium", "high"]);

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

const glinerResponseSchema = z.object({
  confidence: z.coerce.number().min(0).max(1).default(0.75),
  entities: z
    .object({
      buyerIssuer: z.string().optional(),
      projectName: z.string().optional(),
      category: z.string().optional(),
      location: z.string().optional(),
      deadline: z.string().optional(),
      budgetValue: z.string().optional(),
      contactPersona: z.string().optional(),
    })
    .default({}),
  clueTags: z.array(clueSchema).default([]),
  spans: z
    .array(
      z.object({
        label: z.string(),
        text: z.string(),
        start: z.coerce.number(),
        end: z.coerce.number(),
      }),
    )
    .default([]),
});

const gemmaResponseSchema = z.object({
  worthOutreachScore: z.coerce.number().min(0).max(100),
  urgency: urgencySchema,
  route: routeSchema,
  rationale: z.string().min(1),
});

const geminiResponseSchema = z.object({
  summary: z.string().min(1),
  risks: z.array(z.string()).default([]),
  recommendedNextSteps: z.array(z.string()).default([]),
  blocker: z.string().optional(),
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

export async function extractWithGliner(finding: Finding): Promise<Extraction> {
  const endpoint = process.env.PIONEER_GLINER_ENDPOINT;
  const apiKey = process.env.PIONEER_GLINER_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("PIONEER_GLINER_ENDPOINT and PIONEER_GLINER_API_KEY are required.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rawAnnouncementText: finding.rawText,
      sourceType: finding.sourceType,
      sourceUrl: finding.url,
      detectedLanguage: finding.detectedLanguage,
      labels: [
        "buyerIssuer",
        "projectName",
        "category",
        "location",
        "deadline",
        "budgetValue",
        "contactPersona",
        "budget_approved",
        "supplier_call",
        "pre_announcement",
        "official_tender",
        "deadline_near",
        "login_required",
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Pioneer GLiNER failed: ${response.status} ${response.statusText}`);
  }

  const parsed = glinerResponseSchema.parse(await response.json());

  return {
    id: `ext_${finding.id}`,
    findingId: finding.id,
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: parsed.confidence,
    entities: parsed.entities,
    clueTags: parsed.clueTags as ProcurementClue[],
    spans: parsed.spans,
  };
}

export async function scoreWithGemma(
  finding: Finding,
  extraction: Extraction,
): Promise<ModelScore> {
  const endpoint = process.env.PIONEER_GEMMA4_ENDPOINT;
  const apiKey = process.env.PIONEER_GEMMA4_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("PIONEER_GEMMA4_ENDPOINT and PIONEER_GEMMA4_API_KEY are required.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      finding,
      extraction,
      requiredOutput: {
        worthOutreachScore: "0-100",
        urgency: ["low", "medium", "high"],
        route: ["ignore", "monitor", "qualify", "human_review"],
        rationale: "short explanation",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Pioneer Gemma 4 failed: ${response.status} ${response.statusText}`);
  }

  const parsed = gemmaResponseSchema.parse(await response.json());

  return {
    id: `score_${finding.id}`,
    findingId: finding.id,
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: parsed.worthOutreachScore,
    urgency: parsed.urgency as Urgency,
    route: parsed.route as RouteDecision,
    rationale: parsed.rationale,
  };
}

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

function stableId(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}
