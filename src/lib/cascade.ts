import type {
  ApprovalRequest,
  Extraction,
  Finding,
  GeminiAnalysis,
  ModelScore,
  RadarSnapshot,
  RouteDecision,
  Urgency,
} from "./radar-types";

export function shouldCallGemini(
  score: Pick<ModelScore, "worthOutreachScore" | "route" | "urgency">,
  approval?: Pick<ApprovalRequest, "blocker">,
) {
  return (
    score.worthOutreachScore >= 70 ||
    score.route === "human_review" ||
    score.urgency === "high" ||
    Boolean(approval?.blocker)
  );
}

export function routeFinding(score: number, urgency: Urgency): RouteDecision {
  if (score >= 85 || urgency === "high") {
    return "human_review";
  }

  if (score >= 60) {
    return "qualify";
  }

  if (score >= 35) {
    return "monitor";
  }

  return "ignore";
}

export function getFindingBundle(snapshot: RadarSnapshot, findingId: string) {
  const finding = snapshot.findings.find((item) => item.id === findingId);

  if (!finding) {
    return null;
  }

  return {
    finding,
    extraction: snapshot.extractions.find((item) => item.findingId === findingId),
    score: snapshot.scores.find((item) => item.findingId === findingId),
    gemini: snapshot.geminiAnalyses.find((item) => item.findingId === findingId),
    opportunity: snapshot.opportunities.find((item) => item.findingId === findingId),
    approval: snapshot.approvals.find((item) => item.findingId === findingId),
  };
}

export function validateCascadeGate(snapshot: RadarSnapshot) {
  return snapshot.geminiAnalyses.every((analysis) => {
    const score = snapshot.scores.find((item) => item.findingId === analysis.findingId);
    const approval = snapshot.approvals.find(
      (item) => item.findingId === analysis.findingId,
    );

    return score ? shouldCallGemini(score, approval) : false;
  });
}

export function getExtractionForFinding(
  extractions: Extraction[],
  finding: Finding,
) {
  return extractions.find((extraction) => extraction.findingId === finding.id);
}

export function getScoreForFinding(scores: ModelScore[], finding: Finding) {
  return scores.find((score) => score.findingId === finding.id);
}

export function getGeminiForFinding(
  analyses: GeminiAnalysis[],
  finding: Finding,
) {
  return analyses.find((analysis) => analysis.findingId === finding.id);
}
