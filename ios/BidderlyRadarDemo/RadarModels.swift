import Foundation

struct RadarSnapshot: Decodable {
    let scoutRun: ScoutRun
    let findings: [Finding]
    let opportunities: [Opportunity]
    let approvals: [ApprovalRequest]
}

struct ScoutRun: Decodable {
    let id: String
    let status: String
    let sourcesScanned: Int
    let findingsDiscovered: Int
}

struct Finding: Decodable, Identifiable {
    let id: String
    let title: String
    let sourceName: String
    let publishedAt: String
    let stage: String
}

struct Opportunity: Decodable, Identifiable {
    let id: String
    let findingId: String
    let title: String
    let buyer: String
    let owner: String
    let valueBand: String
    let deadline: String
    let nextAction: String
    let status: String
}

struct ApprovalRequest: Decodable, Identifiable {
    let id: String
    let findingId: String
    let opportunityId: String
    let title: String
    let blocker: String
    let requestedAction: String
    let dueAt: String
    let status: String
    let alertEligible: Bool
}
