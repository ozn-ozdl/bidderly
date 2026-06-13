import { shouldCallGemini, validateCascadeGate } from "./cascade";
import type {
  AgentEvent,
  ApprovalRequest,
  Extraction,
  Finding,
  GeminiAnalysis,
  ModelScore,
  Opportunity,
  RadarSnapshot,
  ScoutRun,
  Source,
  SyntheticTrainingExample,
} from "./radar-types";

export const scoutRun: ScoutRun = {
  id: "run_2026_06_13_0915",
  mode: "manual_demo",
  startedAt: "2026-06-13T09:15:00.000Z",
  finishedAt: "2026-06-13T09:17:42.000Z",
  status: "completed",
  sourcesScanned: 7,
  findingsDiscovered: 6,
};

export const sources: Source[] = [
  {
    id: "src_ted_eu",
    name: "TED EU tenders",
    type: "public_tender_portal",
    url: "https://ted.europa.eu",
    geography: "EU",
    cadence: "Every 20 minutes",
    status: "healthy",
    lastCheckedAt: "2026-06-13T09:15:12.000Z",
    findingsToday: 18,
  },
  {
    id: "src_bund_de",
    name: "Bund.de procurement",
    type: "public_tender_portal",
    url: "https://www.service.bund.de",
    geography: "Germany",
    cadence: "Every 15 minutes",
    status: "healthy",
    lastCheckedAt: "2026-06-13T09:15:21.000Z",
    findingsToday: 11,
  },
  {
    id: "src_munich_council",
    name: "Munich council projects",
    type: "council_project_page",
    url: "https://stadt.muenchen.de",
    geography: "Bavaria",
    cadence: "Hourly",
    status: "healthy",
    lastCheckedAt: "2026-06-13T09:13:44.000Z",
    findingsToday: 4,
  },
  {
    id: "src_berlin_energy",
    name: "Berlin energy announcements",
    type: "procurement_page",
    url: "https://www.berlin.de",
    geography: "Berlin",
    cadence: "Hourly",
    status: "degraded",
    lastCheckedAt: "2026-06-13T09:04:18.000Z",
    findingsToday: 3,
  },
  {
    id: "src_demo_feed",
    name: "Curated hackathon feed",
    type: "curated_demo_feed",
    url: "local://demo-feed",
    geography: "Germany / EU",
    cadence: "Manual demo",
    status: "healthy",
    lastCheckedAt: "2026-06-13T09:15:00.000Z",
    findingsToday: 6,
  },
];

