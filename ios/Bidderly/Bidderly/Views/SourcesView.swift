import SwiftUI

struct SourcesView: View {
    @Environment(RadarClient.self) private var radar

    var body: some View {
        NavigationStack {
            ScrollView {
                if let snapshot = radar.snapshot {
                    LazyVStack(spacing: 10) {
                        ForEach(snapshot.sources) { source in
                            SourceCard(source: source)
                        }
                    }
                    .padding()
                } else {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 200)
                }
            }
            .background(AppTheme.slateBackground)
            .navigationTitle("Sources")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}

private struct SourceCard: View {
    let source: Source

    var typeIcon: String {
        switch source.type {
        case .publicTenderPortal: return "building.columns.fill"
        case .procurementPage: return "doc.text.fill"
        case .councilProjectPage: return "building.2.fill"
        case .curatedDemoFeed: return "sparkles"
        case .tavilySearch: return "magnifyingglass.circle.fill"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                ZStack {
                    Circle().fill(AppTheme.teal.opacity(0.12)).frame(width: 36, height: 36)
                    Image(systemName: typeIcon).foregroundStyle(AppTheme.deepTeal)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(source.name).font(.subheadline.weight(.semibold)).foregroundStyle(AppTheme.slateInk)
                    Text(source.geography).font(.caption).foregroundStyle(AppTheme.slateMuted)
                }
                Spacer()
                SourceStatusDot(status: source.status)
            }
            HStack(spacing: 16) {
                Label(source.cadence, systemImage: "clock").font(.caption.weight(.semibold)).foregroundStyle(AppTheme.slateInk)
                Label("\(source.findingsToday) today", systemImage: "doc.text").font(.caption.weight(.semibold)).foregroundStyle(AppTheme.slateInk)
                Spacer()
            }
            if let lastChecked = ISO8601DateFormatter().date(from: source.lastCheckedAt) {
                Text("Last checked \(lastChecked.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(AppTheme.slateMuted)
            }
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
    }
}
