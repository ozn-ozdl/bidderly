import Foundation
import ClerkKit

@MainActor
@Observable
final class RealtimeClient {
    var isConnected = false
    var errorMessage: String?

    private let stateStore: UserStateStore
    private let baseURL: URL
    private let session: URLSession
    private var socketTask: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?

    init(
        baseURL: URL = AppConfig.realtimeBaseURL,
        stateStore: UserStateStore
    ) {
        self.baseURL = baseURL
        self.stateStore = stateStore
        self.session = URLSession(configuration: .realtime)
    }

    func connect() {
        guard socketTask == nil else { return }

        let task = session.webSocketTask(with: endpointURL)
        socketTask = task
        task.resume()

        receiveTask = Task { [weak self] in
            await self?.authenticateAndReceive()
        }
    }

    func disconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
        receiveTask?.cancel()
        receiveTask = nil
        socketTask?.cancel(with: .normalClosure, reason: nil)
        socketTask = nil
        isConnected = false
    }

    func setApproval(findingId: String, status: ApprovalStatus) {
        stateStore.apply(
            UserStatePatch(
                kind: .approval,
                findingId: findingId,
                status: status,
                note: nil,
                updatedAt: Self.now(),
                added: nil,
                dismissed: nil,
                at: nil
            )
        )
        sendMutation("approval:set", payload: ApprovalPayload(findingId: findingId, status: status))
    }

    func toggleWatch(findingId: String, add: Bool) {
        stateStore.apply(
            UserStatePatch(
                kind: .watchlist,
                findingId: findingId,
                status: nil,
                note: nil,
                updatedAt: nil,
                added: add,
                dismissed: nil,
                at: Self.now()
            )
        )
        sendMutation(add ? "watchlist:add" : "watchlist:remove", payload: FindingPayload(findingId: findingId))
    }

    func setDismissed(findingId: String, dismissed: Bool) {
        stateStore.apply(
            UserStatePatch(
                kind: .dismissal,
                findingId: findingId,
                status: nil,
                note: nil,
                updatedAt: nil,
                added: nil,
                dismissed: dismissed,
                at: Self.now()
            )
        )
        sendMutation(
            "dismissal:set",
            payload: DismissalPayload(findingId: findingId, dismissed: dismissed)
        )
    }

    func markRead(findingId: String) {
        stateStore.apply(
            UserStatePatch(
                kind: .read,
                findingId: findingId,
                status: nil,
                note: nil,
                updatedAt: nil,
                added: nil,
                dismissed: nil,
                at: Self.now()
            )
        )
        sendMutation("read:mark", payload: FindingPayload(findingId: findingId))
    }

    private var endpointURL: URL {
        if baseURL.path.isEmpty || baseURL.path == "/" {
            return baseURL.appending(path: "ws")
        }
        return baseURL
    }

    private func authenticateAndReceive() async {
        do {
            guard let token = try await Clerk.shared.auth.getToken(), !token.isEmpty else {
                throw RealtimeError.missingToken
            }

            try await send(AuthMessage(token: token))
            isConnected = true
            errorMessage = nil

            while !Task.isCancelled, let socketTask {
                let message = try await socketTask.receive()
                try handle(message)
            }
        } catch {
            isConnected = false
            socketTask = nil
            errorMessage = error.localizedDescription
            scheduleReconnect()
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) throws {
        let data: Data
        switch message {
        case .data(let payload):
            data = payload
        case .string(let payload):
            data = Data(payload.utf8)
        @unknown default:
            return
        }

        let envelope = try Self.decoder.decode(InboundEnvelope.self, from: data)
        switch envelope.type {
        case "state:snapshot":
            if let state = envelope.state {
                stateStore.apply(state)
            }
        case "state:patch":
            if let patch = envelope.patch {
                stateStore.apply(patch)
            }
        case "error":
            errorMessage = envelope.error
        default:
            break
        }
    }

    private func sendMutation<Payload: Encodable>(_ type: String, payload: Payload) {
        let message = MutationMessage(type: type, id: UUID().uuidString, payload: payload)
        Task { [weak self] in
            try? await self?.send(message)
        }
    }

    private func send<Message: Encodable>(_ message: Message) async throws {
        guard let socketTask else {
            connect()
            throw RealtimeError.disconnected
        }

        let data = try Self.encoder.encode(message)
        guard let text = String(data: data, encoding: .utf8) else {
            throw RealtimeError.encodingFailed
        }
        try await socketTask.send(.string(text))
    }

    private func scheduleReconnect() {
        guard reconnectTask == nil else { return }
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            self?.retryConnection()
        }
    }

    private func retryConnection() {
        reconnectTask = nil
        connect()
    }

    private static func now() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()
}

private struct AuthMessage: Encodable {
    let type = "auth"
    let token: String
}

private struct MutationMessage<Payload: Encodable>: Encodable {
    let type: String
    let id: String
    let payload: Payload
}

private struct ApprovalPayload: Encodable {
    let findingId: String
    let status: ApprovalStatus
}

private struct FindingPayload: Encodable {
    let findingId: String
}

private struct DismissalPayload: Encodable {
    let findingId: String
    let dismissed: Bool
}

private struct InboundEnvelope: Decodable {
    let type: String
    let state: UserStatePayload?
    let patch: UserStatePatch?
    let error: String?
}

private enum RealtimeError: LocalizedError {
    case missingToken
    case disconnected
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .missingToken: return "No Clerk session token is available."
        case .disconnected: return "Realtime connection is not open."
        case .encodingFailed: return "Could not encode realtime message."
        }
    }
}

private extension URLSessionConfiguration {
    static var realtime: URLSessionConfiguration {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 0
        config.waitsForConnectivity = true
        return config
    }
}
