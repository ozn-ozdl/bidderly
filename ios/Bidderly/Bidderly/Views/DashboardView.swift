import SwiftUI
import ClerkKit

struct DashboardView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(UserStateStore.self) private var userState
    @Environment(RealtimeClient.self) private var realtime
    @Environment(Clerk.self) private var clerk

    /// Switches the parent tab to the Approvals queue. The glance answers
    /// "what needs me?" and hands off the action to the dedicated queue.
    let onOpenApprovals: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snapshot = radar.snapshot {
                    VStack(spacing: 16) {
                        GlanceHero(
                            pendingCount: radar.pendingApprovals().count,
                            onOpenApprovals: onOpenApprovals
                        )
                        GlancePipeline(snapshot: snapshot)
                        TenderMapCard(snapshot: snapshot)
                        GlanceHealth(snapshot: snapshot)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                } else if let error = radar.errorMessage {
                    ErrorCard(message: error, onRetry: { Task { await radar.refresh() } })
                        .padding()
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 240)
                }
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
}

// MARK: - Hero

/// "N approvals need your decision" with a single primary CTA. This is the
/// only thing the glance is about: orient the user, hand off the action.
private struct GlanceHero: View {
    let pendingCount: Int
    let onOpenApprovals: () -> Void

    var body: some View {
        let isClear = pendingCount == 0
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: isClear ? "checkmark.seal.fill" : "bell.badge.fill")
                    .font(.title2)
                    .foregroundStyle(isClear ? AppTheme.success : AppTheme.amberAlert)
                Text(isClear ? "Inbox zero" : "\(pendingCount) approval\(pendingCount == 1 ? "" : "s") need your decision")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(AppTheme.slateInk)
            }
            Text(isClear
                 ? "The cascade is working through the queue. You'll be alerted when something needs you."
                 : "The cascade is blocked until you decide. Tap to review each request.")
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateMuted)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                onOpenApprovals()
            } label: {
                HStack {
                    Text(isClear ? "Open approvals" : "Review \(pendingCount) approval\(pendingCount == 1 ? "" : "s")")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.subheadline.weight(.semibold))
                .padding(.vertical, 12)
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity)
                .background(isClear ? AppTheme.deepTeal : AppTheme.amberAlert, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .foregroundStyle(.white)
            }
        }
        .cardStyle()
    }
}

// MARK: - Pipeline

/// "How many potential tenders were scanned and processed" — the
/// Pioneer cascade in one horizontally scrollable row.
private struct GlancePipeline: View {
    let snapshot: RadarSnapshot

    private var stages: [(String, Int)] {
        [
            ("Scanned", snapshot.scoutRun.sourcesScanned),
            ("Discovered", snapshot.findings.count),
            ("Structured", snapshot.extractions.count),
            ("Scored", snapshot.scores.count),
            ("Qualified", snapshot.opportunities.count),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Pipeline", systemImage: "shield.checkered")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(snapshot.scoutRun.id)
                    .font(.caption2.monospaced())
                    .foregroundStyle(AppTheme.slateMuted)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(stages.enumerated()), id: \.offset) { index, stage in
                        stageCell(name: stage.0, value: stage.1)
                        if index < stages.count - 1 {
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundStyle(AppTheme.slateMuted)
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .cardStyle()
    }

    private func stageCell(name: String, value: Int) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(AppTheme.slateInk)
            Text(name)
                .font(.caption2)
                .foregroundStyle(AppTheme.slateMuted)
        }
        .frame(minWidth: 56)
    }
}

// MARK: - Health

/// Single line: are the models answering, and when did the last run finish.
private struct GlanceHealth: View {
    let snapshot: RadarSnapshot

    private var degradedSources: Int {
        snapshot.sources.filter { $0.status != .healthy }.count
    }

    private var statusColor: Color {
        degradedSources == 0 ? AppTheme.success : AppTheme.amberAlert
    }

    private var statusText: String {
        degradedSources == 0
            ? "All models responding"
            : "\(degradedSources) source\(degradedSources == 1 ? "" : "s") degraded"
    }

    private var lastRunText: String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: snapshot.scoutRun.startedAt) {
            return "Last run " + date.formatted(date: .omitted, time: .shortened)
        }
        return "Last run " + snapshot.scoutRun.id
    }

    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(statusColor).frame(width: 8, height: 8)
            Text(statusText)
                .font(.caption)
                .foregroundStyle(AppTheme.slateMuted)
            Spacer()
            Text(lastRunText)
                .font(.caption.monospaced())
                .foregroundStyle(AppTheme.slateMuted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Routing

enum NavRoute: Hashable {
    case approvals
    case opportunity
    case activity
    case finding(String)
}

#if DEBUG
#Preview("Dashboard · signed out (fallback identity)") {
    DashboardView(onOpenApprovals: {})
        .environment(PreviewSupport.previewClerk())
        .previewEnvironments()
}

#Preview("Dashboard · inbox zero (no pending)") {
    DashboardView(onOpenApprovals: {})
        .environment(PreviewSupport.previewClerk())
        .environment(PreviewSupport.makeRadarClient(
            snapshot: RadarSnapshot.inboxZero(PreviewSupport.snapshot)
        ))
        .previewEnvironments()
}
#endif
