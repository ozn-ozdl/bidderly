import SwiftUI
import ClerkKit

struct DashboardView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(UserStateStore.self) private var userState
    @Environment(RealtimeClient.self) private var realtime
    @Environment(Clerk.self) private var clerk

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let snapshot = radar.snapshot {
                        headerCard(snapshot: snapshot)
                        metricsGrid(snapshot: snapshot)
                        pendingApprovalsPreview
                        topOpportunitiesPreview(snapshot: snapshot)
                        recentActivityPreview(snapshot: snapshot)
                    } else if let error = radar.errorMessage {
                        ErrorCard(message: error, onRetry: { Task { await radar.refresh() } })
                            .padding(.horizontal)
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 240)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .background(AppTheme.slateBackground)
            .navigationTitle("Opportunity Radar")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await radar.runScout() }
                    } label: {
                        Label("Run scout", systemImage: radar.isRunningScout ? "hourglass" : "play.fill")
                    }
                    .disabled(radar.isRunningScout)
                }
            }
        }
    }

    // MARK: - Subviews

    private func headerCard(snapshot: RadarSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(AppTheme.gradient).frame(width: 44, height: 44)
                    Image(systemName: "dot.radiowaves.left.and.right").foregroundStyle(.white).bold()
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("Live radar feed").font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(AppTheme.teal)
                    Text(cascadeLabel(snapshot.cascade))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppTheme.slateInk)
                }
                Spacer()
                Text(snapshot.integrations?.mode.replacingOccurrences(of: "-", with: " ").uppercased() ?? "FIXTURE")
                    .font(.system(size: 10, weight: .bold))
                    .monospaced()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(AppTheme.teal.opacity(0.15))
                    .foregroundStyle(AppTheme.deepTeal)
                    .clipShape(Capsule())
            }

            Divider()

            HStack(spacing: 6) {
                Image(systemName: "person.circle.fill")
                    .foregroundStyle(AppTheme.teal)
                Text(clerk.user?.firstName ?? clerk.user?.primaryEmailAddress?.emailAddress ?? "Signed in")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(AppTheme.slateInk)
                Spacer()
                Text(snapshot.scoutRun.status.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .monospaced()
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(AppTheme.success.opacity(0.15))
                    .foregroundStyle(AppTheme.success)
                    .clipShape(Capsule())
            }
        }
        .cardStyle()
    }

    private func metricsGrid(snapshot: RadarSnapshot) -> some View {
        let pendingCount = radar.pendingApprovals().count
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            MetricTile(icon: "globe", title: "Sources scanned", value: "\(snapshot.scoutRun.sourcesScanned)", tint: AppTheme.teal)
            MetricTile(icon: "doc.text.magnifyingglass", title: "Findings discovered", value: "\(snapshot.scoutRun.findingsDiscovered)", tint: AppTheme.deepTeal)
            MetricTile(icon: "gauge.with.dots.needle.50percent", title: "Qualified opportunities", value: "\(snapshot.opportunities.count)", tint: AppTheme.success)
            MetricTile(icon: "bell.badge", title: "Pending decisions", value: "\(pendingCount)", tint: pendingCount > 0 ? AppTheme.amberAlert : Color.gray)
        }
    }

    private var pendingApprovalsPreview: some View {
        let pending = radar.pendingApprovals()
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Pending approvals", systemImage: "bell.badge")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                NavigationLink(value: NavRoute.approvals) {
                    Text("See all").font(.subheadline.weight(.semibold))
                }
            }
            if pending.isEmpty {
                Text("No decisions pending. Low-score findings are auto-suppressed.")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.slateMuted)
                    .padding(.vertical, 6)
            } else {
                ForEach(pending.prefix(2)) { approval in
                    NavigationLink(value: NavRoute.finding(approval.findingId)) {
                        ApprovalRow(approval: approval)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .cardStyle()
    }

    private func topOpportunitiesPreview(snapshot: RadarSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Top opportunities", systemImage: "gauge.with.dots.needle.50percent")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                NavigationLink(value: NavRoute.opportunities) {
                    Text("See all").font(.subheadline.weight(.semibold))
                }
            }
            ForEach(snapshot.opportunities.prefix(3)) { opportunity in
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
        .cardStyle()
    }

    private func recentActivityPreview(snapshot: RadarSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Recent activity", systemImage: "clock.arrow.circlepath")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                NavigationLink(value: NavRoute.activity) {
                    Text("Full timeline").font(.subheadline.weight(.semibold))
                }
            }
            ForEach(Array(radar.liveEvents.prefix(4))) { evt in
                ActivityRow(event: evt)
            }
        }
        .cardStyle()
    }

    private func cascadeLabel(_ cascade: CascadeInfo?) -> String {
        guard let cascade else { return "Cascade: GLiNER2 → Gemma 4 → Gemini" }
        return [cascade.extraction, cascade.scoring, cascade.reasoning]
            .map { $0.components(separatedBy: " ").first ?? $0 }
            .joined(separator: " → ")
    }
}

// MARK: - Routing

enum NavRoute: Hashable {
    case approvals
    case oportunidades
    case activity
    case finding(String)
}

#if DEBUG
#Preview("Dashboard · signed out (fallback identity)") {
    DashboardView()
        .environment(PreviewSupport.previewClerk())
        .previewEnvironments()
}
#endif
