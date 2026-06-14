import SwiftUI

/// Negotiation threads and detail. Uses a stacked list → detail flow on iPhone
/// (not a side-by-side layout) so the scroll surface never exceeds screen width.
struct NegotiationsView: View {
    @Environment(NegotiationClient.self) private var negotiations

    var body: some View {
        NavigationStack {
            Group {
                if negotiations.isLoading && negotiations.items.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    threadList
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .clipped()
            .appBackground()
            .navigationTitle("Negotiations")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .navigationDestination(for: NegotiationSummary.self) { summary in
                NegotiationDetailView(summary: summary)
            }
            .task { await negotiations.refresh() }
            .refreshable { await negotiations.refresh() }
        }
    }

    private var threadList: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(alignment: .leading, spacing: 16) {
                headerCopy

                if let error = negotiations.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(AppTheme.danger)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if negotiations.items.isEmpty {
                    EmptyStateView(
                        icon: "bubble.left.and.bubble.right",
                        title: "No negotiations yet",
                        message: "Approve a finding to start a simulated tender negotiation."
                    )
                    .frame(maxWidth: .infinity)
                } else {
                    VStack(spacing: 10) {
                        ForEach(negotiations.items) { item in
                            NavigationLink(value: item) {
                                NegotiationThreadRow(summary: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .clipped()
    }

    private var headerCopy: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Live tender negotiations")
                .font(.subheadline.weight(.semibold))
                .appInk()
            Text("Gemini writes agent offers, parses buyer replies, and generates relevant counter-offer options.")
                .font(.caption)
                .appMuted()
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Button {
                    Task { await negotiations.refresh() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                Button(role: .destructive) {
                    Task { await negotiations.reset() }
                } label: {
                    Label("Reset", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
        }
    }
}

// MARK: - Thread row

private struct NegotiationThreadRow: View {
    let summary: NegotiationSummary

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(summary.title)
                    .font(.subheadline.weight(.semibold))
                    .appInk()
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Text(summary.buyer)
                    .font(.caption)
                    .appMuted()
                    .lineLimit(2)
                HStack(spacing: 8) {
                    Text(summary.status.rawValue.replacingOccurrences(of: "_", with: " ").uppercased())
                        .font(.caption2.weight(.semibold).monospaced())
                        .appMuted()
                    Text("·")
                        .appMuted()
                    Text("\(summary.rounds) rounds")
                        .font(.caption2.monospaced())
                        .appMuted()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 0.5)
        )
    }
}

// MARK: - Detail

private struct NegotiationDetailView: View {
    @Environment(NegotiationClient.self) private var negotiations
    let summary: NegotiationSummary

    @State private var detail: NegotiationDetail?
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var isResponding = false

    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else if let detail {
                    detailContent(detail)
                } else if let errorMessage {
                    ErrorCard(
                        title: "Couldn't load negotiation",
                        message: errorMessage
                    ) {
                        Task { await loadDetail() }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .clipped()
        .appBackground()
        .navigationTitle(summary.title)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadDetail() }
    }

    @ViewBuilder
    private func detailContent(_ detail: NegotiationDetail) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(detail.negotiation.status.rawValue.replacingOccurrences(of: "_", with: " ").uppercased())
                    .font(.caption2.weight(.bold).monospaced())
                    .appMuted()
                Text(detail.opportunity?.title ?? detail.finding.title)
                    .font(.title3.weight(.semibold))
                    .appInk()
                    .fixedSize(horizontal: false, vertical: true)
                Text(detail.opportunity?.buyer ?? detail.finding.sourceName)
                    .font(.caption)
                    .appMuted()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            NegotiationDashboardCard(
                dashboard: detail.dashboard,
                targetPrice: detail.negotiation.targetPrice,
                currency: detail.negotiation.currency
            )

            metricsGrid(detail)

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("MESSAGE GENERATION")
                        .font(.caption.weight(.bold))
                        .tracking(0.6)
                        .appMuted()
                    Spacer()
                    if detail.gemini != nil {
                        Label("Gemini", systemImage: "sparkles")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(AppTheme.teal)
                    }
                }
                Text("Agent offers and buyer replies are generated from the negotiation state. Prices are tracked separately.")
                    .font(.caption)
                    .appMuted()
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(detail.messages) { message in
                    GeneratedMessageBubble(message: message, currency: detail.negotiation.currency)
                }
            }

            if detail.negotiation.status == .awaitingUser {
                VStack(alignment: .leading, spacing: 10) {
                    Text("YOUR RESPONSE")
                        .font(.caption.weight(.bold))
                        .tracking(0.6)
                        .appMuted()
                    IntentActionRow(
                        negotiationId: detail.negotiation.id,
                        isResponding: $isResponding
                    ) { updated in
                        self.detail = updated
                    }
                    Text("COUNTER-OFFER OPTIONS")
                        .font(.caption.weight(.bold))
                        .tracking(0.6)
                        .appMuted()
                    if let parsed = detail.dashboard.latestParsed {
                        Text("Options are tuned to the buyer's latest position: \(parsed.summary)")
                            .font(.caption)
                            .appMuted()
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    ForEach(detail.pendingOptions) { option in
                        TradeoffCard(
                            option: option,
                            negotiationId: detail.negotiation.id,
                            buyerTarget: detail.dashboard.currentCounterpartyOffer,
                            isResponding: $isResponding
                        ) { updated in
                            self.detail = updated
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func metricsGrid(_ detail: NegotiationDetail) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            MetricCell(label: "Opening", value: money(detail.negotiation.openingPrice))
            MetricCell(label: "Target", value: money(detail.negotiation.targetPrice))
            MetricCell(label: "Rounds", value: String(detail.negotiation.rounds))
            MetricCell(
                label: "Agreed",
                value: detail.negotiation.agreedPrice.map(money) ?? "—"
            )
        }
        .frame(maxWidth: .infinity)
    }

    private func loadDetail() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            detail = try await negotiations.loadDetail(id: summary.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func money(_ value: Double) -> String {
        "EUR \(Int(value.rounded()).formatted())"
    }
}

private struct MetricCell: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold).monospaced())
                .appMuted()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .appInk()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct IntentActionRow: View {
    @Environment(NegotiationClient.self) private var negotiations
    let negotiationId: String
    @Binding var isResponding: Bool
    let onUpdate: (NegotiationDetail) -> Void

    @State private var acting: NegotiationIntent?
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Button {
                    Task { await act(.accept) }
                } label: {
                    Label(acting == .accept ? "Accepting…" : "Accept", systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(AppTheme.slateInk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .foregroundStyle(.white)
                }
                .disabled(isResponding)

                Button {
                    Task { await act(.deny) }
                } label: {
                    Label(acting == .deny ? "Denying…" : "Deny", systemImage: "xmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(AppTheme.danger.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .foregroundStyle(AppTheme.danger)
                }
                .disabled(isResponding)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(AppTheme.danger)
            }
        }
    }

    private func act(_ intent: NegotiationIntent) async {
        guard !isResponding else { return }
        isResponding = true
        acting = intent
        errorMessage = nil
        defer {
            acting = nil
            isResponding = false
        }
        do {
            let detail = try await negotiations.respondWithIntent(negotiationId: negotiationId, intent: intent)
            onUpdate(detail)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct TradeoffCard: View {
    @Environment(NegotiationClient.self) private var negotiations
    let option: CounterpartyTradeoffOption
    let negotiationId: String
    let buyerTarget: Double?
    @Binding var isResponding: Bool
    let onUpdate: (NegotiationDetail) -> Void

    @State private var values: [String: String] = [:]
    @State private var isSending = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(option.title)
                .font(.subheadline.weight(.semibold))
                .appInk()
            Text(option.summary)
                .font(.caption)
                .appMuted()
                .fixedSize(horizontal: false, vertical: true)

            if let buyerTarget {
                Text("Buyer target: EUR \(Int(buyerTarget.rounded()).formatted())")
                    .font(.caption2.weight(.medium).monospaced())
                    .foregroundStyle(AppTheme.amberAlert)
            }

            ForEach(option.parameters) { param in
                VStack(alignment: .leading, spacing: 4) {
                    Text(param.label)
                        .font(.caption.weight(.medium))
                        .appMuted()
                    Picker(param.label, selection: binding(for: param)) {
                        ForEach(param.options, id: \.value) { item in
                            Text(item.label).tag(item.value)
                        }
                    }
                    .pickerStyle(.menu)
                    .disabled(isResponding)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(AppTheme.danger)
            }

            Button {
                Task { await send() }
            } label: {
                Text(isSending ? "Sending…" : "Send counter-offer")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(AppTheme.slateInk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .foregroundStyle(.white)
            }
            .disabled(isResponding)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .diffusionReveal(trigger: option.id)
        .onAppear {
            if values.isEmpty {
                values = Dictionary(uniqueKeysWithValues: option.parameters.map { ($0.key, $0.defaultValue) })
            }
        }
    }

    private func binding(for param: TradeoffParameter) -> Binding<String> {
        Binding(
            get: { values[param.key] ?? param.defaultValue },
            set: { values[param.key] = $0 }
        )
    }

    private func send() async {
        guard !isResponding else { return }
        isResponding = true
        isSending = true
        errorMessage = nil
        defer {
            isSending = false
            isResponding = false
        }
        do {
            let detail = try await negotiations.respond(
                negotiationId: negotiationId,
                optionId: option.id,
                adjustedParameters: values
            )
            onUpdate(detail)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#if DEBUG
#Preview("Negotiations · thread list") {
    NegotiationsView()
        .environment(PreviewSupport.makeNegotiationClient())
}
#endif
