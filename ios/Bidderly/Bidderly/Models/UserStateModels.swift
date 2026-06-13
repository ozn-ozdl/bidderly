import Foundation

struct UserStatePayload: Codable {
    var approvals: [UserApproval] = []
    var watchlist: [UserWatchlistEntry] = []
    var dismissals: [UserDismissal] = []
    var read: [UserReadState] = []
}

struct UserApproval: Codable, Identifiable {
    var id: String { findingId }
    let findingId: String
    let status: ApprovalStatus
    let note: String?
    let updatedAt: String
}

struct UserWatchlistEntry: Codable, Identifiable {
    var id: String { findingId }
    let findingId: String
    let addedAt: String
}

struct UserDismissal: Codable, Identifiable {
    var id: String { findingId }
    let findingId: String
    let dismissedAt: String
}

struct UserReadState: Codable, Identifiable {
    var id: String { findingId }
    let findingId: String
    let readAt: String
}

struct UserStatePatch: Codable {
    enum Kind: String, Codable {
        case approval
        case watchlist
        case dismissal
        case read
        case reset
    }

    let kind: Kind
    let findingId: String?
    let status: ApprovalStatus?
    let note: String?
    let updatedAt: String?
    let added: Bool?
    let dismissed: Bool?
    let at: String?
}

@MainActor
@Observable
final class UserStateStore {
    var state = UserStatePayload()

    func apply(_ next: UserStatePayload) {
        state = next
    }

    func apply(_ patch: UserStatePatch) {
        switch patch.kind {
        case .reset:
            state = UserStatePayload()
        case .approval:
            guard let findingId = patch.findingId, let status = patch.status else { return }
            state.approvals.removeAll { $0.findingId == findingId }
            state.approvals.append(
                UserApproval(
                    findingId: findingId,
                    status: status,
                    note: patch.note,
                    updatedAt: patch.updatedAt ?? Self.now()
                )
            )
        case .watchlist:
            guard let findingId = patch.findingId else { return }
            state.watchlist.removeAll { $0.findingId == findingId }
            if patch.added == true {
                state.watchlist.append(
                    UserWatchlistEntry(findingId: findingId, addedAt: patch.at ?? Self.now())
                )
            }
        case .dismissal:
            guard let findingId = patch.findingId else { return }
            state.dismissals.removeAll { $0.findingId == findingId }
            if patch.dismissed == true {
                state.dismissals.append(
                    UserDismissal(findingId: findingId, dismissedAt: patch.at ?? Self.now())
                )
            }
        case .read:
            guard let findingId = patch.findingId else { return }
            state.read.removeAll { $0.findingId == findingId }
            state.read.append(UserReadState(findingId: findingId, readAt: patch.at ?? Self.now()))
        }
    }

    func status(for approval: ApprovalRequest) -> ApprovalStatus {
        state.approvals.first { $0.findingId == approval.findingId }?.status ?? approval.status
    }

    func hasApproval(for approval: ApprovalRequest) -> Bool {
        state.approvals.contains { $0.findingId == approval.findingId }
    }

    func clearApprovals() {
        state.approvals.removeAll()
    }

    func clearDismissals() {
        state.dismissals.removeAll()
    }

    func isWatched(findingId: String) -> Bool {
        state.watchlist.contains { $0.findingId == findingId }
    }

    func isDismissed(findingId: String) -> Bool {
        state.dismissals.contains { $0.findingId == findingId }
    }

    func isRead(findingId: String) -> Bool {
        state.read.contains { $0.findingId == findingId }
    }

    private static func now() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