export const findings: Finding[] = [
  {
    id: "find_munich_it",
    sourceId: "src_munich_council",
    sourceName: "Munich council projects",
    sourceType: "council_project_page",
    title: "Digital classroom network modernization for Munich school district",
    url: "https://stadt.muenchen.de/demo/school-network-modernization",
    detectedLanguage: "de",
    publishedAt: "2026-06-13T08:42:00.000Z",
    stage: "qualified",
    rawText:
      "Der Bildungsausschuss der Landeshauptstadt München hat ein Budget von 2,4 Mio. EUR für die Modernisierung der WLAN- und Firewall-Infrastruktur an 18 Schulen freigegeben. Die Vergabestelle bittet IT-Dienstleister um Rückmeldung bis 28.06.2026. Zugang zum vollständigen Leistungsverzeichnis erfordert eine Registrierung im Bieterportal.",
  },
  {
    id: "find_berlin_solar",
    sourceId: "src_berlin_energy",
    sourceName: "Berlin energy announcements",
    sourceType: "procurement_page",
    title: "Pre-announcement: solar roofs and monitoring for Berlin civic buildings",
    url: "https://www.berlin.de/demo/solar-roofs-monitoring",
    detectedLanguage: "de",
    publishedAt: "2026-06-13T08:16:00.000Z",
    stage: "qualified",
    rawText:
      "Die Senatsverwaltung bereitet eine Markterkundung für Photovoltaik-Dachanlagen und Energiemonitoring an 12 öffentlichen Gebäuden in Berlin vor. Eine Vorinformation nennt ein geplantes Budget von ca. 4,8 Mio. EUR und eine Informationsveranstaltung am 03.07.2026.",
  },
  {
    id: "find_hamburg_supplier_day",
    sourceId: "src_demo_feed",
    sourceName: "Curated hackathon feed",
    sourceType: "curated_demo_feed",
    title: "Hamburg supplier day for citizen service kiosk software",
    url: "local://demo-feed/hamburg-kiosk-software",
    detectedLanguage: "de",
    publishedAt: "2026-06-12T17:28:00.000Z",
    stage: "scored",
    rawText:
      "Hamburg Service vor Ort lädt Softwareanbieter zu einem Lieferantentag für Self-Service-Kioske im Bürgeramt ein. Gesucht werden Anbieter mit Erfahrung bei Terminverwaltung, Barrierefreiheit und sicheren Identitätsprozessen. Der Termin findet am 19.06.2026 statt.",
  },
  {
    id: "find_eu_digital_services",
    sourceId: "src_ted_eu",
    sourceName: "TED EU tenders",
    sourceType: "public_tender_portal",
    title: "EU regional digital public services framework",
    url: "https://ted.europa.eu/demo/regional-digital-services-framework",
    detectedLanguage: "en",
    publishedAt: "2026-06-13T07:54:00.000Z",
    stage: "qualified",
    rawText:
      "The European Regional Innovation Office published an official tender for a digital public services framework covering citizen portals, document workflow and secure notification modules. Estimated value is EUR 12,000,000. Requests to participate close on 24 June 2026. A cross-border consortium statement is required.",
  },
  {
    id: "find_cologne_duplicate",
    sourceId: "src_bund_de",
    sourceName: "Bund.de procurement",
    sourceType: "public_tender_portal",
    title: "Duplicate notice: Cologne facility cleaning extension",
    url: "https://www.service.bund.de/demo/cologne-cleaning-duplicate",
    detectedLanguage: "de",
    publishedAt: "2026-06-13T07:22:00.000Z",
    stage: "ignored",
    rawText:
      "Bekanntmachung zur Verlängerung eines bestehenden Reinigungsvertrags für Verwaltungsgebäude in Köln. Diese Veröffentlichung ersetzt eine bereits archivierte Bekanntmachung vom 11.06.2026.",
  },
  {
    id: "find_random_event",
    sourceId: "src_demo_feed",
    sourceName: "Curated hackathon feed",
    sourceType: "curated_demo_feed",
    title: "General networking breakfast for municipal IT leaders",
    url: "local://demo-feed/network-breakfast",
    detectedLanguage: "de",
    publishedAt: "2026-06-12T09:00:00.000Z",
    stage: "ignored",
    rawText:
      "Kommunale IT-Leiter treffen sich zu einem Frühstück über allgemeine Digitalisierungstrends. Es wurden keine Beschaffung, kein Budget und keine Frist angekündigt.",
  },
];

