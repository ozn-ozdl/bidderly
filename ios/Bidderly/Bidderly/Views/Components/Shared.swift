import SwiftUI

/// Wraps the ISO date strings the API emits into "3m ago"-style relative strings.
final class RelativeDateFormatter {
    static let shared = RelativeDateFormatter()
    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private let fallback: ISO8601DateFormatter = ISO8601DateFormatter()

    func string(from iso: String) -> String {
        guard let date = isoFormatter.date(from: iso) ?? fallback.date(from: iso) else {
            return iso
        }
        return string(from: date)
    }

    func string(from date: Date) -> String {
        let interval = -date.timeIntervalSinceNow
        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval/60))m ago" }
        if interval < 86400 { return "\(Int(interval/3600))h ago" }
        return "\(Int(interval/86400))d ago"
    }
}

// MARK: - FlowLayout (chips)

struct FlowLayout: Layout {
    var spacing: CGFloat = 6
    var lineSpacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var totalHeight: CGFloat = 0
        var x: CGFloat = 0
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth {
                totalHeight += rowHeight + lineSpacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : x, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + lineSpacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Error card

struct ErrorCard: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(AppTheme.danger)
            Text("Couldn't reach the radar API")
                .font(.headline)
                .appInk()
            Text(message)
                .font(.subheadline)
                .appMuted()
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Label("Retry", systemImage: "arrow.clockwise")
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(AppTheme.slateInk, in: Capsule())
                    .foregroundStyle(.white)
                    .font(.subheadline.weight(.semibold))
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .appSurface()
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: Color.black.opacity(0.05), radius: 8, y: 3)
    }
}
