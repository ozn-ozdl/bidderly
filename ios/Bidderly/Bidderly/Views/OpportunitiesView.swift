import SwiftUI

struct OpportunitiesView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(UserStateStore.self) private var userState
    @Environment(RealtimeClient.self) private var realtime

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snapshot = radar.snapshot {
                    if snapshot.opportunities.isEmpty {
                        EmptyStateView(
                            icon: "gauge.with.dots.needle.50percent",
                            title: "No qualified opportunities yet",
                            message: "Findings with a worth-outreach score of 60+ and route = qualify/human_review appear here."
                        )
                    } else {
                        let groups = OpportunityGroups(snapshot.opportunities)
                        LazyVStack(alignment: .leading, spacing: 14) {
                            if !groups.blocked.isEmpty {
                                OpportunitySection(
                                    title: "Needs a decision",
                                    hint: "Blocked on an approval. Resolve it in the Approvals tab.",
                                    opportunities: groups.blocked
                                ) { opportunity in
                                    rowLink(for: opportunity)
                                }
                            }
                            if !groups.ready.isEmpty {
                                OpportunitySection(
                                    title: "Ready for outreach",
                                    hint: "Qualified and unblocked. Act now or mark watched.",
                                    opportunities: groups.ready
                                ) { opportunity in
                                    rowLink(for: opportunity)
                                }
                            }
                            if !groups.monitoring.isEmpty {
                                OpportunitySection(
                                    title: "Monitoring",
                                    hint: "Long-tail. Worth-outreach score below the active bar.",
                                    opportunities: groups.monitoring
                                ) { opportunity in
                                    rowLink(for: opportunity)
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .background(AppTheme.slateBackground)
            .navigationTitle("Opportunities")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: NavRoute.self) { route in
                switch route {
                case .finding(let id):
                    if let bundle = radar.bundle(forFinding: id) { FindingDetailView(bundle: bundle) }
                default: EmptyView()
                }
            }
        }
    }

    @ViewBuilder
    private func rowLink(for opportunity: Opportunity) -> some View {
        let watched = userState.isWatched(findingId: opportunity.findingId)
        NavigationLink(value: NavRoute.finding(opportunity.findingId)) {
            OpportunityRow(
                opportunity: opportunity,
                watched: watched,
                onToggleWatch: {
                    realtime.toggleWatch(findingId: opportunity.findingId, add: !watched)
                }
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Grouping

/// Splits the snapshot's opportunities into the three buckets the user
/// actually thinks in: "needs me", "go now", and "watch list".
struct OpportunityGroups {
    let blocked: [Opportunity]
    let ready: [Opportunity]
    let monitoring: [Opportunity]

    init(_ opportunities: [Opportunity]) {
        self.blocked = opportunities.filter { $0.status == .blocked }
        self.ready = opportunities.filter { $0.status == .readyForOutreach || $0.status == .new }
        self.monitoring = opportunities.filter { $0.status == .monitoring }
    }
}

// MARK: - Section

private struct OpportunitySection<Content: View>: View {
    let title: String
    let hint: String
    let opportunities: [Opportunity]
    @ViewBuilder let content: (Opportunity) -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(title.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(0.6)
                    .foregroundStyle(AppTheme.slateMuted)
                Text("· \(opportunities.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.slateMuted)
                Spacer()
            }
            Text(hint)
                .font(.caption2)
                .foregroundStyle(AppTheme.slateMuted)
            VStack(spacing: 10) {
                ForEach(opportunities) { content($0) }
            }
        }
    }
}

struct OpportunityRow: View {
    let opportunity: Opportunity
    let watched: Bool
    let onToggleWatch: () -> Void

    var statusColor: Color {
        switch opportunity.status {
        case .blocked: return AppTheme.amberAlert
        case .readyForOutreach: return AppTheme.success
        case .monitoring: return AppTheme.teal
        case .new: return Color.purple
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(opportunity.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.slateInk)
                        .lineLimit(2)
                    Text(opportunity.buyer).font(.caption).foregroundStyle(AppTheme.slateMuted)
                }
                Spacer()
                Button(action: onToggleWatch) {
                    Image(systemName: watched ? "star.fill" : "star")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(watched ? AppTheme.deepTeal : AppTheme.slateMuted)
                        .padding(7)
                        .background(Color.gray.opacity(0.08), in: Circle())
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(watched ? "Remove from watchlist" : "Add to watchlist")
                Text(opportunity.status.rawValue.replacingOccurrences(of: "_", with: " ").uppercased())
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(statusColor.opacity(0.15))
                    .foregroundStyle(statusColor)
                    .clipShape(Capsule())
            }
            HStack(spacing: 12) {
                Label(opportunity.valueBand, systemImage: "eurosign.circle")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.slateInk)
                Label(opportunity.deadline, systemImage: "calendar")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.slateInk)
                Spacer()
            }
            HStack(spacing: 6) {
                Image(systemName: "arrow.up.right.square")
                    .font(.caption)
                    .foregroundStyle(AppTheme.teal)
                Text(opportunity.nextAction)
                    .font(.caption)
                    .foregroundStyle(AppTheme.teal)
                    .lineLimit(1)
            }
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}

#if DEBUG
#Preview("Opportunities · qualified + blocked") {
    OpportunitiesView()
        .previewEnvironments()
}
#endif