export const extractions: Extraction[] = [
  {
    id: "ext_munich_it",
    findingId: "find_munich_it",
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: 0.94,
    entities: {
      buyerIssuer: "Landeshauptstadt München",
      projectName: "Modernisierung der WLAN- und Firewall-Infrastruktur",
      category: "School IT infrastructure",
      location: "Munich, Bavaria",
      deadline: "2026-06-28",
      budgetValue: "EUR 2.4M",
      contactPersona: "Vergabestelle / IT procurement",
    },
    clueTags: [
      "budget_approved",
      "supplier_call",
      "deadline_near",
      "login_required",
      "pre_announcement",
    ],
    spans: [
      { label: "buyer_issuer", text: "Landeshauptstadt München", start: 26, end: 50 },
      {
        label: "budget_value",
        text: "2,4 Mio. EUR",
        start: 71,
        end: 83,
      },
      {
        label: "project_name",
        text: "Modernisierung der WLAN- und Firewall-Infrastruktur",
        start: 92,
        end: 144,
      },
      { label: "deadline", text: "28.06.2026", start: 223, end: 233 },
    ],
  },
  {
    id: "ext_berlin_solar",
    findingId: "find_berlin_solar",
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: 0.9,
    entities: {
      buyerIssuer: "Senatsverwaltung Berlin",
      projectName: "Photovoltaik-Dachanlagen und Energiemonitoring",
      category: "Energy infrastructure",
      location: "Berlin",
      deadline: "2026-07-03",
      budgetValue: "EUR 4.8M planned",
      contactPersona: "Energy program office",
    },
    clueTags: ["pre_announcement", "budget_approved", "event_notice"],
    spans: [
      { label: "buyer_issuer", text: "Senatsverwaltung", start: 4, end: 20 },
      {
        label: "project_name",
        text: "Photovoltaik-Dachanlagen und Energiemonitoring",
        start: 52,
        end: 98,
      },
      { label: "budget_value", text: "4,8 Mio. EUR", start: 173, end: 185 },
      { label: "deadline", text: "03.07.2026", start: 226, end: 236 },
    ],
  },
  {
    id: "ext_hamburg_supplier_day",
    findingId: "find_hamburg_supplier_day",
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: 0.87,
    entities: {
      buyerIssuer: "Hamburg Service vor Ort",
      projectName: "Self-Service-Kioske im Bürgeramt",
      category: "Citizen service software",
      location: "Hamburg",
      deadline: "2026-06-19",
      contactPersona: "Citizen service program owner",
    },
    clueTags: ["supplier_call", "event_notice", "deadline_near"],
    spans: [
      {
        label: "buyer_issuer",
        text: "Hamburg Service vor Ort",
        start: 0,
        end: 24,
      },
      {
        label: "project_name",
        text: "Self-Service-Kioske im Bürgeramt",
        start: 76,
        end: 109,
      },
      { label: "deadline", text: "19.06.2026", start: 236, end: 246 },
    ],
  },
  {
    id: "ext_eu_digital_services",
    findingId: "find_eu_digital_services",
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: 0.96,
    entities: {
      buyerIssuer: "European Regional Innovation Office",
      projectName: "Digital public services framework",
      category: "Citizen portals and workflow software",
      location: "European Union",
      deadline: "2026-06-24",
      budgetValue: "EUR 12M",
      contactPersona: "Framework procurement board",
    },
    clueTags: ["official_tender", "deadline_near", "budget_approved"],
    spans: [
      {
        label: "buyer_issuer",
        text: "European Regional Innovation Office",
        start: 4,
        end: 39,
      },
      {
        label: "project_name",
        text: "digital public services framework",
        start: 77,
        end: 110,
      },
      { label: "budget_value", text: "EUR 12,000,000", start: 208, end: 222 },
      { label: "deadline", text: "24 June 2026", start: 256, end: 268 },
    ],
  },
  {
    id: "ext_cologne_duplicate",
    findingId: "find_cologne_duplicate",
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: 0.82,
    entities: {
      buyerIssuer: "Köln Verwaltung",
      projectName: "Reinigungsvertrag Verwaltungsgebäude",
      category: "Facility services",
      location: "Cologne",
    },
    clueTags: ["duplicate"],
    spans: [
      {
        label: "project_name",
        text: "Reinigungsvertrags für Verwaltungsgebäude",
        start: 44,
        end: 88,
      },
      { label: "location", text: "Köln", start: 92, end: 96 },
    ],
  },
  {
    id: "ext_random_event",
    findingId: "find_random_event",
    model: "fine-tuned GLiNER2 procurement radar",
    confidence: 0.74,
    entities: {
      buyerIssuer: "Kommunale IT-Leiter",
      category: "Networking event",
      location: "Germany",
    },
    clueTags: [],
    spans: [
      { label: "buyer_issuer", text: "Kommunale IT-Leiter", start: 0, end: 20 },
    ],
  },
];

export const scores: ModelScore[] = [
  {
    id: "score_munich_it",
    findingId: "find_munich_it",
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: 88,
    urgency: "high",
    route: "human_review",
    rationale:
      "Budget is approved, deadline is close, and portal registration blocks automated follow-up.",
  },
  {
    id: "score_berlin_solar",
    findingId: "find_berlin_solar",
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: 76,
    urgency: "medium",
    route: "qualify",
    rationale:
      "Strong early signal with funded energy scope and a dated supplier information event.",
  },
  {
    id: "score_hamburg_supplier_day",
    findingId: "find_hamburg_supplier_day",
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: 64,
    urgency: "medium",
    route: "qualify",
    rationale:
      "Relevant software category and supplier event, but no budget or formal tender yet.",
  },
  {
    id: "score_eu_digital_services",
    findingId: "find_eu_digital_services",
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: 94,
    urgency: "high",
    route: "human_review",
    rationale:
      "Large official framework with a near participation deadline and consortium requirement.",
  },
  {
    id: "score_cologne_duplicate",
    findingId: "find_cologne_duplicate",
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: 22,
    urgency: "low",
    route: "ignore",
    rationale:
      "Duplicate extension notice for facility services, outside the target software profile.",
  },
  {
    id: "score_random_event",
    findingId: "find_random_event",
    model: "Pioneer Gemma 4 scoring router",
    worthOutreachScore: 16,
    urgency: "low",
    route: "ignore",
    rationale:
      "No procurement clue, budget, source authority, deadline, or actionable buyer intent.",
  },
];

