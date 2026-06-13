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
import type {
  AgentEvent,
  ApprovalRequest,
  GeminiAnalysis,
  ModelScore,
  Opportunity,
  RadarSnapshot,
  ScoutRun,
} from "./radar-types";

export async function buildRadarSnapshot() {
  return getRadarSnapshot();
}

export async function runScoutPipeline(): Promise<{
  snapshot: RadarSnapshot;
  source: "fixture" | "live";
  warnings: string[];
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
  const findings = await searchTenderSignals();
  const scoutRun: ScoutRun = {
    id: `run_live_${startedAt.getTime()}`,
    mode: "scheduled",
    startedAt: startedAt.toISOString(),
    status: "running",
    sourcesScanned: 1,
    findingsDiscovered: findings.length,
  };
  const events: AgentEvent[] = [
    {
      id: `evt_${scoutRun.id}_started`,
      at: scoutRun.startedAt,
      role: "research_scout",
      type: "scout_started",
      title: "Live scout run started",
      detail: "Searching current German/EU procurement signals with Tavily.",
    },
  ];

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
        title: "GLiNER2 extraction complete",
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
        title: "Gemma 4 route assigned",
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
    scoutRun: {
      ...scoutRun,
      finishedAt,
      status: "completed",
    },
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

  // Preserve the known demo approvals when live models do not escalate anything yet.
  if (snapshot.approvals.length === 0) {
    snapshot.approvals = fixtureApprovals;
  }

  return { snapshot, source: "live", warnings };
}
