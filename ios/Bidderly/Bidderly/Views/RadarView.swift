import SwiftUI

/// The combined Radar surface. One NavigationStack, one scroll, four
/// sections: the glance hero (orient + handoff), the Decide queue
/// (read-only pointers to pending approvals), Outreach + Monitoring
/// (the qualified opportunities), and All findings (the full cascade
/// trail, scored, with the always-visible search and stage filter).
struct RadarView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(UserStateStore.self) private var userState
    @Environment(RealtimeClient.self) private var realtime

    /// Switches the parent tab to the Approvals queue. The glance answers
    /// "what needs me?" and hands off the action to the dedicated queue.
    let onOpenApprovals: () -> Void

    @State private var query = ""
    @State private var stageFilter: FindingStageFilter = .all

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
                        GlanceHealth(snapshot: snapshot)

                        let pending = radar.pendingApprovals()
                        if !pending.isEmpty {
                            DecideSection(pending: pending)
                        }

                        let groups = OpportunityGroups(snapshot.opportunities)
                        if !groups.ready.isEmpty {
                            OpportunityGroupSection(
                                title: "Outreach",
                                hint: "Qualified and unblocked. Act now or mark watched.",
                                opportunities: groups.ready
                            )
                        }
                        if !groups.monitoring.isEmpty {
                            OpportunityGroupSection(
                                title: "Monitoring",
                                hint: "Long-tail. Worth-outreach score below the active bar.",
                                opportunities: groups.monitoring
                            )
                        }

                        FindingsSection(
                            findings: snapshot.findings,
                            query: $query,
                            stageFilter: $stageFilter
                        )
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
            .appBackground()
            .navigationTitle("Opportunity Radar")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: NavRoute.self) { route in
                if case .finding(let id) = route, let bundle = radar.bundle(forFinding: id) {
                    FindingDetailView(bundle: bundle)
                }
            }
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
            .refreshable {
                await radar.refresh()
            }
        }
    }
}

// MARK: - Routing

enum NavRoute: Hashable {
    case finding(String)
}

// MARK: - Grouping

/// Splits the snapshot's opportunities into the two buckets the user
/// actually thinks in: "go now" and "watch list". The blocked bucket
/// (needs approval) is intentionally absent here — the Decide section
/// owns that view via the pending-approval rows.
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

// MARK: - Section header

private struct SectionHeader: View {
    let title: String
    let count: Int
    let hint: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text(title.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(0.6)
                    .appMuted()
                Text("· \(count)")
                    .font(.caption.weight(.semibold))
                    .appMuted()
                Spacer()
            }
            Text(hint)
                .font(.caption2)
                .appMuted()
        }
    }
}

// MARK: - Hero

/// "N approvals need your decision" with a single primary CTA. This is
/// the only thing the glance is about: orient the user, hand off the
/// action. The Decide section below carries the per-approval detail.
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
                    .appInk()
            }
            Text(isClear
                 ? "The cascade is working through the queue. You'll be alerted when something needs you."
                 : "The cascade is blocked until you decide. Tap to review each request.")
                .font(.subheadline)
                .appMuted()
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
                    .appMuted()
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(stages.enumerated()), id: \.offset) { index, stage in
                        stageCell(name: stage.0, value: stage.1)
                        if index < stages.count - 1 {
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .appMuted()
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
                .appInk()
            Text(name)
                .font(.caption2)
                .appMuted()
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
                .appMuted()
            Spacer()
            Text(lastRunText)
                .font(.caption.monospaced())
                .appMuted()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Decide

/// Read-only pointers to pending approvals. Each row hands off to the
/// finding detail view, where the actual Approve / Request info buttons
/// live. The hero's CTA is the dedicated path to the Approvals queue.
private struct DecideSection: View {
    @Environment(RadarClient.self) private var radar
    let pending: [ApprovalRequest]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(
                title: "Decide",
                count: pending.count,
                hint: "Tap a card to review and decide in the finding detail."
            )
            VStack(spacing: 10) {
                ForEach(pending) { approval in
                    NavigationLink(value: NavRoute.finding(approval.findingId)) {
                        DecideRow(approval: approval, status: radar.status(for: approval))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Outreach / Monitoring

private struct OpportunityGroupSection: View {
    @Environment(UserStateStore.self) private var userState
    @Environment(RealtimeClient.self) private var realtime
    let title: String
    let hint: String
    let opportunities: [Opportunity]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: title, count: opportunities.count, hint: hint)
            VStack(spacing: 10) {
                ForEach(opportunities) { opportunity in
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
        }
    }
}

// MARK: - Findings

private struct FindingsSection: View {
    @Environment(RadarClient.self) private var radar
    let findings: [Finding]
    @Binding var query: String
    @Binding var stageFilter: FindingStageFilter

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: "All findings",
                count: findings.count,
                hint: "Every finding the cascade touched, scored high to low."
            )
            FilterBar(query: $query, stageFilter: $stageFilter)
            if findings.isEmpty {
                EmptyStateView(
                    icon: "doc.text.magnifyingglass",
                    title: "No findings yet",
                    message: "Run a scout to populate the cascade."
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(filtered) { finding in
                        NavigationLink(value: NavRoute.finding(finding.id)) {
                            FindingRow(finding: finding, bundle: radar.bundle(forFinding: finding.id))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var filtered: [Finding] {
        findings
            .filter { stageFilter.matches($0.stage) }
            .filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.sourceName.localizedCaseInsensitiveContains(query) }
            .sorted { lhs, rhs in
                let lScore = radar.bundle(forFinding: lhs.id)?.score?.worthOutreachScore ?? -1
                let rScore = radar.bundle(forFinding: rhs.id)?.score?.worthOutreachScore ?? -1
                return lScore > rScore
            }
    }
}

// MARK: - Filter bar

enum FindingStageFilter: String, CaseIterable, Identifiable {
    case all, qualified, scored, ignored
    var id: String { rawValue }

    func matches(_ stage: FindingStage) -> Bool {
        switch self {
        case .all: return true
        case .qualified: return stage == .qualified
        case .scored: return stage == .scored
        case .ignored: return stage == .ignored
        }
    }

    var label: String {
        switch self {
        case .all: return "All"
        case .qualified: return "Qualified"
        case .scored: return "Scored"
        case .ignored: return "Ignored"
        }
    }
}

private struct FilterBar: View {
    @Binding var query: String
    @Binding var stageFilter: FindingStageFilter

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Search findings or sources", text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }
                }
            }
            .padding(10)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            HStack(spacing: 6) {
                ForEach(FindingStageFilter.allCases) { filter in
                    Button {
                        stageFilter = filter
                    } label: {
                        Text(filter.label)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(stageFilter == filter ? AppTheme.slateInk : Color.white, in: Capsule())
                            .foregroundStyle(stageFilter == filter ? .white : .secondary)
                    }
                }
                Spacer()
            }
        }
    }
}

#if DEBUG
#Preview("Radar · signed out (fallback identity)") {
    RadarView(onOpenApprovals: {})
        .environment(PreviewSupport.previewClerk())
        .previewEnvironments()
}

#Preview("Radar · inbox zero (no pending)") {
    RadarView(onOpenApprovals: {})
        .environment(PreviewSupport.previewClerk())
        .environment(PreviewSupport.makeRadarClient(
            snapshot: RadarSnapshot.inboxZero(PreviewSupport.snapshot)
        ))
        .previewEnvironments()
}
#endif