const candidateGeminiAnalyses: GeminiAnalysis[] = [
  {
    id: "gem_munich_it",
    findingId: "find_munich_it",
    model: "Gemini deep reasoning",
    summary:
      "This is likely an early procurement window before a full tender package is released. The account team should confirm portal registration, gather school-network references, and prepare a concise capability note.",
    risks: [
      "Portal registration may reveal mandatory certifications not in the public snippet.",
      "Deadline is close enough that slow internal approval could lose the window.",
    ],
    recommendedNextSteps: [
      "Ask user to approve contacting the procurement office.",
      "Assign public-sector IT owner to gather school WLAN references.",
      "Prepare registration checklist and capability note.",
    ],
    blocker: "Human approval required before contacting the procurement office.",
  },
  {
    id: "gem_berlin_solar",
    findingId: "find_berlin_solar",
    model: "Gemini deep reasoning",
    summary:
      "A pre-announcement can become a partner-led qualification motion. The best next step is to reserve the supplier event and map partners with public-building energy monitoring references.",
    risks: [
      "Scope may prioritize construction partners over software-led monitoring.",
      "Pre-announcement details may shift before the formal tender.",
    ],
    recommendedNextSteps: [
      "Monitor for formal tender publication.",
      "Prepare two-part offer: PV delivery partner plus monitoring software.",
    ],
  },
  {
    id: "gem_eu_digital_services",
    findingId: "find_eu_digital_services",
    model: "Gemini deep reasoning",
    summary:
      "The framework is high value, but participation depends on a consortium statement. Escalation is justified because the team must decide whether to lead, join, or decline a cross-border bid.",
    risks: [
      "Consortium statement creates legal and partner dependency before qualification.",
      "Framework size may imply heavy documentation and multiple lots.",
    ],
    recommendedNextSteps: [
      "Ask user whether to lead or join a consortium.",
      "Draft a partner shortlist and qualification memo.",
      "Block owner calendar before 24 June 2026.",
    ],
    blocker: "User must choose consortium strategy before agents draft outreach.",
  },
];

export const geminiAnalyses: GeminiAnalysis[] = candidateGeminiAnalyses.filter((analysis) => {
  const score = scores.find((item) => item.findingId === analysis.findingId);
  const approval = undefined;

  return score ? shouldCallGemini(score, approval) : false;
});

export const opportunities: Opportunity[] = [
  {
    id: "opp_munich_it",
    findingId: "find_munich_it",
    title: "Munich school network modernization",
    buyer: "Landeshauptstadt München",
    owner: "DACH public sector sales",
    valueBand: "EUR 2M-3M",
    deadline: "2026-06-28",
    nextAction: "Approve procurement-office contact",
    status: "blocked",
  },
  {
    id: "opp_berlin_solar",
    findingId: "find_berlin_solar",
    title: "Berlin civic buildings energy monitoring",
    buyer: "Senatsverwaltung Berlin",
    owner: "Energy partnerships",
    valueBand: "EUR 4M-5M planned",
    deadline: "2026-07-03",
    nextAction: "Reserve supplier information event",
    status: "ready_for_outreach",
  },
  {
    id: "opp_eu_digital_services",
    findingId: "find_eu_digital_services",
    title: "EU digital public services framework",
    buyer: "European Regional Innovation Office",
    owner: "EU enterprise team",
    valueBand: "EUR 10M+",
    deadline: "2026-06-24",
    nextAction: "Decide consortium strategy",
    status: "blocked",
  },
];

export const approvals: ApprovalRequest[] = [
  {
    id: "appr_munich_it",
    findingId: "find_munich_it",
    opportunityId: "opp_munich_it",
    title: "Contact Munich procurement office",
    requester: "human_escalation_agent",
    blocker: "Portal registration and outreach require user approval.",
    requestedAction:
      "Approve a short email asking for registration access and clarification on school WLAN certifications.",
    dueAt: "2026-06-14T10:00:00.000Z",
    status: "pending",
    alertEligible: true,
  },
  {
    id: "appr_eu_digital_services",
    findingId: "find_eu_digital_services",
    opportunityId: "opp_eu_digital_services",
    title: "Choose EU consortium route",
    requester: "human_escalation_agent",
    blocker: "Consortium strategy is a business judgment agents cannot make.",
    requestedAction:
      "Choose lead bidder, partner bidder, or decline before Gemini drafts the action plan.",
    dueAt: "2026-06-14T16:00:00.000Z",
    status: "pending",
    alertEligible: true,
  },
];

