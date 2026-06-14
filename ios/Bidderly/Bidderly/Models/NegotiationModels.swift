import Foundation

// MARK: - Negotiation API models (mirrors src/lib/radar-types.ts)

enum NegotiationStatus: String, Codable {
    case opening
    case awaitingUser = "awaiting_user"
    case counterpartyTurn = "counterparty_turn"
    case accepted
    case denied
    case failed
}

enum NegotiationParty: String, Codable {
    case agent
    case counterparty
}

enum NegotiationIntent: String, Codable {
    case accept
    case deny
    case negotiate
}

struct NegotiationSummary: Codable, Identifiable, Hashable {
    let id: String
    let findingId: String
    let approvalId: String
    let opportunityId: String
    let status: NegotiationStatus
    let openingPrice: Double
    let currency: String
    let targetPrice: Double
    let rounds: Int
    let startedAt: String
    let lastMessageAt: String
    let endedAt: String?
    let outcome: String?
    let agreedPrice: Double?
    let title: String
    let buyer: String
}

struct TradeoffParameter: Codable, Identifiable, Hashable {
    var id: String { key }
    let key: String
    let label: String
    let kind: String
    let options: [TradeoffOption]
    let defaultValue: String

    struct TradeoffOption: Codable, Hashable {
        let value: String
        let label: String
    }
}

struct CounterpartyTradeoffOption: Codable, Identifiable, Hashable {
    let id: String
    let roundIndex: Int
    let title: String
    let summary: String
    let parameters: [TradeoffParameter]
}

enum TermMovement: String, Codable, Hashable {
    case agentProposed = "agent_proposed"
    case buyerProposed = "buyer_proposed"
    case buyerPressing = "buyer_pressing"
    case agentConceding = "agent_conceding"
    case aligned
    case diverging
}

struct ParsedNegotiationOffer: Codable, Hashable {
    let referencedPrice: Double?
    let currency: String?
    let intent: NegotiationIntent
    let levers: [String]
    let terms: [String: String]?
    let summary: String
}

typealias ParsedCounterpartyOffer = ParsedNegotiationOffer

struct NegotiationTermField: Codable, Hashable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let agentValue: String?
    let counterpartyValue: String?
    let agentDisplay: String?
    let counterpartyDisplay: String?
    let movement: TermMovement
}

struct NegotiationOfferPoint: Codable, Hashable, Identifiable {
    var id: Int { roundIndex }
    let roundIndex: Int
    let at: String
    let agentPrice: Double?
    let counterpartyPrice: Double?
    let agentTerms: [String: String]?
    let counterpartyTerms: [String: String]?
}

struct NegotiationDashboard: Codable, Hashable {
    let offerTimeline: [NegotiationOfferPoint]
    let currentAgentOffer: Double?
    let currentCounterpartyOffer: Double?
    let latestAgentParsed: ParsedNegotiationOffer?
    let latestParsed: ParsedNegotiationOffer?
    let gapPct: Int?
    let termFields: [NegotiationTermField]
    let activeLevers: [String]
}

struct NegotiationMessage: Codable, Identifiable, Hashable {
    let id: String
    let negotiationId: String
    let roundIndex: Int
    let party: NegotiationParty
    let channel: String
    let at: String
    let price: Double?
    let currency: String?
    let text: String
    let parsedIntent: NegotiationIntent?
    let parsedOffer: ParsedNegotiationOffer?
}

struct NegotiationRecord: Codable, Identifiable, Hashable {
    let id: String
    let findingId: String
    let opportunityId: String
    let approvalId: String
    let userId: String
    let channel: String
    let status: NegotiationStatus
    let seed: Int
    let openingPrice: Double
    let currency: String
    let targetPrice: Double
    let counterpartyFloor: Double
    let rounds: Int
    let startedAt: String
    let lastMessageAt: String
    let endedAt: String?
    let outcome: String?
    let agreedPrice: Double?
}

struct NegotiationDetail: Codable {
    let negotiation: NegotiationRecord
    let messages: [NegotiationMessage]
    let pendingOptions: [CounterpartyTradeoffOption]
    let dashboard: NegotiationDashboard
    let finding: Finding
    let extraction: Extraction?
    let opportunity: Opportunity?
    let approval: ApprovalRequest
    let gemini: GeminiAnalysis?
}
