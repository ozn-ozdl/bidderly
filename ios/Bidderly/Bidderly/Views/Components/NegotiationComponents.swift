import SwiftUI

// MARK: - Diffusion reveal

/// Blur-to-sharp reveal used when offer data and generated messages land.
struct DiffusionReveal: ViewModifier {
    let trigger: String
    @State private var revealed = false

    func body(content: Content) -> some View {
        content
            .opacity(revealed ? 1 : 0.15)
            .scaleEffect(revealed ? 1 : 1.02)
            .blur(radius: revealed ? 0 : 14)
            .clipped()
            .onAppear { animateIn() }
            .onChange(of: trigger) { _, _ in
                revealed = false
                animateIn()
            }
    }

    private func animateIn() {
        withAnimation(.easeOut(duration: 1.1)) {
            revealed = true
        }
    }
}

extension View {
    func diffusionReveal(trigger: String) -> some View {
        modifier(DiffusionReveal(trigger: trigger))
    }
}

// MARK: - Direction arrows

struct DirectionArrow: View {
    let movement: TermMovement

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: iconName)
                .font(.caption.weight(.bold))
                .foregroundStyle(tint)
                .symbolEffect(.pulse, options: movement == .buyerPressing ? .repeating : .nonRepeating)
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(tint)
                .multilineTextAlignment(.center)
        }
        .frame(width: 72)
    }

    private var iconName: String {
        switch movement {
        case .buyerPressing: return "arrow.left.circle.fill"
        case .agentConceding: return "arrow.right.circle.fill"
        case .agentProposed: return "arrow.up.right.circle.fill"
        case .buyerProposed: return "arrow.down.left.circle.fill"
        case .aligned: return "equal.circle.fill"
        case .diverging: return "arrow.left.arrow.right.circle.fill"
        }
    }

    private var label: String {
        switch movement {
        case .buyerPressing: return "Buyer pushing"
        case .agentConceding: return "You conceding"
        case .agentProposed: return "You proposed"
        case .buyerProposed: return "Buyer proposed"
        case .aligned: return "Aligned"
        case .diverging: return "Diverging"
        }
    }

    private var tint: Color {
        switch movement {
        case .buyerPressing, .buyerProposed: return AppTheme.amberAlert
        case .agentConceding, .agentProposed: return AppTheme.teal
        case .aligned: return AppTheme.success
        case .diverging: return AppTheme.danger
        }
    }
}

struct TermComparisonRow: View {
    let field: NegotiationTermField

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(field.label.uppercased())
                .font(.caption2.weight(.bold).monospaced())
                .appMuted()

            HStack(alignment: .center, spacing: 8) {
                TermValueColumn(
                    title: "You",
                    value: field.agentDisplay ?? "—",
                    tint: AppTheme.teal
                )
                DirectionArrow(movement: field.movement)
                TermValueColumn(
                    title: "Buyer",
                    value: field.counterpartyDisplay ?? "—",
                    tint: AppTheme.amberAlert
                )
            }
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color.primary.opacity(0.03), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .diffusionReveal(trigger: "\(field.key)-\(field.agentDisplay ?? "")-\(field.counterpartyDisplay ?? "")")
    }
}

private struct TermValueColumn: View {
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(tint.opacity(0.85))
            Text(value)
                .font(.caption.weight(.semibold))
                .appInk()
                .lineLimit(2)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Offer trajectory chart

struct OfferTrajectoryChart: View {
    let timeline: [NegotiationOfferPoint]
    let targetPrice: Double

    private var agentSeries: [Double] {
        timeline.compactMap(\.agentPrice)
    }

    private var counterpartySeries: [Double] {
        timeline.compactMap(\.counterpartyPrice)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                LegendDot(color: AppTheme.teal, label: "Your offer")
                LegendDot(color: AppTheme.amberAlert, label: "Buyer position")
                Spacer(minLength: 0)
                if timeline.count > 1 {
                    Text("\(timeline.count) rounds")
                        .font(.caption2.monospaced())
                        .appMuted()
                }
            }
            .frame(maxWidth: .infinity)

