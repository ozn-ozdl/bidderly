import SwiftUI

struct ApprovalsView: View {
    @Environment(RadarClient.self) private var radar

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snapshot = radar.snapshot {
                    let pending = radar.pendingApprovals()
                    let decided = snapshot.approvals
                        .filter { radar.hasUserApproval(for: $0) && radar.status(for: $0) != .pending }

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
                                Text("Recently decided").font(.subheadline.weight(.semibold)).appMuted()
                                    .padding(.horizontal).padding(.top)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .appBackground()
            .navigationTitle("Approvals")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

// MARK: - Card

/// An approval card that answers three questions in order:
/// 1. What is it? (title + due + blocker)
/// 2. What did the cascade say about it? (compact GLiNER2 / Gemma 4 / Gemini)
/// 3. What happens if I act? (consequence line + decide buttons)
struct ApprovalCard: View {
    @Environment(RadarClient.self) private var radar
    let approval: ApprovalRequest

    private var status: ApprovalStatus {
        radar.status(for: approval)
    }

    private var bundle: FindingBundle? {
        radar.bundle(forFinding: approval.findingId)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            titleBlock
            if let bundle {
                cascadeSection(bundle: bundle)
            }
            if status == .pending {
                consequenceBlock(
                    label: "If you approve",
                    icon: "arrow.right.circle.fill",
                    tint: AppTheme.success,
                    text: approval.requestedAction
                )
                actionRow
            } else {
                consequenceBlock(
                    label: status == .approved ? "Approved · agent will" : "Needs info · waiting on",
                    icon: status == .approved ? "checkmark.seal.fill" : "questionmark.circle.fill",
                    tint: status == .approved ? AppTheme.success : AppTheme.slateMuted,
                    text: approval.requestedAction
                )
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

    private var header: some View {
        HStack {
            Label("Human escalation", systemImage: "person.crop.circle.badge.exclamationmark")
                .font(.caption.weight(.semibold))
                .appMuted()
            Spacer()
            ApprovalStatusBadge(status: status)
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(approval.title)
                .font(.headline)
                .appInk()
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(AppTheme.amberAlert)
                Text(approval.blocker)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AppTheme.amberAlert)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let due = ISO8601DateFormatter().date(from: approval.dueAt) {
                HStack(spacing: 4) {
                    Image(systemName: "clock.fill").font(.caption2).foregroundStyle(AppTheme.amberAlert)
                    Text("Due \(due.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(AppTheme.amberAlert)
                }
            }
        }
    }

    /// "What the cascade found" — exactly the GLiNER2 / Gemma 4 / Gemini output
    /// for this specific approval's finding, shown as a compact 3-row list.
    @Environment(\.colorScheme) private var colorScheme

    private func cascadeSection(bundle: FindingBundle) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("What the cascade found")
                .font(.caption.weight(.semibold))
                .appMuted()
            cascadeRow(
                icon: "text.magnifyingglass",
                title: "GLiNER2",
                detail: bundle.extraction.map { extraction in
                    let parts = [extraction.entities.buyerIssuer, extraction.entities.budgetValue, extraction.entities.deadline].compactMap { $0 }
                    let tail = parts.isEmpty ? "\(Int(extraction.confidence * 100))% confidence" : parts.joined(separator: " · ")
                    return "\(Int(extraction.confidence * 100))% · \(tail)"
                } ?? "No extraction"
            )
            cascadeRow(
                icon: "gauge.with.dots.needle.50percent",
                title: "Gemma 4",
                detail: bundle.score.map { score in
                    "Score \(score.worthOutreachScore) · \(score.route.rawValue.replacingOccurrences(of: "_", with: " "))"
                } ?? "No score"
            )
            cascadeRow(
                icon: "sparkles",
                title: "Gemini",
                detail: bundle.gemini?.summary
                    ?? (bundle.score.map { $0.worthOutreachScore >= 70 ? "Expected (score ≥ 70)" : "Skipped (gate)" } ?? "Not called")
            )
        }
        .padding(10)
        .background(
            (colorScheme == .dark ? AppThemeDark.slateBackground : AppTheme.slateBackground)
                .opacity(0.5),
            in: RoundedRectangle(cornerRadius: 10, style: .continuous)
        )
    }

    private func cascadeRow(icon: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(AppTheme.deepTeal)
                .frame(width: 14)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .appMuted()
                Text(detail)
                    .font(.caption)
                    .appInk()
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func consequenceBlock(label: String, icon: String, tint: Color, text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(tint)
                Text(text)
                    .font(.subheadline)
                    .appInk()
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var actionRow: some View {
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
                Label("Need info", systemImage: "questionmark.circle")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.gray.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .appInk()
                    .font(.subheadline.weight(.semibold))
            }
        }
    }
}

// MARK: - Status badge
// `ApprovalStatusBadge` lives in Views/Components/Pills.swift.

#if DEBUG
#Preview("Approvals · pending + decided") {
    ApprovalsView()
        .previewEnvironments()
}
#endif
