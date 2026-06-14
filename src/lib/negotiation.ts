import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getFindingBundle } from "@/lib/cascade";
import { getLatestRadarSnapshot } from "@/lib/db";
import { getRadarSnapshot } from "@/lib/demo-data";
import type {
  ApprovalRequest,
  CounterpartyTradeoffOption,
  Extraction,
  Finding,
  GeminiAnalysis,
  Negotiation,
  NegotiationDetail,
  NegotiationIntent,
  NegotiationMessage,
  NegotiationSummary,
  Opportunity,
  TradeoffParameter,
  TradeoffParameterKey,
} from "@/lib/radar-types";

const store = new Map<string, NegotiationDetail>();
const byUser = new Map<string, Set<string>>();
const MODEL = process.env.NEGOTIATION_MODEL ?? "gemini-3.1-flash-lite";

export class NegotiationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const paramLibrary: Record<TradeoffParameterKey, Omit<TradeoffParameter, "key">> = {
  price_delta_pct: {
    label: "Price adjustment",
    kind: "percent",
    options: [-15, -12, -10, -8, -5, -3, 0].map((v) => ({
      value: String(v),
      label: v === 0 ? "Hold price" : `${v}%`,
    })),
    defaultValue: "-5",
  },
  warranty_years: {
    label: "Warranty",
    kind: "enum",
    options: [3, 5, 7, 10].map((v) => ({ value: String(v), label: `${v} yr` })),
    defaultValue: "5",
  },
  service_visits: {
    label: "Service visits / yr",
    kind: "count",
    options: [0, 1, 2, 3, 4, 6].map((v) => ({
      value: String(v),
      label: v === 0 ? "No visits" : `${v} visits`,
    })),
    defaultValue: "2",
  },
  delivery_weeks: {
    label: "Delivery lead time",
    kind: "enum",
    options: [4, 6, 8, 12, 16].map((v) => ({ value: String(v), label: `${v} weeks` })),
    defaultValue: "8",
  },
};

type RadarJoin = {
  finding: Finding;
  extraction?: Extraction;
  opportunity?: Opportunity;
  approval: ApprovalRequest;
  gemini?: GeminiAnalysis;
};