            Color.clear
                .frame(maxWidth: .infinity)
                .frame(height: 140)
                .overlay {
                    GeometryReader { geo in
                        let allValues = agentSeries + counterpartySeries + [targetPrice]
                        let minV = (allValues.min() ?? 0) * 0.96
                        let maxV = (allValues.max() ?? 1) * 1.04
                        let range = max(maxV - minV, 1)

                        ZStack {
                            targetLine(in: geo.size, minV: minV, range: range)
                            gapArrows(in: geo.size, minV: minV, range: range)
                            seriesPath(
                                timeline.map(\.agentPrice),
                                in: geo.size,
                                minV: minV,
                                range: range,
                                color: AppTheme.teal
                            )
                            seriesPath(
                                timeline.map(\.counterpartyPrice),
                                in: geo.size,
                                minV: minV,
                                range: range,
                                color: AppTheme.amberAlert
                            )
                        }
                        .frame(width: geo.size.width, height: geo.size.height)
                    }
                }
                .clipped()
                .diffusionReveal(trigger: timeline.map(\.id).map(String.init).joined())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func gapArrows(in size: CGSize, minV: Double, range: Double) -> some View {
        ForEach(Array(timeline.enumerated()), id: \.element.id) { index, point in
            if let agent = point.agentPrice, let buyer = point.counterpartyPrice, agent != buyer {
                let xStep = timeline.count > 1 ? size.width / CGFloat(timeline.count - 1) : 0
                let x = CGFloat(index) * xStep
                let agentY = size.height - CGFloat((agent - minV) / range) * (size.height - 16) - 8
                let buyerY = size.height - CGFloat((buyer - minV) / range) * (size.height - 16) - 8
                let midY = (agentY + buyerY) / 2
                Image(systemName: buyer < agent ? "arrow.down" : "arrow.up")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(AppTheme.amberAlert.opacity(0.7))
                    .position(x: min(x + 14, size.width - 8), y: midY)
            }
        }
    }

    @ViewBuilder
    private func targetLine(in size: CGSize, minV: Double, range: Double) -> some View {
        let y = size.height - CGFloat((targetPrice - minV) / range) * (size.height - 16) - 8
        Path { path in
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
        }
        .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        .foregroundStyle(Color.primary.opacity(0.18))
    }

    private func seriesPath(
        _ values: [Double?],
        in size: CGSize,
        minV: Double,
        range: Double,
        color: Color
    ) -> some View {
        let points: [CGPoint] = values.enumerated().compactMap { index, value in
            guard let value else { return nil }
            let xStep = values.count > 1 ? size.width / CGFloat(values.count - 1) : 0
            let x = CGFloat(index) * xStep
            let y = size.height - CGFloat((value - minV) / range) * (size.height - 16) - 8
            return CGPoint(x: x, y: y)
        }

        return ZStack {
            if points.count > 1 {
                Path { path in
                    path.move(to: points[0])
                    for point in points.dropFirst() {
                        path.addLine(to: point)
                    }
                }
                .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
            }
            ForEach(Array(points.enumerated()), id: \.offset) { _, point in
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
                    .position(point)
            }
        }
    }
}

private struct LegendDot: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
                .font(.caption2.weight(.medium))
                .appMuted()
        }
    }
}

// MARK: - Dashboard card

struct NegotiationDashboardCard: View {
    let dashboard: NegotiationDashboard
    let targetPrice: Double
    let currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("NEGOTIATION DASHBOARD")
                .font(.caption.weight(.bold))
                .tracking(0.6)
                .appMuted()

