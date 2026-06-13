import SwiftUI

/// A compact map card showing qualified tenders pinned by location with the
/// great-circle distance from the Bidderly home base. The geometry is a
/// simple lat/lng → viewBox projection over central Europe; no map tiles.
struct TenderMapCard: View {
    let snapshot: RadarSnapshot
    let homeLabel: String

    init(snapshot: RadarSnapshot, homeLabel: String = "Bidderly HQ · Munich") {
        self.snapshot = snapshot
        self.homeLabel = homeLabel
    }

    private struct Pin: Identifiable {
        let id: String
        let title: String
        let location: String
        let status: OpportunityStatus
        let distanceKm: Int
        let valueM: Double?
        let x: CGFloat
        let y: CGFloat
    }

    private static let bounds = (minLat: 46.5, maxLat: 55.5, minLng: 4.5, maxLng: 16.5)
    private static let viewSize = CGSize(width: 400, height: 240)

    private var homePoint: CGPoint {
        project(Geo.homeBase)
    }

    private static let valueRegex: NSRegularExpression? = {
        try? NSRegularExpression(pattern: #"(\d+(?:\.\d+)?)\s*M"#)
    }()

    private func parseValueM(_ text: String) -> Double? {
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = Self.valueRegex?.firstMatch(in: text, range: range),
              let r = Range(match.range(at: 1), in: text) else { return nil }
        return Double(text[r])
    }

    private var pins: [Pin] {
        snapshot.opportunities.compactMap { opp -> Pin? in
            let finding = snapshot.findings.first { $0.id == opp.findingId }
            let extraction = snapshot.extractions.first { $0.findingId == opp.findingId }
            let location = extraction?.entities.location
                ?? finding?.title.split(separator: " ").last.map(String.init)
            guard let location, let coords = Geo.coords(for: location) else { return nil }
            let point = project(coords)
            return Pin(
                id: opp.id,
                title: opp.title,
                location: location,
                status: opp.status,
                distanceKm: Int(Geo.distanceKm(Geo.homeBase, coords).rounded()),
                valueM: parseValueM(opp.valueBand),
                x: point.x,
                y: point.y
            )
        }
        .sorted { $0.distanceKm < $1.distanceKm }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Tender map", systemImage: "map")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(homeLabel)
                    .font(.caption.monospaced())
                    .foregroundStyle(AppTheme.slateMuted)
            }
            Text("\(pins.count) qualified tender\(pins.count == 1 ? "" : "s") · distance from your office")
                .font(.caption)
                .foregroundStyle(AppTheme.slateMuted)

            ZStack(alignment: .topLeading) {
                Canvas { context, size in
                    let path = Path(CGRect(origin: .zero, size: size))
                    context.fill(path, with: .color(.white.opacity(0.5)))

                    // grid
                    let step: CGFloat = 32
                    var gridPath = Path()
                    var x: CGFloat = 0
                    while x <= size.width {
                        gridPath.move(to: CGPoint(x: x, y: 0))
                        gridPath.addLine(to: CGPoint(x: x, y: size.height))
                        x += step
                    }
                    var y: CGFloat = 0
                    while y <= size.height {
                        gridPath.move(to: CGPoint(x: 0, y: y))
                        gridPath.addLine(to: CGPoint(x: size.width, y: y))
                        y += step
                    }
                    context.stroke(gridPath, with: .color(.gray.opacity(0.15)), lineWidth: 0.5)
                }
                .frame(height: Self.viewSize.height)

                GeometryReader { proxy in
                    let scaleX = proxy.size.width / Self.viewSize.width
                    let scaleY = proxy.size.height / Self.viewSize.height
                    let s = min(scaleX, scaleY)
                    let offsetX = (proxy.size.width - Self.viewSize.width * s) / 2
                    let offsetY = (proxy.size.height - Self.viewSize.height * s) / 2

                    ZStack(alignment: .topLeading) {
                        // Connection lines
                        ForEach(pins) { pin in
                            Path { p in
                                p.move(to: CGPoint(x: homePoint.x, y: homePoint.y))
                                p.addLine(to: CGPoint(x: pin.x, y: pin.y))
                            }
                            .stroke(AppTheme.slateMuted.opacity(0.3), style: StrokeStyle(lineWidth: 0.5, dash: [2, 3]))
                            .frame(width: Self.viewSize.width, height: Self.viewSize.height)
                        }

                        // Tender pins
                        ForEach(pins) { pin in
                            pinView(pin)
                                .position(x: pin.x, y: pin.y)
                        }

                        // Home pin
                        homeView
                            .position(x: homePoint.x, y: homePoint.y)
                    }
                    .frame(width: Self.viewSize.width, height: Self.viewSize.height)
                    .scaleEffect(s, anchor: .topLeading)
                    .offset(x: offsetX, y: offsetY)
                }
                .frame(height: Self.viewSize.height)
            }
            .background(AppTheme.slateBackground.opacity(0.4), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            // Nearest tenders list
            VStack(spacing: 6) {
                ForEach(pins.prefix(3)) { pin in
                    HStack(spacing: 8) {
                        Circle().fill(statusColor(pin.status)).frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(pin.title)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(AppTheme.slateInk)
                                .lineLimit(1)
                            Text("\(pin.location) · \(statusLabel(pin.status))")
                                .font(.caption2)
                                .foregroundStyle(AppTheme.slateMuted)
                                .lineLimit(1)
                        }
                        Spacer()
                        Text(Geo.formatDistance(Double(pin.distanceKm)))
                            .font(.caption.monospaced().weight(.semibold))
                            .foregroundStyle(AppTheme.slateInk)
                    }
                }
                if pins.isEmpty {
                    Text("No geocoded tenders in this snapshot.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.slateMuted)
                }
            }
        }
        .cardStyle()
    }