function id(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parameter(key: TradeoffParameterKey): TradeoffParameter {
  return { key, ...paramLibrary[key] };
}

async function snapshot() {
  return (await getLatestRadarSnapshot()) ?? getRadarSnapshot();
}

async function radarJoin(approvalId: string): Promise<RadarJoin> {
  const data = await snapshot();
  const approval = data.approvals.find((item) => item.id === approvalId);
  if (!approval) throw new NegotiationError(404, `approval ${approvalId} not found`);
  const bundle = getFindingBundle(data, approval.findingId);
  if (!bundle?.finding) throw new NegotiationError(404, `finding ${approval.findingId} not found`);
  return {
    finding: bundle.finding,
    extraction: bundle.extraction,
    opportunity: bundle.opportunity,
    approval,
    gemini: bundle.gemini,
  };
}

function remember(detail: NegotiationDetail) {
  store.set(detail.negotiation.id, detail);
  const set = byUser.get(detail.negotiation.userId) ?? new Set<string>();
  set.add(detail.negotiation.id);
  byUser.set(detail.negotiation.userId, set);
}

function parseValueBand(valueBand?: string) {
  if (!valueBand) return { openingPrice: 1_200_000, targetPrice: 900_000 };
  const range = valueBand.toLowerCase().match(/(\d+(?:\.\d+)?)\s*m\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*m/);
  const plus = valueBand.toLowerCase().match(/(\d+(?:\.\d+)?)\s*m\+/);
  if (range) {
    const low = Number(range[1]) * 1_000_000;
    const high = Number(range[2]) * 1_000_000;
    return {
      openingPrice: Math.round((low + high) / 2),
      targetPrice: Math.round(low + (high - low) / 3),
    };
  }
  if (plus) {
    const low = Number(plus[1]) * 1_000_000;
    return { openingPrice: Math.round(low * 1.125), targetPrice: low };
  }
  return { openingPrice: 1_200_000, targetPrice: 900_000 };
}

async function gemini<T>(instruction: string, schema: object, parser: (raw: unknown) => T) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: instruction }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema },
      }),
    },
  );
  if (!response.ok) throw new Error(`Gemini failed: ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no JSON text");
  return parser(JSON.parse(text));
}

async function openingOffer(finding: Finding, opportunity: Opportunity | undefined, price: number) {
  const buyer = opportunity?.buyer ?? finding.sourceName;
  const title = opportunity?.title ?? finding.title;
  if (!process.env.GEMINI_API_KEY) {
    return `Subject: Proposal - ${title}\n\nDear ${buyer},\n\nWe submit an opening offer of EUR ${price.toLocaleString("en-DE")} for the tender scope.\n\nBest regards,\nThe Bidderly Bid Team`;
  }
  const result = await gemini(
    [
      "Write a concise procurement opening-offer email for Bidderly.",
      `Buyer: ${buyer}`,
      `Tender: ${title}`,
      `Price: EUR ${price}`,
      `Tender excerpt: ${finding.rawText.slice(0, 500)}`,
      "Return JSON {\"text\": string}.",
    ].join("\n"),
    { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    z.object({ text: z.string().min(1) }).parse,
  );
  return result.text;
}

type CounterpartyPlan = {
  fallback: string;
  instruction: string;
};

function counterpartyPlan(intent: NegotiationIntent, buyer: string, price: number, roll: () => number): CounterpartyPlan {
  if (intent === "accept") {
    return {
      fallback: `Thank you - at EUR ${price.toLocaleString("en-DE")} we can move forward. Please send the formal paperwork.`,
      instruction: "Accept the current offer and ask for formal paperwork.",
    };
  }
  if (intent === "deny") {
    return {
      fallback: `We reviewed the offer, but EUR ${price.toLocaleString("en-DE")} remains outside our budget envelope.`,
      instruction: "Reject the current offer because it remains outside the budget envelope.",
    };
  }
  const levers = ["price", "warranty period", "service frequency", "delivery timeline"];
  const lever = levers[Math.floor(roll() * levers.length)];
  const reduction = 5 + Math.floor(roll() * 8);
  return {
    fallback: `Thanks for the proposal. At EUR ${price.toLocaleString("en-DE")} ${buyer} procurement needs movement on ${lever}. If you can improve the package by about ${reduction}%, we can take it to the steering committee.`,
    instruction: `Negotiate, asking for movement on ${lever} of about ${reduction}%.`,
  };
}

async function counterpartyReply(
  intent: NegotiationIntent,
  buyer: string,
  price: number,
  roll: () => number,
  tenderTitle: string,
) {
  const plan = counterpartyPlan(intent, buyer, price, roll);
  if (!process.env.GEMINI_API_KEY) return plan.fallback;
  const result = await gemini(
    [
      "Write as the public-sector buyer in a procurement negotiation.",
      "The deterministic outcome is fixed; do not change it.",
      `Outcome: ${intent}`,
      `Buyer: ${buyer}`,
      `Tender: ${tenderTitle}`,
      `Current offer: EUR ${price}`,
      `Required semantics: ${plan.instruction}`,
      "Do not use template phrases like 'Thanks for the proposal' or 'take it to the steering committee'.",
      "Keep the reply concise, specific, and realistic. Return JSON {\"text\": string}.",
    ].join("\n"),
    { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    z.object({ text: z.string().min(1) }).parse,
  );
  return result.text;
}

const optionSchema = z.object({
  options: z.array(z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    parameterKeys: z.array(z.enum(["price_delta_pct", "warranty_years", "service_visits", "delivery_weeks"])).min(1).max(4),
  })).min(3).max(5),
});

async function optionsFor(negotiationId: string, roundIndex: number, buyer: string, message: string) {
  let raw: Array<{ title: string; summary: string; parameterKeys: TradeoffParameterKey[] }>;
  if (process.env.GEMINI_API_KEY) {
    const result = await gemini(
      [
        "Generate 3 to 5 procurement counter-offer strategies.",
        "Allowed parameterKeys only: price_delta_pct, warranty_years, service_visits, delivery_weeks.",
        `Buyer: ${buyer}`,
        `Buyer message: ${message}`,
        "Return JSON {\"options\":[{\"title\":string,\"summary\":string,\"parameterKeys\":string[]}]}",
      ].join("\n"),
      {
        type: "object",
        properties: {
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                parameterKeys: {
                  type: "array",
                  items: { type: "string", enum: ["price_delta_pct", "warranty_years", "service_visits", "delivery_weeks"] },
                },
              },
              required: ["title", "summary", "parameterKeys"],
            },
          },
        },
        required: ["options"],
      },
      optionSchema.parse,
    );
    raw = result.options;
  } else {
    raw = [
      { title: "Aggressive price cut", summary: "Cut price and reduce service to recover margin.", parameterKeys: ["price_delta_pct", "service_visits"] },
      { title: "Balanced concession", summary: "Moderate price movement with a delivery adjustment.", parameterKeys: ["price_delta_pct", "delivery_weeks"] },
      { title: "Hold price, add value", summary: "Hold price while improving warranty and service.", parameterKeys: ["warranty_years", "service_visits"] },
    ];
  }
  return raw.map((item, index): CounterpartyTradeoffOption => ({
    id: `opt_${negotiationId}_${roundIndex}_${index}`,
    roundIndex,
    title: item.title,
    summary: item.summary,
    parameters: item.parameterKeys.map(parameter),
  }));
}

async function counterOffer(
  buyer: string,
  adjusted: Record<string, string>,
  parameters: TradeoffParameter[],
  price: number,
) {
  const terms = parameters.map((param) => {
    const value = adjusted[param.key] ?? param.defaultValue;
    return `${param.label}: ${param.options.find((option) => option.value === value)?.label ?? value}`;
  });
  if (!process.env.GEMINI_API_KEY) {
    return `Subject: Revised proposal - ${buyer}\n\nThanks for the feedback. Revised terms:\n\n${terms.join("\n")}\n\nThis lands at EUR ${price.toLocaleString("en-DE")}.\n\nBest regards,\nThe Bidderly Bid Team`;
  }
  const result = await gemini(
    ["Write a concise procurement counter-offer email for Bidderly.", JSON.stringify({ buyer, price, terms }), "Return JSON {\"text\": string}."].join("\n"),
    { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    z.object({ text: z.string().min(1) }).parse,
  );
  return result.text;
}

function evaluate(price: number, floor: number, round: number): NegotiationIntent {
  if (price <= floor * 1.05) return "accept";
  if (round === 0) return "negotiate";
  if (round >= 4) return "deny";
  return "negotiate";
}

function applyPrice(base: number, adjusted: Record<string, string>, parameters: TradeoffParameter[]) {
  const param = parameters.find((item) => item.key === "price_delta_pct");
  if (!param) return base;
  const pct = Number(adjusted.price_delta_pct ?? param.defaultValue);
  return Number.isFinite(pct) ? Math.max(0, Math.round((base * (1 + pct / 100)) / 100) * 100) : base;
}

export async function startNegotiation(approvalId: string, userId: string): Promise<NegotiationDetail> {
  for (const id of byUser.get(userId) ?? []) {
    const detail = store.get(id);
    if (detail?.negotiation.approvalId === approvalId) return detail;
  }
  const join = await radarJoin(approvalId);
  const { openingPrice, targetPrice } = parseValueBand(join.opportunity?.valueBand);
  const seed = hash(join.finding.id);
  const roll = rng(seed);
  const floor = Math.round(openingPrice * (0.76 + roll() * 0.08));
  const startedAt = new Date().toISOString();
  const negotiation: Negotiation = {
    id: id("neg"),
    findingId: join.finding.id,
    opportunityId: join.approval.opportunityId,
    approvalId,
    userId,
    channel: "simulated",
    status: "opening",
    seed,
    openingPrice,
    currency: "EUR",
    targetPrice,
    counterpartyFloor: floor,
    rounds: 0,
    startedAt,
    lastMessageAt: startedAt,
  };
  const buyer = join.opportunity?.buyer ?? join.finding.sourceName;
  const agent: NegotiationMessage = {
    id: id("msg"),
    negotiationId: negotiation.id,
    roundIndex: 0,
    party: "agent",
    channel: "simulated",
    at: startedAt,
    price: openingPrice,
    currency: "EUR",
    text: await openingOffer(join.finding, join.opportunity, openingPrice),
  };
  const intent = evaluate(openingPrice, floor, 0);
  const counter: NegotiationMessage = {
    id: id("msg"),
    negotiationId: negotiation.id,
    roundIndex: 0,
    party: "counterparty",
    channel: "simulated",
    at: new Date().toISOString(),
    text: await counterpartyReply(intent, buyer, openingPrice, roll, join.opportunity?.title ?? join.finding.title),
    parsedIntent: intent,
  };
  const pendingOptions = intent === "negotiate"
    ? await optionsFor(negotiation.id, 0, buyer, counter.text)
    : [];
  const finalNegotiation: Negotiation = {
    ...negotiation,
    status: intent === "negotiate" ? "awaiting_user" : intent === "accept" ? "accepted" : "denied",
    rounds: 1,
    lastMessageAt: counter.at,
    endedAt: intent === "negotiate" ? undefined : counter.at,
    outcome: intent === "accept" ? "deal" : intent === "deny" ? "no_deal" : undefined,
    agreedPrice: intent === "accept" ? openingPrice : undefined,
  };
  const detail: NegotiationDetail = {
    negotiation: finalNegotiation,
    messages: [agent, counter],
    pendingOptions,
    finding: join.finding,
    extraction: join.extraction,
    opportunity: join.opportunity,
    approval: join.approval,
    gemini: join.gemini,
  };
  remember(detail);
  return detail;
}

export async function respondToCounterparty(
  negotiationId: string,
  optionId: string,
  adjustedParameters: Record<string, string>,
  userId: string,
): Promise<NegotiationDetail> {
  const detail = store.get(negotiationId);
  if (!detail) throw new NegotiationError(404, `negotiation ${negotiationId} not found`);
  if (detail.negotiation.userId !== userId) throw new NegotiationError(403, "negotiation belongs to a different user");
  if (detail.negotiation.status !== "awaiting_user") throw new NegotiationError(409, `negotiation is in status ${detail.negotiation.status}`);
  const option = detail.pendingOptions.find((item) => item.id === optionId);
  if (!option) throw new NegotiationError(404, `option ${optionId} not found`);
  const buyer = detail.opportunity?.buyer ?? detail.finding.sourceName;
  const lastPrice = [...detail.messages].reverse().find((item) => item.party === "agent" && item.price)?.price ?? detail.negotiation.openingPrice;
  const price = applyPrice(lastPrice, adjustedParameters, option.parameters);
  const round = detail.negotiation.rounds;
  const agent: NegotiationMessage = {
    id: id("msg"),
    negotiationId,
    roundIndex: round,
    party: "agent",
    channel: "simulated",
    at: new Date().toISOString(),
    price,
    currency: "EUR",
    text: await counterOffer(buyer, adjustedParameters, option.parameters, price),
  };
  const intent = evaluate(price, detail.negotiation.counterpartyFloor, round);
  const counter: NegotiationMessage = {
    id: id("msg"),
    negotiationId,
    roundIndex: round,
    party: "counterparty",
    channel: "simulated",
    at: new Date().toISOString(),
    text: await counterpartyReply(
      intent,
      buyer,
      price,
      rng(detail.negotiation.seed + round),
      detail.opportunity?.title ?? detail.finding.title,
    ),
    parsedIntent: intent,
  };
  const pendingOptions = intent === "negotiate"
    ? await optionsFor(negotiationId, round, buyer, counter.text)
    : [];
  const next: NegotiationDetail = {
    ...detail,
    negotiation: {
      ...detail.negotiation,
      status: intent === "negotiate" ? "awaiting_user" : intent === "accept" ? "accepted" : "denied",
      rounds: detail.negotiation.rounds + 1,
      lastMessageAt: counter.at,
      endedAt: intent === "negotiate" ? undefined : counter.at,
      outcome: intent === "accept" ? "deal" : intent === "deny" ? "no_deal" : undefined,
      agreedPrice: intent === "accept" ? price : undefined,
    },
    messages: [...detail.messages, agent, counter],
    pendingOptions,
  };
  remember(next);
  return next;
}

async function seed(userId: string) {
  for (const approvalId of ["appr_munich_it", "appr_eu_digital_services"]) {
    await startNegotiation(approvalId, userId);
  }
}

export async function listNegotiations(userId: string): Promise<NegotiationSummary[]> {
  if (!byUser.get(userId)?.size) await seed(userId);
  return Array.from(byUser.get(userId) ?? []).flatMap((id) => {
    const detail = store.get(id);
    if (!detail) return [];
    return [{
      id: detail.negotiation.id,
      findingId: detail.negotiation.findingId,
      approvalId: detail.negotiation.approvalId,
      opportunityId: detail.negotiation.opportunityId,
      status: detail.negotiation.status,
      openingPrice: detail.negotiation.openingPrice,
      currency: detail.negotiation.currency,
      targetPrice: detail.negotiation.targetPrice,
      rounds: detail.negotiation.rounds,
      startedAt: detail.negotiation.startedAt,
      lastMessageAt: detail.negotiation.lastMessageAt,
      endedAt: detail.negotiation.endedAt,
      outcome: detail.negotiation.outcome,
      agreedPrice: detail.negotiation.agreedPrice,
      title: detail.opportunity?.title ?? detail.finding.title,
      buyer: detail.opportunity?.buyer ?? detail.finding.sourceName,
    }];
  });
}

export async function getNegotiationDetail(id: string, userId: string): Promise<NegotiationDetail> {
  const detail = store.get(id);
  if (!detail) throw new NegotiationError(404, `negotiation ${id} not found`);
  if (detail.negotiation.userId !== userId) throw new NegotiationError(403, "negotiation belongs to a different user");
  return detail;
}

export async function resetNegotiations(userId: string): Promise<{ cleared: number }> {
  const ids = byUser.get(userId) ?? new Set<string>();
  const cleared = ids.size;
  for (const id of ids) store.delete(id);
  byUser.delete(userId);
  await seed(userId);
  return { cleared };
}
