import Foundation
import ClerkKit

private struct NegotiationListResponse: Decodable {
    let ok: Bool
    let negotiations: [NegotiationSummary]?
}

private struct NegotiationDetailResponse: Decodable {
    let ok: Bool
    let detail: NegotiationDetail?
    let error: String?
}

private struct NegotiationStartResponse: Decodable {
    let ok: Bool
    let detail: NegotiationDetail?
}

private struct NegotiationRespondResponse: Decodable {
    let ok: Bool
    let detail: NegotiationDetail?
    let error: String?
}

/// Talks to `/api/negotiations` on the same Next.js backend as the web dashboard.
@MainActor
@Observable
final class NegotiationClient {
    var items: [NegotiationSummary] = []
    var isLoading = false
    var errorMessage: String?

    private let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = AppConfig.apiBaseURL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.waitsForConnectivity = true
        self.session = URLSession(configuration: config)
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            var request = URLRequest(url: baseURL.appending(path: "api/negotiations"))
            await request.applyAuth()
            let (data, response) = try await session.data(for: request)
            try Self.ensureOK(response)
            let payload = try RadarClient.decoder.decode(NegotiationListResponse.self, from: data)
            items = payload.negotiations ?? []
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadDetail(id: String) async throws -> NegotiationDetail {
        var request = URLRequest(url: baseURL.appending(path: "api/negotiations/\(id)"))
        await request.applyAuth()
        let (data, response) = try await session.data(for: request)
        try Self.ensureOK(response)
        let payload = try RadarClient.decoder.decode(NegotiationDetailResponse.self, from: data)
        guard payload.ok, let detail = payload.detail else {
            throw NegotiationClientError.api(payload.error ?? "failed to load negotiation")
        }
        return detail
    }

    func start(approvalId: String) async {
        do {
            var request = URLRequest(url: baseURL.appending(path: "api/negotiations/start"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            await request.applyAuth()
            request.httpBody = try JSONEncoder().encode(["approvalId": approvalId])
            let (data, response) = try await session.data(for: request)
            try Self.ensureOK(response)
            _ = try RadarClient.decoder.decode(NegotiationStartResponse.self, from: data)
            await refresh()
        } catch {
            // Best-effort: negotiation may already exist for this approval.
            print("[negotiations] start failed:", error.localizedDescription)
        }
    }

    func respond(
        negotiationId: String,
        optionId: String,
        adjustedParameters: [String: String]
    ) async throws -> NegotiationDetail {
        var request = URLRequest(url: baseURL.appending(path: "api/negotiations/\(negotiationId)/respond"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await request.applyAuth()
        let body: [String: Any] = [
            "optionId": optionId,
            "adjustedParameters": adjustedParameters,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await session.data(for: request)
        try Self.ensureOK(response)
        let payload = try RadarClient.decoder.decode(NegotiationRespondResponse.self, from: data)
        guard payload.ok, let detail = payload.detail else {
            throw NegotiationClientError.api(payload.error ?? "respond failed")
        }
        await refresh()
        return detail
    }

    func respondWithIntent(
        negotiationId: String,
        intent: NegotiationIntent
    ) async throws -> NegotiationDetail {
        guard intent == .accept || intent == .deny else {
            throw NegotiationClientError.api("intent must be accept or deny")
        }
        var request = URLRequest(url: baseURL.appending(path: "api/negotiations/\(negotiationId)/respond"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        await request.applyAuth()
        request.httpBody = try JSONEncoder().encode(["intent": intent.rawValue])
        let (data, response) = try await session.data(for: request)
        try Self.ensureOK(response)
        let payload = try RadarClient.decoder.decode(NegotiationRespondResponse.self, from: data)
        guard payload.ok, let detail = payload.detail else {
            throw NegotiationClientError.api(payload.error ?? "respond failed")
        }
        await refresh()
        return detail
    }

    func reset() async {
        do {
            var request = URLRequest(url: baseURL.appending(path: "api/negotiations/reset"))
            request.httpMethod = "POST"
            await request.applyAuth()
            let (_, response) = try await session.data(for: request)
            try Self.ensureOK(response)
            items = []
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func ensureOK(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw RadarError.badStatus(http.statusCode)
        }
    }
}

enum NegotiationClientError: LocalizedError {
    case api(String)

    var errorDescription: String? {
        switch self {
        case .api(let message): return message
        }
    }
}
