import SwiftUI

// MARK: - Score pill

struct ScorePill: View {
    let score: Int
    let urgency: Urgency

    var bodyColor: (Color, Color) {
        if score >= 80 { return (AppTheme.success.opacity(0.12), AppTheme.success) }
        if score >= 60 { return (AppTheme.teal.opacity(0.12), AppTheme.teal) }
        if score >= 35 { return (AppTheme.amberAlert.opacity(0.15), AppTheme.amberAlert) }
        return (Color.gray.opacity(0.12), Color.gray)
    }

    var body: some View {
        let (bg, fg) = bodyColor
        HStack(spacing: 6) {
            Text("\(score)")
                .font(.system(.subheadline, design: .rounded).weight(.bold))
                .monospacedDigit()
            Text(urgency.rawValue.uppercased())
                .font(.system(size: 10, weight: .bold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(urgency == .high ? AppTheme.danger.opacity(0.15) : Color.gray.opacity(0.1))
                .foregroundStyle(urgency == .high ? AppTheme.danger : Color.gray)
                .clipShape(Capsule())
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(bg)
        .foregroundStyle(fg)
        .clipShape(Capsule())
    }
}

// MARK: - Route badge

struct RouteBadge: View {
    let route: RouteDecision

    var colors: (Color, Color) {
        switch route {
        case .humanReview: return (AppTheme.amberAlert.opacity(0.15), AppTheme.amberAlert)
        case .qualify: return (AppTheme.success.opacity(0.12), AppTheme.success)
        case .monitor: return (Color.gray.opacity(0.1), Color.secondary)
        case .ignore: return (Color.gray.opacity(0.08), Color.secondary.opacity(0.7))
        }
    }

    var body: some View {
        let (bg, fg) = colors
        Text(label)
            .font(.system(size: 11, weight: .bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(bg)
            .foregroundStyle(fg)
            .clipShape(Capsule())
    }

    var label: String {
        switch route {
        case .humanReview: return "HUMAN REVIEW"
        case .qualify: return "QUALIFY"
        case .monitor: return "MONITOR"
        case .ignore: return "IGNORE"
        }
    }
}

// MARK: - Clue tag

struct ClueTag: View {
    let tag: ProcurementClue

    var body: some View {
        Text(tag.rawValue.replacingOccurrences(of: "_", with: " "))
            .font(.system(size: 10, weight: .bold))
            .monospaced()
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(tag.isUrgent ? AppTheme.amberAlert.opacity(0.15) : Color.gray.opacity(0.1))
            .foregroundStyle(tag.isUrgent ? AppTheme.amberAlert : AppTheme.slateMuted)
            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
    }
}

// MARK: - Stage badge

struct StageBadge: View {
    let stage: FindingStage

    var color: Color {
        switch stage {
        case .qualified: return AppTheme.success
        case .scored: return AppTheme.teal
        case .extracted: return Color.purple
        case .raw: return Color.blue
        case .ignored: return Color.gray
        }
    }

    var body: some View {
        Text(stage.rawValue.uppercased())
            .font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

// MARK: - Source status dot

struct SourceStatusDot: View {
    let status: SourceStatus

    var color: Color {
        switch status {
        case .healthy: return AppTheme.success
        case .degraded: return AppTheme.amberAlert
        case .blocked: return AppTheme.danger
        }
    }

    var body: some View {
        Circle()
            .fill(color)
            .frame(width: 8, height: 8)
            .overlay(Circle().stroke(color.opacity(0.3), lineWidth: 4))
    }
}

// MARK: - Approval status badge

struct ApprovalStatusBadge: View {
    let status: ApprovalStatus

    var color: Color {
        switch status {
        case .pending: return AppTheme.amberAlert
        case .approved: return AppTheme.success
        case .needsInfo: return Color.purple
        }
    }

    var label: String {
        switch status {
        case .pending: return "PENDING"
        case .approved: return "APPROVED"
        case .needsInfo: return "NEEDS INFO"
        }
    }

    var body: some View {
        Text(label)
            .font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

// MARK: - Metric tile

struct MetricTile: View {
    let icon: String
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(tint)
                Spacer()
            }
            Text(value)
                .font(.system(.title2, design: .rounded).weight(.bold))
                .foregroundStyle(AppTheme.slateInk)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(title)
                .font(.caption)
                .foregroundStyle(AppTheme.slateMuted)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(AppTheme.surfaceCard)
        .clipShape(AppTheme.cardStyle)
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}

// MARK: - Empty state

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 38, weight: .light))
                .foregroundStyle(AppTheme.slateMuted)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateMuted)
                .multilineTextAlignment(.center)
        }
        .padding(40)
        .frame(maxWidth: .infinity)
    }
}
