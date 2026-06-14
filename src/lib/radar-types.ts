export type SourceType =
  | "public_tender_portal"
  | "procurement_page"
  | "council_project_page"
  | "curated_demo_feed"
  | "tavily_search";

export type SourceStatus = "healthy" | "degraded" | "blocked";

export type ProcurementClue =
  // Original
  | "budget_approved"
  | "supplier_call"
  | "pre_announcement"
  | "official_tender"
  | "deadline_near"
  | "login_required"
  | "event_notice"
  | "duplicate"
  | "expired"
  // Procedure type
  | "framework_agreement"
  | "open_procedure"
  | "restricted_procedure"
  | "negotiated_procedure"
  | "competitive_dialogue"
  // Document status
  | "amendment"
  | "corrigendum"
  | "clarification_deadline"
  // Logistics
  | "consortium_allowed"
  | "lots"
  | "electronic_submission";

export type Urgency = "low" | "medium" | "high";

export type RouteDecision = "ignore" | "monitor" | "qualify" | "human_review";

export type AgentRole =
  | "research_scout"
  | "extraction_agent"
  | "scoring_router"
  | "reasoning_agent"
  | "human_escalation_agent";

export type EventType =
  | "scout_started"
  | "finding_discovered"
  | "entities_extracted"
  | "finding_scored"
  | "gemini_analysis"
  | "approval_requested"
  | "opportunity_created"
  | "finding_ignored";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  geography: string;
  cadence: string;
  status: SourceStatus;
  lastCheckedAt: string;
  findingsToday: number;
};

export type EntitySpan = {
  label: string;
  text: string;
  start: number;
  end: number;
};

export type ExtractedEntities = {
  // Core (kept for back-compat with existing extractions and the
  // in-app fixture extractions).
  buyerIssuer?: string;
  projectName?: string;
  category?: string;
  location?: string;
  deadline?: string;
  budgetValue?: string;
  contactPersona?: string;
  // Tender mechanics.
  referenceNumber?: string;
  cpvCode?: string;
  procedureType?: string;
  contractDuration?: string;
  deliveryLocation?: string;
  submissionLanguage?: string;
  // Contact.
  contactEmail?: string;
  contactPhone?: string;
  // Submission & eligibility.
  scopeDescription?: string;
  eligibilityRequirements?: string;
  evaluationCriteria?: string;
};

export type Finding = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  title: string;
  url: string;
  rawText: string;
  detectedLanguage: "de" | "en";
  publishedAt: string;
  stage: "raw" | "extracted" | "scored" | "qualified" | "ignored";
};

export type Extraction = {
  id: string;
  findingId: string;
  model:
    | "fine-tuned GLiNER2 procurement radar"
    | "fine-tuned GLiNER2 (NER) + fine-tuned GLiNER2 (clues)";
  confidence: number;
  entities: ExtractedEntities;
  clueTags: ProcurementClue[];
  spans: EntitySpan[];
};

export type ModelScore = {
  id: string;
  findingId: string;
  model: "Pioneer Gemma 4 scoring router";
  worthOutreachScore: number;
  urgency: Urgency;
  route: RouteDecision;
  rationale: string;
};

export type GeminiAnalysis = {
  id: string;
  findingId: string;
  model: "Gemini deep reasoning";
  summary: string;
  risks: string[];
  recommendedNextSteps: string[];
  blocker?: string;
};

export type Opportunity = {
  id: string;
  findingId: string;
  title: string;
  buyer: string;
  owner: string;
  valueBand: string;
  deadline: string;
  nextAction: string;
  status: "new" | "blocked" | "ready_for_outreach" | "monitoring";
};

export type ApprovalRequest = {
  id: string;
  findingId: string;
  opportunityId: string;
  title: string;
  requester: AgentRole;
  blocker: string;
  requestedAction: string;
  dueAt: string;
  status: "pending" | "approved" | "needs_info";
  alertEligible: boolean;
};

export type AgentEvent = {
  id: string;
  at: string;
  role: AgentRole;
  type: EventType;
  title: string;
  detail: string;
  findingId?: string;
};

export type ScoutRun = {
  id: string;
  mode: "scheduled" | "manual_demo";
  startedAt: string;
  finishedAt?: string;
  status: "queued" | "running" | "completed";
  sourcesScanned: number;
  findingsDiscovered: number;
};

export type RadarSnapshot = {
  scoutRun: ScoutRun;
  sources: Source[];
  findings: Finding[];
  extractions: Extraction[];
  scores: ModelScore[];
  geminiAnalyses: GeminiAnalysis[];
  opportunities: Opportunity[];
  approvals: ApprovalRequest[];
  events: AgentEvent[];
};

export type SyntheticTrainingExample = {
  id: string;
  text: string;
  language: "de" | "en";
  sourceType: SourceType;
  expectedEntities: EntitySpan[];
  clueLabels: ProcurementClue[];
  split: "train" | "eval";
  exampleType: "positive" | "weak_signal" | "irrelevant" | "duplicate" | "expired";
};

// Negotiation simulator

export type NegotiationChannel = "simulated" | "email";

export type NegotiationStatus =
  | "opening"
  | "awaiting_user"
  | "counterparty_turn"
  | "accepted"
  | "denied"
  | "failed";

export type NegotiationParty = "agent" | "counterparty";

export type NegotiationIntent = "accept" | "deny" | "negotiate";

export type TradeoffParameterKey =
  | "price_delta_pct"
  | "warranty_years"
  | "service_visits"
  | "delivery_weeks";

export type TradeoffParameter = {
  key: TradeoffParameterKey;
  label: string;
  kind: "percent" | "count" | "enum";
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
};

export type CounterpartyTradeoffOption = {
  id: string;
  roundIndex: number;
  title: string;
  summary: string;
  parameters: TradeoffParameter[];
};

export type NegotiationMessage = {
  id: string;
  negotiationId: string;
  roundIndex: number;
  party: NegotiationParty;
  channel: NegotiationChannel;
  at: string;
  price?: number;
  currency?: string;
  text: string;
  parsedIntent?: NegotiationIntent;
};

export type Negotiation = {
  id: string;
  findingId: string;
  opportunityId: string;
  approvalId: string;
  userId: string;
  channel: NegotiationChannel;
  status: NegotiationStatus;
  seed: number;
  openingPrice: number;
  currency: string;
  targetPrice: number;
  counterpartyFloor: number;
  rounds: number;
  startedAt: string;
  lastMessageAt: string;
  endedAt?: string;
  outcome?: "deal" | "no_deal";
  agreedPrice?: number;
};

export type NegotiationDetail = {
  negotiation: Negotiation;
  messages: NegotiationMessage[];
  pendingOptions: CounterpartyTradeoffOption[];
  finding: Finding;
  extraction?: Extraction;
  opportunity?: Opportunity;
  approval: ApprovalRequest;
  gemini?: GeminiAnalysis;
};

export type NegotiationSummary = Pick<
  Negotiation,
  | "id"
  | "findingId"
  | "approvalId"
  | "opportunityId"
  | "status"
  | "openingPrice"
  | "currency"
  | "targetPrice"
  | "rounds"
  | "startedAt"
  | "lastMessageAt"
  | "endedAt"
  | "outcome"
  | "agreedPrice"
> & {
  title: string;
  buyer: string;
};
