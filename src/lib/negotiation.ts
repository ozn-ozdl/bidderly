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
  NegotiationDashboard,
  NegotiationDetail,
  NegotiationIntent,
  NegotiationMessage,
  NegotiationOfferPoint,
  NegotiationSummary,
  Opportunity,
  ParsedNegotiationOffer,
  NegotiationTermField,
  TermMovement,
  TradeoffParameter,
  TradeoffParameterKey,
} from "@/lib/radar-types";

const store = new Map<string, NegotiationDetail>();
const byUser = new Map<string, Set<string>>();
const byApproval = new Map<string, string>();
const inFlightStart = new Map<string, Promise<NegotiationDetail>>();
const MODEL = process.env.NEGOTIATION_MODEL ?? "gemini-3.1-flash-lite";

function approvalKey(userId: string, approvalId: string) {
  return `${userId}:${approvalId}`;
}

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

function defaultAgentTerms(): Partial<Record<TradeoffParameterKey, string>> {
  return {
    warranty_years: paramLibrary.warranty_years.defaultValue,
    service_visits: paramLibrary.service_visits.defaultValue,
    delivery_weeks: paramLibrary.delivery_weeks.defaultValue,
  };
}

function termDisplay(key: TradeoffParameterKey, value: string): string {
  const param = paramLibrary[key];
  return param.options.find((option) => option.value === value)?.label ?? value;
}

function parseTermsFromText(text: string): Partial<Record<TradeoffParameterKey, string>> {
  const terms: Partial<Record<TradeoffParameterKey, string>> = {};
  const warranty = text.match(/(\d+)\s*(?:yr|year)/i);
  if (warranty) terms.warranty_years = warranty[1];
  const visits = text.match(/(\d+)\s*visits?/i);
  if (visits) terms.service_visits = visits[1];
  const weeks = text.match(/(\d+)\s*weeks?/i);
  if (weeks) terms.delivery_weeks = weeks[1];
  return terms;
}

function inferBuyerTerms(
  agentTerms: Partial<Record<TradeoffParameterKey, string>>,
  levers: TradeoffParameterKey[],
  roll: () => number,
): Partial<Record<TradeoffParameterKey, string>> {
  const terms: Partial<Record<TradeoffParameterKey, string>> = {};
  for (const lever of levers) {
    if (lever === "price_delta_pct") continue;
    const agentValue = Number(agentTerms[lever] ?? paramLibrary[lever].defaultValue);
    if (lever === "warranty_years") {
      terms[lever] = String(Math.min(10, agentValue + (roll() > 0.5 ? 2 : 0)));
    } else if (lever === "service_visits") {
      terms[lever] = String(Math.min(6, agentValue + (roll() > 0.4 ? 1 : 0)));
    } else if (lever === "delivery_weeks") {
      terms[lever] = String(Math.max(4, agentValue - (roll() > 0.5 ? 2 : 0)));
    }
  }
  return terms;
}

function buildParsedOffer(
  party: "agent" | "counterparty",
  price: number | undefined,
  intent: NegotiationIntent,
  levers: TradeoffParameterKey[],
  terms: Partial<Record<TradeoffParameterKey, string>>,
  summary: string,
): ParsedNegotiationOffer {
  return {
    referencedPrice: price,
    currency: "EUR",
    intent,
    levers,
    terms,
    summary,
  };
}

