import Foundation

// MARK: - Core snapshot

/// Mirrors src/lib/radar-types.ts so the iOS app decodes the same `/api/radar`
/// payload the Next.js dashboard consumes.
struct RadarSnapshot: Codable {
    var scoutRun: ScoutRun
    var sources: [Source]
    var findings: [Finding]
    var extractions: [Extraction]
    var scores: [ModelScore]
    var geminiAnalyses: [GeminiAnalysis]
    var opportunities: [Opportunity]
    var approvals: [ApprovalRequest]
    var events: [AgentEvent]
    var cascade: CascadeInfo?
    var integrations: IntegrationStatus?
}

struct CascadeInfo: Codable {
    let extraction: String
    let scoring: String
    let reasoning: String
    let geminiGate: String
}

struct IntegrationStatus: Codable {
    let mode: String
    let clerk: Bool
    let database: Bool
    let tavily: Bool
    let pioneerGliner: Bool
    let pioneerGemma: Bool
    let gemini: Bool
    let missing: [String]?
}

// MARK: - Scout run

struct ScoutRun: Codable {
    let id: String
    let mode: String
    let startedAt: String
    let finishedAt: String?
    let status: String
    let sourcesScanned: Int
    let findingsDiscovered: Int
}

// MARK: - Sources

enum SourceStatus: String, Codable {
    case healthy, degraded, blocked
}

enum SourceType: String, Codable {
    case publicTenderPortal = "public_tender_portal"
    case procurementPage = "procurement_page"
    case councilProjectPage = "council_project_page"
    case curatedDemoFeed = "curated_demo_feed"
    case tavilySearch = "tavily_search"
}

struct Source: Codable, Identifiable {
    let id: String
    let name: String
    let type: SourceType
    let url: String
    let geography: String
    let cadence: String
    let status: SourceStatus
    let lastCheckedAt: String
    let findingsToday: Int
}

// MARK: - Findings + extractions

enum FindingStage: String, Codable {
    case raw, extracted, scored, qualified, ignored
}

struct Finding: Codable, Identifiable, Hashable {
    let id: String
    let sourceId: String
    let sourceName: String
    let sourceType: SourceType
    let title: String
    let url: String
    let rawText: String
    let detectedLanguage: String
    let publishedAt: String
    let stage: FindingStage
}

enum ProcurementClue: String, Codable, CaseIterable {
    case budgetApproved = "budget_approved"
    case supplierCall = "supplier_call"
    case preAnnouncement = "pre_announcement"
    case officialTender = "official_tender"
    case deadlineNear = "deadline_near"
    case loginRequired = "login_required"
    case eventNotice = "event_notice"
    case duplicate
    case expired

    var isUrgent: Bool {
        switch self {
        case .deadlineNear, .loginRequired, .officialTender: return true
        default: return false
        }
    }
}

struct EntitySpan: Codable {
    let label: String
    let text: String
    let start: Int
    let end: Int
}

struct ExtractedEntities: Codable {
    let buyerIssuer: String?
    let projectName: String?
    let category: String?
    let location: String?
    let deadline: String?
    let budgetValue: String?
    let contactPersona: String?
}

struct Extraction: Codable, Identifiable {
    let id: String
    let findingId: String
    let model: String
    let confidence: Double
    let entities: ExtractedEntities
    let clueTags: [ProcurementClue]
    let spans: [EntitySpan]
}

// MARK: - Scores + Gemini

enum Urgency: String, Codable {
    case low, medium, high
}

enum RouteDecision: String, Codable {
    case ignore, monitor, qualify
    case humanReview = "human_review"
}

struct ModelScore: Codable, Identifiable {
    let id: String
    let findingId: String
    let model: String
    let worthOutreachScore: Int
    let urgency: Urgency
    let route: RouteDecision
    let rationale: String
}

struct GeminiAnalysis: Codable, Identifiable {
    let id: String
    let findingId: String
    let model: String
    let summary: String
    let risks: [String]
    let recommendedNextSteps: [String]
    let blocker: String?
}

// MARK: - Opportunities + approvals

enum OpportunityStatus: String, Codable {
    case new = "new"
    case blocked
    case readyForOutreach = "ready_for_outreach"
    case monitoring
}

struct Opportunity: Codable, Identifiable {
    let id: String
    let findingId: String
    let title: String
    let buyer: String
    let owner: String
    let valueBand: String
    let deadline: String
    let nextAction: String
    let status: OpportunityStatus
}

enum ApprovalStatus: String, Codable {
    case pending, approved
    case needsInfo = "needs_info"
}

struct ApprovalRequest: Codable, Identifiable {
    let id: String
    let findingId: String
    let opportunityId: String
    let title: String
    let requester: String
    let blocker: String
    let requestedAction: String
    let dueAt: String
    var status: ApprovalStatus
    let alertEligible: Bool
}

// MARK: - Agent events

enum AgentEventType: String, Codable {
    case scoutStarted = "scout_started"
    case findingDiscovered = "finding_discovered"
    case entitiesExtracted = "entities_extracted"
    case findingScored = "finding_scored"
    case geminiAnalysis = "gemini_analysis"
    case approvalRequested = "approval_requested"
    case opportunityCreated = "opportunity_created"
    case findingIgnored = "finding_ignored"
}

struct AgentEvent: Codable, Identifiable, Hashable {
    let id: String
    let at: String
    let role: String
    let type: AgentEventType
    let title: String
    let detail: String
    let findingId: String?
}

// MARK: - Run scout response

struct ScoutRunResponse: Codable {
    let run: ScoutRun
    let summary: ScoutSummary
    let source: String
    let warnings: [String]?
    let snapshot: RadarSnapshot
}

struct ScoutSummary: Codable {
    let sourcesScanned: Int
    let rawFindings: Int
    let extractedFindings: Int
    let qualifiedOpportunities: Int
    let pendingApprovals: Int
    let syntheticTrainingExamples: Int
}