            if !dashboard.termFields.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("ACTIVE TERMS")
                        .font(.caption2.weight(.bold))
                        .tracking(0.5)
                        .appMuted()
                    ForEach(dashboard.termFields) { field in
                        TermComparisonRow(field: field)
                    }
                }
            }

            if !dashboard.offerTimeline.isEmpty {
                Text("PRICE TRAJECTORY")
                    .font(.caption2.weight(.bold))
                    .tracking(0.5)
                    .appMuted()
                OfferTrajectoryChart(timeline: dashboard.offerTimeline, targetPrice: targetPrice)
            } else {
                Text("Offer data will appear after the first exchange.")
                    .font(.caption)
                    .appMuted()
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipped()
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 0.5)
        )
    }

    private func money(_ value: Double, currency: String) -> String {
        "\(currency) \(Int(value.rounded()).formatted())"
    }
}

private struct OfferStatPill: View {
    let label: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold).monospaced())
                .foregroundStyle(tint.opacity(0.85))
            Text(value)
                .font(.caption.weight(.semibold))
                .appInk()
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(tint.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct ParsedOfferChips: View {
    let parsed: ParsedNegotiationOffer
    let currency: String
    var partyLabel: String = "EXTRACTED"

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(partyLabel)
                .font(.caption2.weight(.bold))
                .tracking(0.5)
                .appMuted()
            Text(parsed.summary)
                .font(.caption)
                .appInk()
                .fixedSize(horizontal: false, vertical: true)
            FlowLayout(spacing: 6, lineSpacing: 6) {
                if let price = parsed.referencedPrice {
                    Chip(text: "\(currency) \(Int(price.rounded()).formatted())", tint: AppTheme.amberAlert)
                }
                Chip(text: parsed.intent.rawValue, tint: AppTheme.deepTeal)
                ForEach(termChips, id: \.self) { chip in
                    Chip(text: chip, tint: AppTheme.slateMuted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var termChips: [String] {
        var chips = parsed.levers.map { $0.replacingOccurrences(of: "_", with: " ") }
        if let terms = parsed.terms {
            for (key, value) in terms {
                chips.append("\(key.replacingOccurrences(of: "_", with: " ")): \(value)")
            }
        }
        return chips
    }
}

private struct Chip: View {
    let text: String
    let tint: Color

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold).monospaced())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tint.opacity(0.12), in: Capsule())
            .foregroundStyle(tint)
    }
}

// MARK: - Message generation bubbles

struct GeneratedMessageBubble: View {
    let message: NegotiationMessage
    let currency: String

    private var isAgent: Bool { message.party == .agent }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(
                    isAgent ? "Agent offer" : "Buyer reply",
                    systemImage: isAgent ? "paperplane.fill" : "building.2.fill"
                )
                .font(.caption2.weight(.bold))
                .foregroundStyle(isAgent ? AppTheme.teal : AppTheme.amberAlert)
                Spacer()
                Text(RelativeDateFormatter.shared.string(from: message.at))
                    .font(.caption2.monospaced())
                    .appMuted()
            }

            if let price = displayPrice {
                Text(price)
                    .font(.caption.weight(.semibold).monospaced())
                    .foregroundStyle(isAgent ? AppTheme.teal : AppTheme.amberAlert)
            }

            Text(message.text)
                .font(.subheadline)
                .appInk()
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let parsed = message.parsedOffer {
                ParsedOfferChips(
                    parsed: parsed,
                    currency: currency,
                    partyLabel: isAgent ? "YOUR TERMS" : "BUYER TERMS"
                )
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            (isAgent ? AppTheme.teal : AppTheme.amberAlert).opacity(0.06),
            in: RoundedRectangle(cornerRadius: 12, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke((isAgent ? AppTheme.teal : AppTheme.amberAlert).opacity(0.2), lineWidth: 1)
        )
        .diffusionReveal(trigger: message.id)
    }

    private var displayPrice: String? {
        if let price = message.price {
            return "\(currency) \(Int(price.rounded()).formatted())"
        }
        if let price = message.parsedOffer?.referencedPrice {
            return "\(currency) \(Int(price.rounded()).formatted())"
        }
        return message.parsedIntent?.rawValue
    }
}
