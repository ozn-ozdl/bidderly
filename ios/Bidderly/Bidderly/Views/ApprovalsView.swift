import SwiftUI

struct ApprovalsView: View {
    @Environment(RadarClient.self) private var radar

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snapshot = radar.snapshot {
                    let pending = radar.pendingApprovals()
                    let decided = snapshot.approvals
                        .filter { radar.approvalOverrides[$0.id] != nil && radar.approvalOverrides[$0.id] != .pending }

                    LazyVStack(spacing: 12) {
                        if pending.isEmpty {
                            EmptyStateView(
                                icon: "checkmark.seal.fill",
                                title: "Inbox zero",
                                message: "No approval requests are waiting on you. Critical events trigger an alarm."
                            )
                        } else {
                            ForEach(pending) { approval in
                                ApprovalCard(approval: approval)
                                    .padding(.horizontal)
                            }
                        }
                        if !decided.isEmpty {
                            Section {
                                ForEach(decided) { approval in
                                    ApprovalCard(approval: approval)
                                        .padding(.horizontal)
                                }
                            } header: {
                                Text("Recently decided").font(.subheadline.weight(.semibold)).foregroundStyle(AppTheme.slateMuted)
                                    .padding(.horizontal).padding(.top)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .background(AppTheme.slateBackground)
            .navigationTitle("Approvals")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

struct ApprovalCard: View {
    @Environment(RadarClient.self) private var radar
    let approval: ApprovalRequest

    var status: ApprovalStatus {
        radar.approvalOverrides[approval.id] ?? approval.status
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Human escalation", systemImage: "person.crop.circle.badge.exclamationmark")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.slateMuted)
                Spacer()
                ApprovalStatusBadge(status: status)
            }
            Text(approval.title)
                .font(.headline)
                .foregroundStyle(AppTheme.slateInk)
            Text(approval.blocker)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.amberAlert)
            Text(approval.requestedAction)
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateMuted)
                .fixedSize(horizontal: false, vertical: true)

            if let due = ISO8601DateFormatter().date(from: approval.dueAt) {
                HStack(spacing: 4) {
                    Image(systemName: "clock.fill").foregroundStyle(AppTheme.amberAlert)
                    Text("Due \(due.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.amberAlert)
                }
            }

            if status == .pending {
                HStack(spacing: 10) {
                    Button {
                        radar.update(approvalId: approval.id, status: .approved)
                    } label: {
                        Label("Approve", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(AppTheme.slateInk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .foregroundStyle(.white)
                            .font(.subheadline.weight(.semibold))
                    }
                    Button {
                        radar.update(approvalId: approval.id, status: .needsInfo)
                    } label: {
                        Label("Request info", systemImage: "questionmark.circle")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.gray.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .foregroundStyle(AppTheme.slateInk)
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(status == .pending ? AppTheme.amberAlert.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}

struct ApprovalRow: View {
    let approval: ApprovalRequest

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(approval.title).font(.subheadline.weight(.semibold)).foregroundStyle(AppTheme.slateInk)
            Text(approval.blocker).font(.caption).foregroundStyle(AppTheme.slateMuted).lineLimit(2)
            if let due = ISO8601DateFormatter().date(from: approval.dueAt) {
                Text("Due \(due.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(AppTheme.amberAlert)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.amberAlert.opacity(0.07), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
