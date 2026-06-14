import { shouldCallGemini } from "./cascade";
import { getIntegrationStatus, shouldUseFixtureMode } from "./env";
import {
  approvals as fixtureApprovals,
  events as fixtureEvents,
  getRadarSnapshot,
  sources as fixtureSources,
} from "./demo-data";
import {
  analyzeWithGemini,
  extractWithGliner,
  scoreWithGemma,
  searchTenderSignals,
} from "./provider-clients";
import { scrapeTenderPages, type RawPage } from "@/lib/scraper";
import { isPioneerDryRun } from "@/lib/pioneer";
import type {
  AgentEvent,
  ApprovalRequest,
  Finding,
  GeminiAnalysis,
  ModelScore,
  Opportunity,
  RadarSnapshot,
  ScoutRun,
  Source,
  SourceType,
} from "./radar-types";

export async function buildRadarSnapshot() {
  return getRadarSnapshot();
}

// --- Mock tender sources (resolved against public/mock-tenders) ----------

function mockTenderBaseUrl(): string {
  return process.env.MOCK_TENDER_BASE_URL ?? "http://localhost:3000/mock-tenders";
}

const MOCK_TENDER_SOURCES: Source[] = [
  {
    id: "src_mock_munich",
    name: "Mock tender portal — Munich school network",
    type: "public_tender_portal",
    url: `${mockTenderBaseUrl()}/munich-it.html`,
    geography: "Bavaria",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_berlin",
    name: "Mock tender portal — Berlin solar roofs",
    type: "public_tender_portal",
    url: `${mockTenderBaseUrl()}/berlin-solar.html`,
    geography: "Berlin",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_hamburg",
    name: "Mock tender portal — Hamburg supplier day",
    type: "procurement_page",
    url: `${mockTenderBaseUrl()}/hamburg-supplier-day.html`,
    geography: "Hamburg",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_eu",
    name: "Mock tender portal — EU digital services",
    type: "public_tender_portal",
    url: `${mockTenderBaseUrl()}/eu-digital-services.html`,
    geography: "European Union",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_cologne",
    name: "Mock tender portal — Cologne duplicate",
    type: "public_tender_portal",
    url: `${mockTenderBaseUrl()}/cologne-duplicate.html`,
    geography: "North Rhine-Westphalia",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_breakfast",
    name: "Mock tender portal — IT leaders breakfast",
    type: "curated_demo_feed",
    url: `${mockTenderBaseUrl()}/network-breakfast.html`,
    geography: "Germany",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_stuttgart",
    name: "Mock tender portal — Stuttgart energy follow-up",
    type: "procurement_page",
    url: `${mockTenderBaseUrl()}/stuttgart-energy.html`,
    geography: "Baden-Württemberg",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_bremen",
    name: "Mock tender portal — Bremen document management (expired)",
    type: "procurement_page",
    url: `${mockTenderBaseUrl()}/bremen-expired.html`,
    geography: "Bremen",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
];

function pageToFinding(page: RawPage, source: Source): Finding {
  const fallbackId = `find_scraped_${stableId(page.url)}`;
  return {
    id: page.tenderId ?? fallbackId,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type as SourceType,
    title: page.title ?? `Scraped: ${new URL(page.url).pathname.split("/").pop() ?? page.url}`,
    url: page.finalUrl,
    rawText: page.rawText,
    detectedLanguage: page.detectedLanguage,
    publishedAt: page.publishedAt ?? new Date().toISOString(),
    stage: "raw",
  };
}

function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function runScoutPipeline(): Promise<{
  snapshot: RadarSnapshot;
  source: "fixture" | "live";
  warnings: string[];
  scraper?: { pages: number; failures: number; durationMs: number };
}> {
  const status = getIntegrationStatus();

  if (shouldUseFixtureMode()) {
    return {
      snapshot: getRadarSnapshot(),
      source: "fixture",
      warnings:
        status.mode === "fixture"
          ? []
          : [`Live mode is missing: ${status.missing.join(", ")}`],
    };
  }

  const warnings: string[] = [];
  const startedAt = new Date();
  const events: AgentEvent[] = [];

  // --- 1. Scraper stage --------------------------------------------------
  const scraperStart = Date.now();
  const scrapeResult = await scrapeTenderPages(MOCK_TENDER_SOURCES);
  const scraperDurationMs = Date.now() - scraperStart;
  const findings: Finding[] = [];
  for (const source of MOCK_TENDER_SOURCES) {
    const page = scrapeResult.pages.find((p) => p.url === source.url);
    if (page) {
      findings.push(pageToFinding(page, source));
    } else {
      const failure = scrapeResult.failures.find((f) => f.url === source.url);
      if (failure) warnings.push(`scraper ${source.name}: ${failure.reason}`);
    }
  }
  if (findings.length > 0) {
    events.push({
      id: `evt_${startedAt.getTime()}_scraped`,
      at: new Date().toISOString(),
      role: "research_scout",
      type: "finding_discovered",
      title: `${findings.length} scraped findings`,
      detail: `Scraped ${scrapeResult.pages.length} mock tender pages, ${scrapeResult.failures.length} failures.`,
    });
  }

  // --- 2. Tavily enrichment --------------------------------------------
  try {
    const tavilyFindings = await searchTenderSignals();
    findings.push(...tavilyFindings);
  } catch (err) {
    warnings.push(`tavily: ${err instanceof Error ? err.message : String(err)}`);
  }

  const scoutRun: ScoutRun = {
    id: `run_live_${startedAt.getTime()}`,
    mode: "scheduled",
    startedAt: startedAt.toISOString(),
    status: "running",
    sourcesScanned: MOCK_TENDER_SOURCES.length,
    findingsDiscovered: findings.length,
  };
  events.unshift({
    id: `evt_${scoutRun.id}_started`,
    at: scoutRun.startedAt,
    role: "research_scout",
    type: "scout_started",
    title: "Live scout run started",
    detail: `Scraping ${MOCK_TENDER_SOURCES.length} mock tender portals with Pioneer pipeline.`,
  });

  const extractions = [];
  const scores: ModelScore[] = [];
  const geminiAnalyses: GeminiAnalysis[] = [];
  const opportunities: Opportunity[] = [];
  const approvals: ApprovalRequest[] = [];

  for (const finding of findings) {
    try {
      const extraction = await extractWithGliner(finding);
      extractions.push(extraction);
      events.push({
        id: `evt_${finding.id}_extracted`,
        at: new Date().toISOString(),
        role: "extraction_agent",
        type: "entities_extracted",
        title: "Pioneer GLiNER2 extraction complete",
        detail: `${finding.title} structured into entities and clue tags.`,
        findingId: finding.id,
      });

      const score = await scoreWithGemma(finding, extraction);
      scores.push(score);
      events.push({
        id: `evt_${finding.id}_scored`,
        at: new Date().toISOString(),
        role: "scoring_router",
        type: "finding_scored",
        title: "Pioneer Gemma 4 route assigned",
        detail: `${score.worthOutreachScore}/100 routed to ${score.route}.`,
        findingId: finding.id,
      });

      if (score.route === "ignore") {
        continue;
      }

      const opportunity: Opportunity = {
        id: `opp_${finding.id}`,
        findingId: finding.id,
        title: extraction.entities.projectName ?? finding.title,
        buyer: extraction.entities.buyerIssuer ?? "Unknown buyer",
        owner: "Sales qualification",
        valueBand: extraction.entities.budgetValue ?? "Unknown value",
        deadline: extraction.entities.deadline ?? "TBD",
        nextAction:
          score.route === "human_review"
            ? "Review and approve next action"
            : "Qualify buyer fit",
        status: score.route === "human_review" ? "blocked" : "ready_for_outreach",
      };
      opportunities.push(opportunity);

      let approval: ApprovalRequest | undefined;
      if (score.route === "human_review") {
        approval = {
          id: `appr_${finding.id}`,
          findingId: finding.id,
          opportunityId: opportunity.id,
          title: `Review ${opportunity.title}`,
          requester: "human_escalation_agent",
          blocker: "Human review required by Gemma 4 route.",
          requestedAction: "Approve outreach preparation or request more qualification.",
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
          alertEligible: true,
        };
        approvals.push(approval);
      }

      if (shouldCallGemini(score, approval)) {
        const analysis = await analyzeWithGemini(finding, extraction, score);
        geminiAnalyses.push(analysis);

        if (analysis.blocker && !approval) {
          approvals.push({
            id: `appr_${finding.id}`,
            findingId: finding.id,
            opportunityId: opportunity.id,
            title: `Resolve blocker for ${opportunity.title}`,
            requester: "human_escalation_agent",
            blocker: analysis.blocker,
            requestedAction:
              "Provide approval or missing context before agents continue outreach.",
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: "pending",
            alertEligible: true,
          });
        }
      }
    } catch (error) {
      warnings.push(
        `${finding.title}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const finishedAt = new Date().toISOString();
  const snapshot: RadarSnapshot = {
    scoutRun: { ...scoutRun, finishedAt, status: "completed" },
    sources: [
      ...fixtureSources.filter((source) => source.id !== "src_tavily_live"),
      {
        id: "src_tavily_live",
        name: "Tavily live search",
        type: "tavily_search",
        url: "https://api.tavily.com/search",
        geography: "Germany / EU",
        cadence: "Manual or cron",
        status: warnings.length > 0 ? "degraded" : "healthy",
        lastCheckedAt: finishedAt,
        findingsToday: findings.length,
      },
      ...MOCK_TENDER_SOURCES.map((source) => ({
        ...source,
        status: warnings.some((w) => w.startsWith(`scraper ${source.name}`))
          ? ("degraded" as const)
          : ("healthy" as const),
        lastCheckedAt: finishedAt,
        findingsToday: scrapeResult.pages.filter((p) => p.url === source.url).length,
      })),
    ],
    findings,
    extractions,
    scores,
    geminiAnalyses,
    opportunities,
    approvals,
    events: [
      ...events,
      ...fixtureEvents.filter((event) =>
        ["approval_requested", "finding_ignored"].includes(event.type),
      ),
    ],
  };

  if (snapshot.findings.length === 0 || snapshot.scores.length === 0) {
    return {
      snapshot: {
        ...getRadarSnapshot(),
        events: [
          {
            id: `evt_${scoutRun.id}_fallback`,
            at: finishedAt,
            role: "research_scout",
            type: "finding_discovered",
            title: "Live run fell back to curated demo",
            detail:
              warnings[0] ??
              "No live findings survived extraction and scoring; showing demo data.",
          },
          ...fixtureEvents,
        ],
      },
      source: "fixture",
      warnings,
    };
  }

  if (snapshot.approvals.length === 0) {
    snapshot.approvals = fixtureApprovals;
  }

  // Pioneer dry-run flag is informational; included for the UI badge.
  void isPioneerDryRun;

  return {
    snapshot,
    source: "live",
    warnings,
    scraper: {
      pages: scrapeResult.pages.length,
      failures: scrapeResult.failures.length,
      durationMs: scraperDurationMs,
    },
  };
}
