import SwiftUI

struct ActivityView: View {
    @Environment(RadarClient.self) private var radar

    var body: some View {
        ScrollView {
            if radar.liveEvents.isEmpty {
                EmptyStateView(icon: "clock.arrow.circlepath", title: "No events yet", message: "Run a scout to see the cascade in action.")
                    .padding()
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(Array(radar.liveEvents.enumerated()), id: \.element.id) { index, event in
                        ActivityRow(event: event, isFirst: index == 0, isLast: index == radar.liveEvents.count - 1)
                    }
                }
                .padding()
            }
        }
        .appBackground()
    }
}

struct ActivityRow: View {
    let event: AgentEvent
    var isFirst: Bool = false
    var isLast: Bool = false

    var roleColor: Color {
        switch event.role {
        case "research_scout": return AppTheme.teal
        case "extraction_agent": return Color.purple
        case "scoring_router": return AppTheme.deepTeal
        case "reasoning_agent": return Color.indigo
        case "human_escalation_agent": return AppTheme.amberAlert
        default: return Color.gray
        }
    }

    var icon: String {
        switch event.type {
        case .scoutStarted: return "play.circle.fill"
        case .findingDiscovered: return "magnifyingglass.circle.fill"
        case .entitiesExtracted: return "text.magnifyingglass.circle.fill"
        case .findingScored: return "gauge.with.dots.needle.50percent.circle.fill"
        case .geminiAnalysis: return "sparkles"
        case .approvalRequested: return "bell.badge.fill"
        case .opportunityCreated: return "star.circle.fill"
        case .findingIgnored: return "minus.circle.fill"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(roleColor)
                    .frame(width: 28, height: 28)
                if !isLast {
                    Rectangle().fill(roleColor.opacity(0.3)).frame(width: 2)
                        .frame(maxHeight: .infinity)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(event.title).font(.subheadline.weight(.semibold)).appInk()
                    Spacer()
                    Text(RelativeDateFormatter.shared.string(from: event.at))
                        .font(.caption2.monospacedDigit()).appMuted()
                }
                Text(event.detail)
                    .font(.caption)
                    .appMuted()
                    .fixedSize(horizontal: false, vertical: true)
                Text(event.role.replacingOccurrences(of: "_", with: " ").uppercased())
                    .font(.caption2.weight(.bold))
                    .monospaced()
                    .foregroundStyle(roleColor)
            }
            .padding(.bottom, 14)
        }
        .padding(.leading, 4)
    }
}

#if DEBUG
#Preview("Activity · live feed") {
    NavigationStack {
        ActivityView()
            .navigationTitle("Cascade log")
    }
    .previewEnvironments()
}
#endif
