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

// --- Mock tender sources (resolved against the standalone mock-sites
//     Railway service) ---------------------------------------------------
//
// Four distinct mock tender portals hosted by the bidderly-mock-sites
// service: TED EU, Bund.de, stadt.muenchen.de, berlin.de. The scraper
// follows the internal links each portal home exposes, so a single
// entry per portal produces ~3 tender detail pages per run.

function mockTenderBaseUrl(): string {
  return process.env.MOCK_TENDER_BASE_URL ?? "http://localhost:3002";
}

const MOCK_TENDER_PORTALS: Source[] = [
  {
    id: "src_mock_ted_eu",
    name: "Mock portal — TED EU",
    type: "public_tender_portal",
    url: `${mockTenderBaseUrl()}/ted-eu/`,
    geography: "European Union",
    cadence: "Scraper run (Tavily → home → detail links)",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_bund_de",
    name: "Mock portal — Bund.de",
    type: "public_tender_portal",
    url: `${mockTenderBaseUrl()}/bund-de/`,
    geography: "Germany (federal)",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_stadt_muenchen",
    name: "Mock portal — stadt.muenchen.de",
    type: "council_project_page",
    url: `${mockTenderBaseUrl()}/stadt-muenchen/`,
    geography: "Bavaria",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
  {
    id: "src_mock_berlin_de",
    name: "Mock portal — berlin.de",
    type: "procurement_page",
    url: `${mockTenderBaseUrl()}/berlin-de/`,
    geography: "Berlin",
    cadence: "Scraper run",
    status: "healthy",
    lastCheckedAt: new Date().toISOString(),
    findingsToday: 0,
  },
];

function pageToFinding(page: RawPage, source: Source): Finding {
  const fallbackId = `find_scraped_${stableId(page.url)}`;
  // A detail page (has tender-id meta) becomes its own finding; a
  // portal home (no tender-id) gets a stable id derived from the url
  // and a placeholder title so the cascade still scores it.
  const title = page.title
    ? `${source.name.replace(/^Mock portal — /, "")} · ${page.title}`
    : source.name;
  return {
    id: page.tenderId ?? fallbackId,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type as SourceType,
    title,
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
  tavily?: { results: number; query: string };
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
  // Fetch the 4 portal home pages, then follow the tender-detail
  // links each home exposes. The scraper's allow-list covers
  // MOCK_TENDER_BASE_URL via env.
  const scraperStart = Date.now();
  const scrapeResult = await scrapeTenderPages(MOCK_TENDER_PORTALS, {
    followLinks: true,
    maxLinksPerPortal: 8,
  });
  const scraperDurationMs = Date.now() - scraperStart;
  const findings: Finding[] = [];
  for (const page of scrapeResult.pages) {
    const source = sourceForPage(page.url, MOCK_TENDER_PORTALS);
    if (!source) continue;
    findings.push(pageToFinding(page, source));
  }
  for (const failure of scrapeResult.failures) {
    warnings.push(`scraper ${failure.url}: ${failure.reason}`);
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
  // Tavily discovers URLs across the web and the live portal list;
  // the resulting findings augment the scraped set.
  let tavilyResultsCount = 0;
  let tavilyQuery = "";
  try {
    const tavilyFindings = await searchTenderSignals();
    tavilyResultsCount = tavilyFindings.length;
    tavilyQuery = process.env.TAVILY_SCOUT_QUERY ?? "";
    findings.push(...tavilyFindings);
  } catch (err) {
    warnings.push(`tavily: ${err instanceof Error ? err.message : String(err)}`);
  }

  const scoutRun: ScoutRun = {
    id: `run_live_${startedAt.getTime()}`,
    mode: "scheduled",
    startedAt: startedAt.toISOString(),
    status: "running",
    sourcesScanned: MOCK_TENDER_PORTALS.length + 1,
    findingsDiscovered: findings.length,
  };
  events.unshift({
    id: `evt_${scoutRun.id}_started`,
    at: scoutRun.startedAt,
    role: "research_scout",
    type: "scout_started",
    title: "Live scout run started",
    detail: `Tavily → 4 mock portals → ${MOCK_TENDER_PORTALS.length} portal homes with link follow → Pioneer fine-tuned cascade.`,
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
        status: warnings.some((w) => w.startsWith("tavily"))
          ? ("degraded" as const)
          : ("healthy" as const),
        lastCheckedAt: finishedAt,
        findingsToday: tavilyResultsCount,
      },
      ...MOCK_TENDER_PORTALS.map((source) => ({
        ...source,
        status: warnings.some((w) => w.includes(source.name))
          ? ("degraded" as const)
          : ("healthy" as const),
        lastCheckedAt: finishedAt,
        findingsToday: scrapeResult.pages.filter(
          (p) => sourceForPage(p.url, MOCK_TENDER_PORTALS)?.id === source.id,
        ).length,
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
    tavily: {
      results: tavilyResultsCount,
      query: tavilyQuery,
    },
  };
}

function sourceForPage(
  pageUrl: string,
  portals: Source[],
): Source | undefined {
  const parsed = new URL(pageUrl);
  for (const portal of portals) {
    const portalUrl = new URL(portal.url);
    if (portalUrl.host !== parsed.host) continue;
    const portalPath = portalUrl.pathname.replace(/\/$/, "");
    if (parsed.pathname === portalPath || parsed.pathname.startsWith(`${portalPath}/`)) {
      return portal;
    }
  }
  return undefined;
}