function numericTermValue(key: TradeoffParameterKey | "price", value?: string, price?: number): number | undefined {
  if (key === "price") return price;
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function computeMovement(
  key: TradeoffParameterKey | "price",
  agentValue?: string,
  counterpartyValue?: string,
  agentPrice?: number,
  counterpartyPrice?: number,
): TermMovement {
  const agentNum = numericTermValue(key, agentValue, agentPrice);
  const counterNum = numericTermValue(key, counterpartyValue, counterpartyPrice);
  if (agentNum == null && counterNum != null) return "buyer_proposed";
  if (agentNum != null && counterNum == null) return "agent_proposed";
  if (agentNum == null && counterNum == null) return "aligned";
  if (agentNum === counterNum) return "aligned";

  if (key === "price" || key === "delivery_weeks") {
    if (counterNum! < agentNum!) return "buyer_pressing";
    if (counterNum! > agentNum!) return "agent_conceding";
    return "diverging";
  }
  // warranty / service — higher is buyer-favorable
  if (counterNum! > agentNum!) return "buyer_pressing";
  if (counterNum! < agentNum!) return "agent_conceding";
  return "diverging";
}

function buildTermFields(
  agentParsed?: ParsedNegotiationOffer,
  counterpartyParsed?: ParsedNegotiationOffer,
  agentPrice?: number,
  counterpartyPrice?: number,
): NegotiationTermField[] {
  const activeKeys = new Set<TradeoffParameterKey | "price">();
  if (agentPrice != null || counterpartyPrice != null) activeKeys.add("price");
  for (const key of [
    ...Object.keys(agentParsed?.terms ?? {}),
    ...Object.keys(counterpartyParsed?.terms ?? {}),
    ...(agentParsed?.levers ?? []),
    ...(counterpartyParsed?.levers ?? []),
  ] as TradeoffParameterKey[]) {
    if (key !== "price_delta_pct") activeKeys.add(key);
  }

  return Array.from(activeKeys).map((key) => {
    const label = key === "price" ? "Offer price" : paramLibrary[key].label;
    const agentValue = key === "price" ? undefined : agentParsed?.terms?.[key];
    const counterpartyValue = key === "price" ? undefined : counterpartyParsed?.terms?.[key];
    const agentDisplay = key === "price"
      ? (agentPrice != null ? `EUR ${agentPrice.toLocaleString("en-DE")}` : undefined)
      : (agentValue ? termDisplay(key, agentValue) : undefined);
    const counterpartyDisplay = key === "price"
      ? (counterpartyPrice != null ? `EUR ${counterpartyPrice.toLocaleString("en-DE")}` : undefined)
      : (counterpartyValue ? termDisplay(key, counterpartyValue) : undefined);
    return {
      key,
      label,
      agentValue,
      counterpartyValue,
      agentDisplay,
      counterpartyDisplay,
      movement: computeMovement(key, agentValue, counterpartyValue, agentPrice, counterpartyPrice),
    };
  });
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

function remember(detail: NegotiationDetail): NegotiationDetail {
  const enriched = enrichDetail(detail);
  store.set(enriched.negotiation.id, enriched);
  const set = byUser.get(enriched.negotiation.userId) ?? new Set<string>();
  set.add(enriched.negotiation.id);
  byUser.set(enriched.negotiation.userId, set);
  byApproval.set(
    approvalKey(enriched.negotiation.userId, enriched.negotiation.approvalId),
    enriched.negotiation.id,
  );
  return enriched;
}

function impliedCounterpartyAsk(
  agentPrice: number,
  negotiation: Negotiation,
  roundIndex: number,
  roll: () => number,
): number {
  const reduction = 0.06 + roll() * 0.14 + roundIndex * 0.02;
  const ask = Math.round((agentPrice * (1 - reduction)) / 100) * 100;
  return Math.max(negotiation.counterpartyFloor, ask);
}

function parsePriceFromText(text: string): number | undefined {
  const match = text.match(/(?:EUR|€)\s*([\d][\d.,]*)/i);
  if (!match) return undefined;
  const raw = match[1].replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function detectLevers(text: string): TradeoffParameterKey[] {
  const levers: TradeoffParameterKey[] = [];
  if (/price|cost|budget|eur|€/i.test(text)) levers.push("price_delta_pct");
  if (/warrant|guarantee/i.test(text)) levers.push("warranty_years");
  if (/service|maintenance|visit/i.test(text)) levers.push("service_visits");
  if (/deliver|timeline|lead time|weeks/i.test(text)) levers.push("delivery_weeks");
  return levers.length ? levers : ["price_delta_pct"];
}

function distinctCounterpartyPrice(
  agentPrice: number,
  impliedAsk: number,
  intent: NegotiationIntent,
  textPrice?: number,
): number | undefined {
  if (intent === "deny") return textPrice ?? impliedAsk;
  if (intent === "accept") return agentPrice;
  const candidate = textPrice ?? impliedAsk;
  if (candidate >= agentPrice) {
    return Math.max(Math.round(agentPrice * 0.88 / 100) * 100, impliedAsk);
  }
  return candidate;
}

function fallbackParseCounterparty(
  text: string,
  intent: NegotiationIntent,
  agentPrice: number,
  impliedAsk: number,
  agentTerms: Partial<Record<TradeoffParameterKey, string>>,
  roll: () => number,
): ParsedNegotiationOffer {
  const textPrice = parsePriceFromText(text);
  const referencedPrice = distinctCounterpartyPrice(agentPrice, impliedAsk, intent, textPrice);
  const levers = detectLevers(text);
  const textTerms = parseTermsFromText(text);
  let inferredTerms = inferBuyerTerms(agentTerms, levers, roll);
  if (intent === "negotiate" && Object.keys(inferredTerms).length === 0) {
    inferredTerms = inferBuyerTerms(agentTerms, Object.keys(agentTerms) as TradeoffParameterKey[], roll);
  }
  const terms = { ...inferredTerms, ...textTerms };
  const summary = intent === "accept"
    ? "Buyer accepted the current offer."
    : intent === "deny"
      ? "Buyer rejected the offer as outside budget."
      : `Buyer requests movement on ${levers.map((key) => paramLibrary[key].label.toLowerCase()).join(" and ")}.`;
  return buildParsedOffer("counterparty", referencedPrice, intent, levers, terms, summary);
}

const parseOfferSchema = z.object({
  referencedPrice: z.number().optional(),
  intent: z.enum(["accept", "deny", "negotiate"]),
  levers: z.array(z.enum(["price_delta_pct", "warranty_years", "service_visits", "delivery_weeks"])).default([]),
  terms: z.record(z.string(), z.string()).optional(),
  summary: z.string().min(1),
});

async function parseCounterpartyMessage(
  text: string,
  buyer: string,
  agentPrice: number,
  intent: NegotiationIntent,
  impliedAsk: number,
  agentTerms: Partial<Record<TradeoffParameterKey, string>>,
  roll: () => number,
): Promise<ParsedNegotiationOffer> {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackParseCounterparty(text, intent, agentPrice, impliedAsk, agentTerms, roll);
  }
  try {
    const result = await gemini(
      [
        "Extract structured procurement negotiation data from the buyer's message.",
        "The agent (bidder) offer price must stay separate from the buyer's referenced or target price.",
        "Extract all discussed terms: warranty_years, service_visits, delivery_weeks as string values.",
        `Buyer: ${buyer}`,
        `Agent offer under discussion: EUR ${agentPrice}`,
        `Agent terms: ${JSON.stringify(agentTerms)}`,
        `Deterministic intent: ${intent}`,
        `Buyer message: ${text}`,
        "Return JSON with referencedPrice, intent, levers, terms (map of lever keys to values), summary.",
      ].join("\n"),
      {
        type: "object",
        properties: {
          referencedPrice: { type: "number" },
          intent: { type: "string", enum: ["accept", "deny", "negotiate"] },
          levers: {
            type: "array",
            items: { type: "string", enum: ["price_delta_pct", "warranty_years", "service_visits", "delivery_weeks"] },
          },
          terms: { type: "object", additionalProperties: { type: "string" } },
          summary: { type: "string" },
        },
        required: ["intent", "summary"],
      },
      parseOfferSchema.parse,
    );
    const levers = result.levers.length ? result.levers : detectLevers(text);
    const referencedPrice = distinctCounterpartyPrice(
      agentPrice,
      impliedAsk,
      result.intent,
      result.referencedPrice ?? parsePriceFromText(text),
    );
    const inferredTerms = inferBuyerTerms(agentTerms, levers, roll);
    const terms = {
      ...inferredTerms,
      ...((result.terms ?? {}) as Partial<Record<TradeoffParameterKey, string>>),
      ...parseTermsFromText(text),
    };
    return buildParsedOffer("counterparty", referencedPrice, result.intent, levers, terms, result.summary);
  } catch {
    return fallbackParseCounterparty(text, intent, agentPrice, impliedAsk, agentTerms, roll);
  }
}

function parseAgentMessage(
  text: string,
  price: number,
  terms: Partial<Record<TradeoffParameterKey, string>>,
): ParsedNegotiationOffer {
  const parsedTerms = { ...terms, ...parseTermsFromText(text) };
  const levers: TradeoffParameterKey[] = (Object.keys(parsedTerms) as TradeoffParameterKey[]).length
    ? (Object.keys(parsedTerms) as TradeoffParameterKey[])
    : ["price_delta_pct", "warranty_years", "service_visits", "delivery_weeks"];
  return buildParsedOffer(
    "agent",
    price,
    "negotiate",
    levers,
    parsedTerms,
    "Agent submitted a revised proposal.",
  );
}

function counterpartyPriceFromMessage(
  message: NegotiationMessage,
  lastAgentPrice: number | undefined,
  negotiation: Negotiation,
): number | undefined {
  if (message.parsedOffer?.referencedPrice != null) return message.parsedOffer.referencedPrice;
  if (message.parsedIntent === "accept" && lastAgentPrice != null) return lastAgentPrice;
  if (lastAgentPrice == null) return undefined;
  return impliedCounterpartyAsk(
    lastAgentPrice,
    negotiation,
    message.roundIndex,
    rng(negotiation.seed + message.roundIndex),
  );
}

function buildDashboard(messages: NegotiationMessage[], negotiation: Negotiation): NegotiationDashboard {
  const rounds = new Map<number, NegotiationOfferPoint>();
  let lastAgent: number | undefined;
  let lastCounterparty: number | undefined;
  let latestParsed: ParsedNegotiationOffer | undefined;
  let latestAgentParsed: ParsedNegotiationOffer | undefined;
  let lastAgentTerms: Partial<Record<TradeoffParameterKey, string>> = defaultAgentTerms();
  let lastCounterpartyTerms: Partial<Record<TradeoffParameterKey, string>> = {};

  for (const message of messages) {
    const point = rounds.get(message.roundIndex) ?? {
      roundIndex: message.roundIndex,
      at: message.at,
    };
    if (message.party === "agent") {
      if (message.price != null) {
        point.agentPrice = message.price;
        lastAgent = message.price;
      }
      if (message.parsedOffer?.terms) {
        point.agentTerms = message.parsedOffer.terms;
        lastAgentTerms = message.parsedOffer.terms;
      }
      if (message.parsedOffer) latestAgentParsed = message.parsedOffer;
    }
    if (message.party === "counterparty") {
      const counterpartyPrice = counterpartyPriceFromMessage(message, lastAgent, negotiation);
      if (counterpartyPrice != null) {
        point.counterpartyPrice = counterpartyPrice;
        lastCounterparty = counterpartyPrice;
      }
      if (message.parsedOffer) {
        latestParsed = message.parsedOffer;
        if (message.parsedOffer.terms) {
          point.counterpartyTerms = message.parsedOffer.terms;
          lastCounterpartyTerms = message.parsedOffer.terms;
        }
      }
    }
    point.at = message.at;
    rounds.set(message.roundIndex, point);
  }

  const offerTimeline = Array.from(rounds.values()).sort((a, b) => a.roundIndex - b.roundIndex);
  const gapPct = lastAgent != null && lastCounterparty != null && lastAgent > 0
    ? Math.round(((lastAgent - lastCounterparty) / lastAgent) * 100)
    : undefined;

  const activeLevers = Array.from(new Set<TradeoffParameterKey>([
    ...(latestAgentParsed?.levers ?? []),
    ...(latestParsed?.levers ?? []),
    ...Object.keys(lastAgentTerms) as TradeoffParameterKey[],
    ...Object.keys(lastCounterpartyTerms) as TradeoffParameterKey[],
  ])).filter((key) => key !== "price_delta_pct");

  const termFields = buildTermFields(
    latestAgentParsed,
    latestParsed,
    lastAgent,
    lastCounterparty,
  );

  return {
    offerTimeline,
    currentAgentOffer: lastAgent,
    currentCounterpartyOffer: lastCounterparty,
    latestAgentParsed,
    latestParsed,
    gapPct,
    termFields,
    activeLevers,
  };
}

function enrichDetail(detail: NegotiationDetail): NegotiationDetail {
  return {
    ...detail,
    dashboard: buildDashboard(detail.messages, detail.negotiation),
  };
}

async function attachCounterpartyMessage(
  negotiation: Negotiation,
  roundIndex: number,
  agentPrice: number,
  intent: NegotiationIntent,
  buyer: string,
  tenderTitle: string,
  roll: () => number,
  agentTerms: Partial<Record<TradeoffParameterKey, string>>,
): Promise<NegotiationMessage> {
  const text = await counterpartyReply(intent, buyer, agentPrice, roll, tenderTitle);
  const impliedAsk = impliedCounterpartyAsk(agentPrice, negotiation, roundIndex, roll);
  const parsedOffer = await parseCounterpartyMessage(text, buyer, agentPrice, intent, impliedAsk, agentTerms, roll);
  return {
    id: id("msg"),
    negotiationId: negotiation.id,
    roundIndex,
    party: "counterparty",
    channel: "simulated",
    at: new Date().toISOString(),
    text,
    parsedIntent: intent,
    parsedOffer,
  };
}

function emptyDashboard(): NegotiationDashboard {
  return { offerTimeline: [], termFields: [], activeLevers: [] };
}

function latestAgentTerms(messages: NegotiationMessage[]): Partial<Record<TradeoffParameterKey, string>> {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const terms = messages[i].parsedOffer?.terms;
    if (messages[i].party === "agent" && terms) return terms;
  }
  return defaultAgentTerms();
}

function termsFromAdjusted(
  parameters: TradeoffParameter[],
  adjusted: Record<string, string>,
): Partial<Record<TradeoffParameterKey, string>> {
  return Object.fromEntries(
    parameters
      .filter((param) => param.key !== "price_delta_pct")
      .map((param) => [param.key, adjusted[param.key] ?? param.defaultValue]),
  ) as Partial<Record<TradeoffParameterKey, string>>;
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

async function optionsFor(
  negotiationId: string,
  roundIndex: number,
  buyer: string,
  message: string,
  parsed: ParsedNegotiationOffer,
  agentPrice: number,
  negotiation: Negotiation,
) {
  const context = JSON.stringify({
    agentPrice,
    counterpartyPrice: parsed.referencedPrice,
    targetPrice: negotiation.targetPrice,
    openingPrice: negotiation.openingPrice,
    levers: parsed.levers,
    terms: parsed.terms,
    summary: parsed.summary,
  });
  let raw: Array<{ title: string; summary: string; parameterKeys: TradeoffParameterKey[] }>;
  if (process.env.GEMINI_API_KEY) {
    const result = await gemini(
      [
        "Generate 3 to 5 procurement counter-offer strategies for the bidder (agent).",
        "Each option must respond to the buyer's parsed position and use only relevant levers.",
        "Allowed parameterKeys only: price_delta_pct, warranty_years, service_visits, delivery_weeks.",
        `Buyer: ${buyer}`,
        `Buyer message: ${message}`,
        `Parsed buyer position: ${context}`,
        "Price options must move toward but not below the buyer's referenced price when cutting price.",
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
    const levers = parsed.levers.length ? parsed.levers : ["price_delta_pct" as TradeoffParameterKey];
    const secondary = levers.find((key) => key !== "price_delta_pct") ?? "service_visits";
    raw = [
      {
        title: "Meet buyer on price",
        summary: `Cut price toward EUR ${parsed.referencedPrice?.toLocaleString("en-DE") ?? "buyer target"} while trimming ${paramLibrary[secondary].label.toLowerCase()}.`,
        parameterKeys: ["price_delta_pct", secondary],
      },
      {
        title: "Balanced concession",
        summary: "Moderate price movement with a delivery adjustment.",
        parameterKeys: ["price_delta_pct", "delivery_weeks"],
      },
      {
        title: "Hold price, add value",
        summary: "Hold price while improving warranty and service to match buyer levers.",
        parameterKeys: levers.includes("warranty_years") ? ["warranty_years", "service_visits"] : ["warranty_years", "service_visits"],
      },
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

async function agentIntentMessage(
  intent: "accept" | "deny",
  buyer: string,
  price: number,
  tenderTitle: string,
) {
  if (!process.env.GEMINI_API_KEY) {
    if (intent === "accept") {
      return `Subject: Acceptance - ${tenderTitle}\n\nDear ${buyer},\n\nWe accept your position and are ready to proceed at EUR ${price.toLocaleString("en-DE")}. Please send the formal paperwork.\n\nBest regards,\nThe Bidderly Bid Team`;
    }
    return `Subject: Withdrawal - ${tenderTitle}\n\nDear ${buyer},\n\nAfter review we cannot meet the current requirements and must withdraw from this negotiation.\n\nBest regards,\nThe Bidderly Bid Team`;
  }
  const instruction = intent === "accept"
    ? "Accept the buyer's latest position and confirm readiness to proceed at the current offer price."
    : "Politely withdraw from the negotiation because the current requirements cannot be met.";
  const result = await gemini(
    [
      "Write a concise procurement email for Bidderly as the bidder.",
      `Outcome: ${intent}`,
      `Buyer: ${buyer}`,
      `Tender: ${tenderTitle}`,
      `Current offer: EUR ${price}`,
      `Required semantics: ${instruction}`,
      "Return JSON {\"text\": string}.",
    ].join("\n"),
    { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    z.object({ text: z.string().min(1) }).parse,
  );
  return result.text;
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

function existingNegotiationForApproval(approvalId: string, userId: string): NegotiationDetail | undefined {
  const keyed = byApproval.get(approvalKey(userId, approvalId));
  if (keyed) {
    const detail = store.get(keyed);
    if (detail?.negotiation.approvalId === approvalId) return detail;
  }
  for (const id of byUser.get(userId) ?? []) {
    const detail = store.get(id);
    if (detail?.negotiation.approvalId === approvalId) return detail;
  }
  return undefined;
}

export async function startNegotiation(approvalId: string, userId: string): Promise<NegotiationDetail> {
  const key = approvalKey(userId, approvalId);
  const existing = existingNegotiationForApproval(approvalId, userId);
  if (existing) return enrichDetail(existing);

  const inFlight = inFlightStart.get(key);
  if (inFlight) return inFlight;

  const promise = createNegotiation(approvalId, userId).finally(() => {
    inFlightStart.delete(key);
  });
  inFlightStart.set(key, promise);
  return promise;
}

async function createNegotiation(approvalId: string, userId: string): Promise<NegotiationDetail> {
  const existing = existingNegotiationForApproval(approvalId, userId);
  if (existing) return enrichDetail(existing);

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
  const openingTerms = defaultAgentTerms();
  const openingText = await openingOffer(join.finding, join.opportunity, openingPrice);
  const agent: NegotiationMessage = {
    id: id("msg"),
    negotiationId: negotiation.id,
    roundIndex: 0,
    party: "agent",
    channel: "simulated",
    at: startedAt,
    price: openingPrice,
    currency: "EUR",
    text: openingText,
    parsedOffer: buildParsedOffer(
      "agent",
      openingPrice,
      "negotiate",
      Object.keys(openingTerms) as TradeoffParameterKey[],
      openingTerms,
      "Opening offer submitted.",
    ),
  };
  const intent = evaluate(openingPrice, floor, 0);
  const counter = await attachCounterpartyMessage(
    negotiation,
    0,
    openingPrice,
    intent,
    buyer,
    join.opportunity?.title ?? join.finding.title,
    roll,
    openingTerms,
  );
  const pendingOptions = intent === "negotiate"
    ? await optionsFor(
      negotiation.id,
      0,
      buyer,
      counter.text,
      counter.parsedOffer!,
      openingPrice,
      negotiation,
    )
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
    dashboard: emptyDashboard(),
    finding: join.finding,
    extraction: join.extraction,
    opportunity: join.opportunity,
    approval: join.approval,
    gemini: join.gemini,
  };
  return remember(detail);
}

export async function respondWithIntent(
  negotiationId: string,
  intent: "accept" | "deny",
  userId: string,
): Promise<NegotiationDetail> {
  const detail = store.get(negotiationId);
  if (!detail) throw new NegotiationError(404, `negotiation ${negotiationId} not found`);
  if (detail.negotiation.userId !== userId) throw new NegotiationError(403, "negotiation belongs to a different user");
  if (detail.negotiation.status !== "awaiting_user") {
    throw new NegotiationError(409, `negotiation is in status ${detail.negotiation.status}`);
  }
  const buyer = detail.opportunity?.buyer ?? detail.finding.sourceName;
  const tenderTitle = detail.opportunity?.title ?? detail.finding.title;
  const lastPrice = [...detail.messages].reverse().find((item) => item.party === "agent" && item.price)?.price
    ?? detail.negotiation.openingPrice;
  const round = detail.negotiation.rounds;
  const agentTerms = latestAgentTerms(detail.messages);
  const agentText = await agentIntentMessage(intent, buyer, lastPrice, tenderTitle);
  const agent: NegotiationMessage = {
    id: id("msg"),
    negotiationId,
    roundIndex: round,
    party: "agent",
    channel: "simulated",
    at: new Date().toISOString(),
    price: intent === "accept" ? lastPrice : undefined,
    currency: "EUR",
    text: agentText,
    parsedOffer: buildParsedOffer(
      "agent",
      intent === "accept" ? lastPrice : undefined,
      intent,
      Object.keys(agentTerms) as TradeoffParameterKey[],
      agentTerms,
      intent === "accept" ? "Agent accepted buyer position." : "Agent withdrew from negotiation.",
    ),
  };
  if (intent === "accept") {
    const counter = await attachCounterpartyMessage(
      detail.negotiation,
      round,
      lastPrice,
      "accept",
      buyer,
      tenderTitle,
      rng(detail.negotiation.seed + round),
      agentTerms,
    );
    const next: NegotiationDetail = {
      ...detail,
      negotiation: {
        ...detail.negotiation,
        status: "accepted",
        rounds: detail.negotiation.rounds + 1,
        lastMessageAt: counter.at,
        endedAt: counter.at,
        outcome: "deal",
        agreedPrice: lastPrice,
      },
      messages: [...detail.messages, agent, counter],
      pendingOptions: [],
      dashboard: emptyDashboard(),
    };
    return remember(next);
  }
  return remember({
    ...detail,
    negotiation: {
      ...detail.negotiation,
      status: "denied",
      rounds: detail.negotiation.rounds + 1,
      lastMessageAt: agent.at,
      endedAt: agent.at,
      outcome: "no_deal",
    },
    messages: [...detail.messages, agent],
    pendingOptions: [],
    dashboard: emptyDashboard(),
  });
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
  const agentTerms = termsFromAdjusted(option.parameters, adjustedParameters);
  const agentText = await counterOffer(buyer, adjustedParameters, option.parameters, price);
  const agent: NegotiationMessage = {
    id: id("msg"),
    negotiationId,
    roundIndex: round,
    party: "agent",
    channel: "simulated",
    at: new Date().toISOString(),
    price,
    currency: "EUR",
    text: agentText,
    parsedOffer: parseAgentMessage(agentText, price, agentTerms),
  };
  const intent = evaluate(price, detail.negotiation.counterpartyFloor, round);
  const counter = await attachCounterpartyMessage(
    detail.negotiation,
    round,
    price,
    intent,
    buyer,
    detail.opportunity?.title ?? detail.finding.title,
    rng(detail.negotiation.seed + round),
    agentTerms,
  );
  const pendingOptions = intent === "negotiate"
    ? await optionsFor(
      negotiationId,
      round,
      buyer,
      counter.text,
      counter.parsedOffer!,
      price,
      detail.negotiation,
    )
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
    dashboard: emptyDashboard(),
  };
  return remember(next);
}

async function seed(userId: string) {
  for (const approvalId of ["appr_munich_it", "appr_eu_digital_services"]) {
    await startNegotiation(approvalId, userId);
  }
}

export async function listNegotiations(userId: string): Promise<NegotiationSummary[]> {
  if (!byUser.get(userId)?.size) await seed(userId);
  const byApprovalId = new Map<string, NegotiationSummary>();
  for (const id of byUser.get(userId) ?? []) {
    const detail = store.get(id);
    if (!detail) continue;
    const summary: NegotiationSummary = {
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
    };
    const prior = byApprovalId.get(summary.approvalId);
    if (!prior || summary.lastMessageAt > prior.lastMessageAt) {
      byApprovalId.set(summary.approvalId, summary);
    }
  }
  return Array.from(byApprovalId.values()).sort(
    (a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt),
  );
}

export async function getNegotiationDetail(id: string, userId: string): Promise<NegotiationDetail> {
  const detail = store.get(id);
  if (!detail) throw new NegotiationError(404, `negotiation ${id} not found`);
  if (detail.negotiation.userId !== userId) throw new NegotiationError(403, "negotiation belongs to a different user");
  return enrichDetail(detail);
}

export async function resetNegotiations(userId: string): Promise<{ cleared: number }> {
  const ids = byUser.get(userId) ?? new Set<string>();
  const cleared = ids.size;
  for (const id of ids) {
    const detail = store.get(id);
    if (detail) {
      byApproval.delete(approvalKey(userId, detail.negotiation.approvalId));
    }
    store.delete(id);
  }
  byUser.delete(userId);
  await seed(userId);
  return { cleared };
}
