import SwiftUI

struct FindingDetailView: View {
    @Environment(RealtimeClient.self) private var realtime

    let bundle: FindingBundle

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                headerCard
                if let extraction = bundle.extraction,
                   Geo.coords(for: extraction.entities.location) != nil {
                    LocationMapCard(
                        title: bundle.finding.title,
                        location: extraction.entities.location ?? ""
                    )
                }
                if let extraction = bundle.extraction { extractionCard(extraction) }
                if let score = bundle.score { scoreCard(score) }
                if let gemini = bundle.gemini { geminiCard(gemini) }
                if let opportunity = bundle.opportunity { opportunityCard(opportunity) }
                if let approval = bundle.approval { approvalCard(approval) }
                rawTextCard
            }
            .padding()
        }
        .background(AppTheme.slateBackground)
        .navigationTitle("Finding detail")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            realtime.markRead(findingId: bundle.finding.id)
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                StageBadge(stage: bundle.finding.stage)
                if let score = bundle.score {
                    RouteBadge(route: score.route)
                }
                Spacer()
            }
            Text(bundle.finding.title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(AppTheme.slateInk)
            HStack(spacing: 6) {
                Image(systemName: "globe").font(.caption)
                Text(bundle.finding.sourceName).font(.caption)
                Text("·").foregroundStyle(.secondary)
                Text(bundle.finding.detectedLanguage.uppercased()).font(.caption.monospaced())
                Spacer()
                Text(RelativeDateFormatter.shared.string(from: bundle.finding.publishedAt))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(AppTheme.slateMuted)
            }
            .foregroundStyle(AppTheme.slateMuted)
            Link(destination: URL(string: bundle.finding.url) ?? URL(string: "https://example.com")!) {
                Label("Open source page", systemImage: "arrow.up.right.square")
                    .font(.subheadline.weight(.semibold))
            }
        }
        .cardStyle()
    }

    private func extractionCard(_ extraction: Extraction) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("GLiNER2 extraction", systemImage: "text.magnifyingglass")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(Int(extraction.confidence * 100))%")
                    .font(.caption.monospacedDigit().weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(AppTheme.teal.opacity(0.15))
                    .foregroundStyle(AppTheme.deepTeal)
                    .clipShape(Capsule())
            }
            Text(extraction.model)
                .font(.caption2.monospaced())
                .foregroundStyle(AppTheme.slateMuted)

            Group {
                entityLine("Buyer", extraction.entities.buyerIssuer)
                entityLine("Project", extraction.entities.projectName)
                entityLine("Category", extraction.entities.category)
                entityLine("Location", extraction.entities.location)
                entityLine("Budget", extraction.entities.budgetValue)
                entityLine("Deadline", extraction.entities.deadline)
                entityLine("Contact", extraction.entities.contactPersona)
            }

            if !extraction.clueTags.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(extraction.clueTags, id: \.self) { tag in
                        ClueTag(tag: tag)
                    }
                }
            }
        }
        .cardStyle()
    }

    private func scoreCard(_ score: ModelScore) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Pioneer Gemma 4 score", systemImage: "gauge.with.dots.needle.50percent")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                ScorePill(score: score.worthOutreachScore, urgency: score.urgency)
            }
            Text(score.model)
                .font(.caption2.monospaced())
                .foregroundStyle(AppTheme.slateMuted)
            Text(score.rationale)
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateInk)
                .fixedSize(horizontal: false, vertical: true)
        }
        .cardStyle()
    }

    private func geminiCard(_ gemini: GeminiAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Gemini deep reasoning", systemImage: "sparkles")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("GATED").font(.caption2.weight(.bold)).monospaced()
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(Color.purple.opacity(0.15))
                    .foregroundStyle(Color.purple)
                    .clipShape(Capsule())
            }
            Text(gemini.model)
                .font(.caption2.monospaced())
                .foregroundStyle(AppTheme.slateMuted)
            Text(gemini.summary)
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateInk)
            if !gemini.recommendedNextSteps.isEmpty {
                Text("Recommended next steps").font(.caption.weight(.semibold)).foregroundStyle(AppTheme.slateMuted)
                ForEach(gemini.recommendedNextSteps, id: \.self) { step in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "arrowtriangle.right.fill").font(.caption).foregroundStyle(AppTheme.teal)
                        Text(step).font(.subheadline).foregroundStyle(AppTheme.slateInk)
                    }
                }
            }
            if !gemini.risks.isEmpty {
                Text("Risks").font(.caption.weight(.semibold)).foregroundStyle(AppTheme.slateMuted)
                ForEach(gemini.risks, id: \.self) { risk in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(AppTheme.amberAlert)
                        Text(risk).font(.subheadline).foregroundStyle(AppTheme.slateInk)
                    }
                }
            }
            if let blocker = gemini.blocker {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "lock.fill").foregroundStyle(AppTheme.amberAlert)
                    Text(blocker).font(.subheadline.weight(.semibold)).foregroundStyle(AppTheme.slateInk)
                }
                .padding(10)
                .background(AppTheme.amberAlert.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .cardStyle()
    }

    private func opportunityCard(_ opportunity: Opportunity) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Qualified opportunity", systemImage: "gauge.with.dots.needle.50percent")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(opportunity.status.rawValue.replacingOccurrences(of: "_", with: " ").uppercased())
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(AppTheme.success.opacity(0.15))
                    .foregroundStyle(AppTheme.success)
                    .clipShape(Capsule())
            }
            entityLine("Buyer", opportunity.buyer)
            entityLine("Value", opportunity.valueBand)
            entityLine("Deadline", opportunity.deadline)
            entityLine("Owner", opportunity.owner)
            entityLine("Next action", opportunity.nextAction)
        }
        .cardStyle()
    }

    @ViewBuilder
    private func approvalCard(_ approval: ApprovalRequest) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Approval required", systemImage: "bell.badge.fill")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                ApprovalStatusBadge(status: radarStatus(approval))
            }
            Text(approval.blocker).font(.subheadline).foregroundStyle(AppTheme.slateInk)
            Text(approval.requestedAction).font(.subheadline).foregroundStyle(AppTheme.slateMuted)
            if radarStatus(approval) == .pending {
                HStack(spacing: 10) {
                    Button {
                        ApprovalActions.shared.approve(approval.id)
                    } label: {
                        Label("Approve", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(AppTheme.slateInk, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .foregroundStyle(.white)
                            .font(.subheadline.weight(.semibold))
                    }
                    Button {
                        ApprovalActions.shared.needsInfo(approval.id)
                    } label: {
                        Label("Request info", systemImage: "questionmark.circle")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(Color.gray.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .foregroundStyle(AppTheme.slateInk)
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }
        }
        .cardStyle()
    }

    private var rawTextCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Raw source text", systemImage: "doc.text")
                .font(.subheadline.weight(.semibold))
            Text(bundle.finding.rawText)
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .cardStyle()
    }

    private func entityLine(_ label: String, _ value: String?) -> some View {
        HStack(alignment: .top) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .frame(width: 80, alignment: .leading)
                .foregroundStyle(AppTheme.slateMuted)
            Text(value ?? "—")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(AppTheme.slateInk)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func radarStatus(_ approval: ApprovalRequest) -> ApprovalStatus {
        ApprovalActions.shared.status(for: approval.id) ?? approval.status
    }
}

/// Tiny bridge so detail rows can mutate the radar client without threading @Environment
/// into every helper. Wired up in `BidderlyApp`.
@MainActor
final class ApprovalActions {
    static let shared = ApprovalActions()
    weak var client: RadarClient?

    func approve(_ id: String) { client?.update(approvalId: id, status: .approved) }
    func needsInfo(_ id: String) { client?.update(approvalId: id, status: .needsInfo) }
    func status(for id: String) -> ApprovalStatus? { client?.status(forApprovalId: id) }
}