export const events: AgentEvent[] = [
  {
    id: "evt_001",
    at: "2026-06-13T09:15:00.000Z",
    role: "research_scout",
    type: "scout_started",
    title: "Scout run started",
    detail: "Scanning 7 German/EU procurement and announcement sources.",
  },
  {
    id: "evt_002",
    at: "2026-06-13T09:15:18.000Z",
    role: "research_scout",
    type: "finding_discovered",
    title: "6 raw findings discovered",
    detail: "Tavily enrichment and curated demo feed returned procurement signals.",
  },
  {
    id: "evt_003",
    at: "2026-06-13T09:15:47.000Z",
    role: "extraction_agent",
    type: "entities_extracted",
    title: "GLiNER2 extraction complete",
    detail: "Buyer, project, deadline, budget, contact persona, and clue tags extracted.",
    findingId: "find_munich_it",
  },
  {
    id: "evt_004",
    at: "2026-06-13T09:16:08.000Z",
    role: "scoring_router",
    type: "finding_scored",
    title: "Gemma 4 routed high-value finding",
    detail: "Munich school network modernization scored 88 and routed to human review.",
    findingId: "find_munich_it",
  },
  {
    id: "evt_005",
    at: "2026-06-13T09:16:44.000Z",
    role: "reasoning_agent",
    type: "gemini_analysis",
    title: "Gemini deep analysis generated",
    detail: "Reasoning reserved for high-value findings and blockers.",
    findingId: "find_munich_it",
  },
  {
    id: "evt_006",
    at: "2026-06-13T09:17:11.000Z",
    role: "human_escalation_agent",
    type: "approval_requested",
    title: "Approval requested",
    detail: "Contacting the Munich procurement office needs user approval.",
    findingId: "find_munich_it",
  },
  {
    id: "evt_007",
    at: "2026-06-13T09:17:28.000Z",
    role: "scoring_router",
    type: "finding_ignored",
    title: "Low-score items suppressed",
    detail: "Duplicate and irrelevant event findings did not trigger alerts.",
  },
  {
    id: "evt_008",
    at: "2026-06-13T09:17:42.000Z",
    role: "human_escalation_agent",
    type: "approval_requested",
    title: "EU consortium decision requested",
    detail: "Gemini flagged a business decision before outreach drafting.",
    findingId: "find_eu_digital_services",
  },
];

export const syntheticTrainingExamples: SyntheticTrainingExample[] = [
  {
    id: "train_positive_munich",
    text: findings[0].rawText,
    language: "de",
    sourceType: "council_project_page",
    expectedEntities: extractions[0].spans,
    clueLabels: extractions[0].clueTags,
    split: "train",
    exampleType: "positive",
  },
  {
    id: "train_weak_berlin",
    text: findings[1].rawText,
    language: "de",
    sourceType: "procurement_page",
    expectedEntities: extractions[1].spans,
    clueLabels: extractions[1].clueTags,
    split: "train",
    exampleType: "weak_signal",
  },
  {
    id: "eval_positive_eu",
    text: findings[3].rawText,
    language: "en",
    sourceType: "public_tender_portal",
    expectedEntities: extractions[3].spans,
    clueLabels: extractions[3].clueTags,
    split: "eval",
    exampleType: "positive",
  },
  {
    id: "eval_duplicate_cologne",
    text: findings[4].rawText,
    language: "de",
    sourceType: "public_tender_portal",
    expectedEntities: extractions[4].spans,
    clueLabels: extractions[4].clueTags,
    split: "eval",
    exampleType: "duplicate",
  },
  {
    id: "train_irrelevant_networking",
    text: findings[5].rawText,
    language: "de",
    sourceType: "curated_demo_feed",
    expectedEntities: extractions[5].spans,
    clueLabels: [],
    split: "train",
    exampleType: "irrelevant",
  },
  {
    id: "eval_expired_budget_note",
    text: "Die Stadt Essen veröffentlichte am 02.05.2026 einen Hinweis zur abgeschlossenen Beschaffung eines Dokumentenmanagementsystems. Die Angebotsfrist endete am 17.05.2026.",
    language: "de",
    sourceType: "procurement_page",
    expectedEntities: [
      { label: "buyer_issuer", text: "Stadt Essen", start: 4, end: 15 },
      {
        label: "project_name",
        text: "Dokumentenmanagementsystems",
        start: 91,
        end: 118,
      },
      { label: "deadline", text: "17.05.2026", start: 147, end: 157 },
    ],
    clueLabels: ["expired"],
    split: "eval",
    exampleType: "expired",
  },
];

export function getRadarSnapshot(): RadarSnapshot {
  const snapshot = {
    scoutRun,
    sources,
    findings,
    extractions,
    scores,
    geminiAnalyses,
    opportunities,
    approvals,
    events,
  };

  if (!validateCascadeGate(snapshot)) {
    throw new Error("Gemini analysis violated the cascade gate.");
  }

  return snapshot;
}

export function getLiveEventSequence() {
  return events.filter((event) =>
    [
      "scout_started",
      "finding_discovered",
      "entities_extracted",
      "finding_scored",
      "gemini_analysis",
      "approval_requested",
    ].includes(event.type),
  );
}