    private func project(_ c: LatLng) -> CGPoint {
        let x = ((c.lng - Self.bounds.minLng) / (Self.bounds.maxLng - Self.bounds.minLng)) * Self.viewSize.width
        let y = ((Self.bounds.maxLat - c.lat) / (Self.bounds.maxLat - Self.bounds.minLat)) * Self.viewSize.height
        return CGPoint(x: x, y: y)
    }

    private func pinRadius(_ valueM: Double?) -> CGFloat {
        guard let m = valueM else { return 5 }
        if m >= 10 { return 9 }
        if m >= 5 { return 7 }
        if m >= 2 { return 6 }
        return 5
    }

    private func statusColor(_ s: OpportunityStatus) -> Color {
        switch s {
        case .blocked: return AppTheme.amberAlert
        case .readyForOutreach: return AppTheme.success
        case .monitoring: return AppTheme.teal
        case .new: return AppTheme.deepTeal
        }
    }

    private func statusLabel(_ s: OpportunityStatus) -> String {
        switch s {
        case .blocked: return "Blocked"
        case .readyForOutreach: return "Ready"
        case .monitoring: return "Monitoring"
        case .new: return "New"
        }
    }

    @ViewBuilder
    private func pinView(_ pin: Pin) -> some View {
        Circle()
            .fill(statusColor(pin.status).opacity(0.3))
            .overlay(
                Circle().stroke(statusColor(pin.status), lineWidth: 1.5)
            )
            .frame(width: pinRadius(pin.valueM) * 2, height: pinRadius(pin.valueM) * 2)
    }

    @ViewBuilder
    private var homeView: some View {
        ZStack {
            Circle().fill(.white).frame(width: 16, height: 16)
            Circle().stroke(AppTheme.slateInk, lineWidth: 1.5).frame(width: 16, height: 16)
            Circle().fill(AppTheme.slateInk).frame(width: 5, height: 5)
        }
        .offset(x: 20, y: 0)
        .overlay(alignment: .leading) {
            Text("HQ")
                .font(.system(size: 8, weight: .bold, design: .monospaced))
                .foregroundStyle(AppTheme.slateInk)
                .offset(x: 28, y: 0)
        }
    }
}
