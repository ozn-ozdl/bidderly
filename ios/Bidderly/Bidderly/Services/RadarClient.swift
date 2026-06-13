import Foundation

/// Live radar API client. Talks to the same Next.js backend the web dashboard uses
/// (`/api/radar`, `/api/scout-run`). The base URL is configured in `AppConfig`.
@MainActor
@Observable
final class RadarClient {
    var snapshot: RadarSnapshot?
    var isRefreshing = false
    var isRunningScout = false
    var errorMessage: String?

    /// Locally mutated approval statuses the user has acted on (keyed by approval id).
    /// Keeps the UI optimistic until the next snapshot refresh.
    var approvalOverrides: [String: ApprovalStatus] = [:]

    /// Events observed in this session, newest first. Seeded from the snapshot.
    var liveEvents: [AgentEvent] = []

    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL) {
        self.baseURL = baseURL
        self.session = URLSession(configuration: .radar)
    }

    // MARK: - Reads

    func refresh() async {
        guard !isRefreshing else { return }
        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let url = baseURL.appending(path: "api/radar")
            var request = URLRequest(url: url)
            request.applyAuth()
            let (data, response) = try await session.data(for: request)
            try Self.ensureOK(response)
            let decoded = try Self.decoder.decode(RadarSnapshot.self, from: data)
            apply(decoded)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @discardableResult
    func runScout() async -> Bool {
        if isRunningScout { return false }
        isRunningScout = true
        defer { isRunningScout = false }

        do {
            var request = URLRequest(url: baseURL.appending(path: "api/scout-run"))
            request.httpMethod = "POST"
            request.applyAuth()
            let (data, response) = try await session.data(for: request)
            try Self.ensureOK(response)
            let result = try Self.decoder.decode(ScoutRunResponse.self, from: data)
            apply(result.snapshot)
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func update(approvalId: String, status: ApprovalStatus) {
        approvalOverrides[approvalId] = status
    }

    func pendingApprovals() -> [ApprovalRequest] {
        guard let snapshot else { return [] }
        return snapshot.approvals
            .filter { (approvalOverrides[$0.id] ?? $0.status) == .pending }
            .sorted { $0.dueAt < $1.dueAt }
    }

    func bundle(forFinding id: String) -> FindingBundle? {
        guard let snapshot else { return nil }
        guard let finding = snapshot.findings.first(where: { $0.id == id }) else { return nil }
        return FindingBundle(
            finding: finding,
            extraction: snapshot.extractions.first { $0.findingId == id },
            score: snapshot.scores.first { $0.findingId == id },
            gemini: snapshot.geminiAnalyses.first { $0.findingId == id },
            opportunity: snapshot.opportunities.first { $0.findingId == id },
            approval: snapshot.approvals.first { $0.findingId == id }
        )
    }

    // MARK: - Internals

    private func apply(_ next: RadarSnapshot) {
        var next = next
        // Preserve user-side approval decisions across refreshes.
        for index in next.approvals.indices {
            let approval = next.approvals[index]
            if let override = approvalOverrides[approval.id] {
                next.approvals[index].status = override
            } else {
                approvalOverrides[approval.id] = approval.status
            }
        }
        let nextEvents = next.events
        liveEvents = (liveEvents + nextEvents)
            .deduplicated(by: \.id)
            .sorted { $0.at > $1.at }
        snapshot = next
    }

    private static func ensureOK(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw RadarError.badStatus(http.statusCode)
        }
    }

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()
}

// MARK: - Bundle

struct FindingBundle {
    let finding: Finding
    let extraction: Extraction?
    let score: ModelScore?
    let gemini: GeminiAnalysis?
    let opportunity: Opportunity?
    let approval: ApprovalRequest?
}

// MARK: - Errors

enum RadarError: LocalizedError {
    case badStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badStatus(let code): return "Server returned status \(code)."
        }
    }
}

// MARK: - URLRequest helpers

extension URLRequest {
    mutating func applyAuth() {
        if let token = AppConfig.bearerToken, !token.isEmpty {
            setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }
}

// MARK: - URL session

private extension URLSessionConfiguration {
    static var radar: URLSessionConfiguration {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.waitsForConnectivity = true
        return config
    }
}

private extension Sequence {
    func deduplicated(by keyExtractor: (Element) -> some Hashable) -> [Element] {
        var seen = Set<String>()
        var result: [Element] = []
        for element in self {
            let key = String(describing: keyExtractor(element))
            if seen.insert(key).inserted {
                result.append(element)
            }
        }
        return result
    }
}
