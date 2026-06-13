import SwiftUI

// MARK: - Decide row

/// Compact pending-approval row used by the Radar's "Decide" section. The
/// full ApprovalCard (cascade + consequence + buttons) lives in the Approvals
/// tab — this row is the read-only pointer that hands off to the detail view,
/// where the actual Approve / Request info buttons live.
struct DecideRow: View {
    let approval: ApprovalRequest
    let status: ApprovalStatus

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(approval.title)
                        .font(.subheadline.weight(.semibold))
                        .appInk()
                        .lineLimit(2)
                    Spacer(minLength: 8)
                    ApprovalStatusBadge(status: status)
                }
                HStack(spacing: 4) {
                    Image(systemName: "clock.fill")
                        .font(.caption2)
                        .foregroundStyle(AppTheme.amberAlert)
                    Text("Due \(dueText)")
                        .font(.caption2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(AppTheme.amberAlert)
                }
                Text(approval.blocker)
                    .font(.caption)
                    .appMuted()
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .appMuted()
                .padding(.top, 2)
        }
        .padding(14)
        .appSurface()
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }

    /// "Due Jun 14" — matches the date format the full ApprovalCard uses, but
    /// drops the time to keep the compact row scannable.
    private var dueText: String {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let basic = ISO8601DateFormatter()
        if let date = fractional.date(from: approval.dueAt) ?? basic.date(from: approval.dueAt) {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
        return String(approval.dueAt.prefix(10))
    }
}

// MARK: - Finding row

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
                .appInk()
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            HStack(spacing: 6) {
                Image(systemName: "globe")
                    .font(.caption)
                    .appMuted()
                Text(finding.sourceName)
                    .font(.caption)
                    .appMuted()
                    .lineLimit(1)
                Spacer()
                Text(RelativeDateFormatter.shared.string(from: finding.publishedAt))
                    .font(.caption2.monospacedDigit())
                    .appMuted()
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
        .appSurface()
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}

// MARK: - Opportunity row

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
                        .appInk()
                        .lineLimit(2)
                    Text(opportunity.buyer).font(.caption).appMuted()
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
                    .appInk()
                Label(opportunity.deadline, systemImage: "calendar")
                    .font(.caption.weight(.semibold))
                    .appInk()
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
        .appSurface()
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}
