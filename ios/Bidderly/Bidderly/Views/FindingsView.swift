import SwiftUI

struct FindingsView: View {
    @Environment(RadarClient.self) private var radar

    @State private var query = ""
    @State private var stageFilter: FindingStageFilter = .all

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snapshot = radar.snapshot {
                    VStack(spacing: 12) {
                        FilterBar(query: $query, stageFilter: $stageFilter)
                        LazyVStack(spacing: 10) {
                            ForEach(filtered(snapshot.findings)) { finding in
                                NavigationLink(value: NavRoute.finding(finding.id)) {
                                    FindingRow(finding: finding, bundle: radar.bundle(forFinding: finding.id))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.vertical, 8)
                } else if let error = radar.errorMessage {
                    ErrorCard(message: error, onRetry: { Task { await radar.refresh() } }).padding()
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .background(AppTheme.slateBackground)
            .navigationTitle("Findings")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: NavRoute.self) { route in
                switch route {
                case .finding(let id):
                    if let bundle = radar.bundle(forFinding: id) {
                        FindingDetailView(bundle: bundle)
                    } else {
                        Text("Finding not found.")
                    }
                case .approvals:
                    ApprovalsView()
                case .opportunities:
                    OpportunitiesView()
                case .activity:
                    ActivityView()
                }
            }
        }
    }

    private func filtered(_ findings: [Finding]) -> [Finding] {
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
                    Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
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
        .padding(.horizontal)
    }
}

struct FindingRow: View {
    let finding: Finding
    let bundle: FindingBundle?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                StageBadge(stage: finding.stage)
                Spacer()
                if let score = bundle?.score {
                    ScorePill(score: score.worthOutreachScore, urgency: score.urgency)
                }
            }
            Text(finding.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AppTheme.slateInk)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.caption)
                    .foregroundStyle(AppTheme.slateMuted)
                Text(finding.sourceName)
                    .font(.caption)
                    .foregroundStyle(AppTheme.slateMuted)
                    .lineLimit(1)
                Spacer()
                Text(RelativeDateFormatter.shared.string(from: finding.publishedAt))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(AppTheme.slateMuted)
            }
            if let bundle, let route = bundle.score?.route {
                HStack(spacing: 6) {
                    RouteBadge(route: route)
                    ForEach(Array((bundle.extraction?.clueTags ?? []).prefix(3)), id: \.self) { tag in
                        ClueTag(tag: tag)
                    }
                }
            }
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}

#if DEBUG
#Preview("Findings · mixed stages") {
    FindingsView()
        .previewEnvironments()
}
#endif
