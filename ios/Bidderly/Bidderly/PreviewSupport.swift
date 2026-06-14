import Foundation
import SwiftUI
import ClerkKit

#if DEBUG

/// Fixture data + environment factories for SwiftUI previews. Keeps the
/// preview canvas honest: the same models the app decodes from the live
/// `/api/radar` payload, populated with realistic findings, approvals in
/// mixed states, opportunities, and a cascade/integration summary.
enum PreviewSupport {
    // MARK: - Fixture snapshot

    static let snapshot: RadarSnapshot = {
        let run = ScoutRun(
            id: "run_2026_06_13_0915",
            mode: "manual_demo",
            startedAt: "2026-06-13T09:15:00.000Z",
            finishedAt: "2026-06-13T09:17:42.000Z",
            status: "completed",
            sourcesScanned: 7,
            findingsDiscovered: 6
        )

        let sources: [Source] = [
            .init(id: "src_ted_eu", name: "TED EU tenders", type: .publicTenderPortal, url: "https://ted.europa.eu", geography: "EU", cadence: "Every 20 minutes", status: .healthy, lastCheckedAt: "2026-06-13T09:15:12.000Z", findingsToday: 18),
            .init(id: "src_bund_de", name: "Bund.de procurement", type: .publicTenderPortal, url: "https://www.service.bund.de", geography: "Germany", cadence: "Every 15 minutes", status: .healthy, lastCheckedAt: "2026-06-13T09:15:21.000Z", findingsToday: 11),
            .init(id: "src_munich_council", name: "Munich council projects", type: .councilProjectPage, url: "https://stadt.muenchen.de", geography: "Bavaria", cadence: "Hourly", status: .healthy, lastCheckedAt: "2026-06-13T09:13:44.000Z", findingsToday: 4),
            .init(id: "src_berlin_energy", name: "Berlin energy announcements", type: .procurementPage, url: "https://www.berlin.de", geography: "Berlin", cadence: "Hourly", status: .degraded, lastCheckedAt: "2026-06-13T09:04:18.000Z", findingsToday: 3),
            .init(id: "src_demo_feed", name: "Curated hackathon feed", type: .curatedDemoFeed, url: "local://demo-feed", geography: "Germany / EU", cadence: "Manual demo", status: .healthy, lastCheckedAt: "2026-06-13T09:15:00.000Z", findingsToday: 6)
        ]

        let findings: [Finding] = [
            .init(id: "find_munich_it", sourceId: "src_munich_council", sourceName: "Munich council projects", sourceType: .councilProjectPage, title: "Digital classroom network modernization for Munich school district", url: "https://stadt.muenchen.de/demo/school-network-modernization", rawText: "Der Bildungsausschuss der Landeshauptstadt München hat ein Budget von 2,4 Mio. EUR für die Modernisierung der WLAN- und Firewall-Infrastruktur an 18 Schulen freigegeben.", detectedLanguage: "de", publishedAt: "2026-06-13T08:42:00.000Z", stage: .qualified),
            .init(id: "find_berlin_solar", sourceId: "src_berlin_energy", sourceName: "Berlin energy announcements", sourceType: .procurementPage, title: "Pre-announcement: solar roofs and monitoring for Berlin civic buildings", url: "https://www.berlin.de/demo/solar-roofs-monitoring", rawText: "Die Senatsverwaltung bereitet eine Markterkundung für Photovoltaik-Dachanlagen vor.", detectedLanguage: "de", publishedAt: "2026-06-13T08:16:00.000Z", stage: .qualified),
            .init(id: "find_hamburg_supplier_day", sourceId: "src_demo_feed", sourceName: "Curated hackathon feed", sourceType: .curatedDemoFeed, title: "Hamburg supplier day for citizen service kiosk software", url: "local://demo-feed/hamburg-kiosk-software", rawText: "Hamburg Service vor Ort lädt Softwareanbieter zu einem Lieferantentag.", detectedLanguage: "de", publishedAt: "2026-06-12T17:28:00.000Z", stage: .scored),
            .init(id: "find_eu_digital_services", sourceId: "src_ted_eu", sourceName: "TED EU tenders", sourceType: .publicTenderPortal, title: "EU regional digital public services framework", url: "https://ted.europa.eu/demo/regional-digital-services-framework", rawText: "The European Regional Innovation Office published an official tender for a digital public services framework.", detectedLanguage: "en", publishedAt: "2026-06-13T07:54:00.000Z", stage: .qualified),
            .init(id: "find_cologne_duplicate", sourceId: "src_bund_de", sourceName: "Bund.de procurement", sourceType: .publicTenderPortal, title: "Duplicate notice: Cologne facility cleaning extension", url: "https://www.service.bund.de/demo/cologne-cleaning-duplicate", rawText: "Bekanntmachung zur Verlängerung eines bestehenden Reinigungsvertrags.", detectedLanguage: "de", publishedAt: "2026-06-13T07:22:00.000Z", stage: .ignored),
            .init(id: "find_random_event", sourceId: "src_demo_feed", sourceName: "Curated hackathon feed", sourceType: .curatedDemoFeed, title: "General networking breakfast for municipal IT leaders", url: "local://demo-feed/network-breakfast", rawText: "Kommunale IT-Leiter treffen sich zu einem Frühstück.", detectedLanguage: "de", publishedAt: "2026-06-12T09:00:00.000Z", stage: .ignored)
        ]

        let extractions: [Extraction] = [
            .init(id: "ext_munich_it", findingId: "find_munich_it", model: "fine-tuned GLiNER2 procurement radar", confidence: 0.94, entities: .init(buyerIssuer: "Landeshauptstadt München", projectName: "Modernisierung der WLAN- und Firewall-Infrastruktur", category: "School IT infrastructure", location: "Munich, Bavaria", deadline: "2026-06-28", budgetValue: "EUR 2.4M", contactPersona: "Vergabestelle / IT procurement"), clueTags: [.budgetApproved, .supplierCall, .deadlineNear, .loginRequired, .preAnnouncement], spans: []),
            .init(id: "ext_berlin_solar", findingId: "find_berlin_solar", model: "fine-tuned GLiNER2 procurement radar", confidence: 0.9, entities: .init(buyerIssuer: "Senatsverwaltung Berlin", projectName: "Photovoltaik-Dachanlagen und Energiemonitoring", category: "Energy infrastructure", location: "Berlin", deadline: "2026-07-03", budgetValue: "EUR 4.8M planned", contactPersona: "Energy program office"), clueTags: [.preAnnouncement, .budgetApproved, .eventNotice], spans: []),
            .init(id: "ext_hamburg_supplier_day", findingId: "find_hamburg_supplier_day", model: "fine-tuned GLiNER2 procurement radar", confidence: 0.87, entities: .init(buyerIssuer: "Hamburg Service vor Ort", projectName: "Self-Service-Kioske im Bürgeramt", category: "Citizen service software", location: "Hamburg", deadline: "2026-06-19", budgetValue: nil, contactPersona: "Citizen service program owner"), clueTags: [.supplierCall, .eventNotice, .deadlineNear], spans: []),
            .init(id: "ext_eu_digital_services", findingId: "find_eu_digital_services", model: "fine-tuned GLiNER2 procurement radar", confidence: 0.96, entities: .init(buyerIssuer: "European Regional Innovation Office", projectName: "Digital public services framework", category: "Citizen portals and workflow software", location: "European Union", deadline: "2026-06-24", budgetValue: "EUR 12M", contactPersona: "Framework procurement board"), clueTags: [.officialTender, .deadlineNear, .budgetApproved], spans: []),
            .init(id: "ext_cologne_duplicate", findingId: "find_cologne_duplicate", model: "fine-tuned GLiNER2 procurement radar", confidence: 0.82, entities: .init(buyerIssuer: "Köln Verwaltung", projectName: "Reinigungsvertrag Verwaltungsgebäude", category: "Facility services", location: "Cologne", deadline: nil, budgetValue: nil, contactPersona: nil), clueTags: [.duplicate], spans: []),
            .init(id: "ext_random_event", findingId: "find_random_event", model: "fine-tuned GLiNER2 procurement radar", confidence: 0.74, entities: .init(buyerIssuer: "Kommunale IT-Leiter", projectName: nil, category: "Networking event", location: "Germany", deadline: nil, budgetValue: nil, contactPersona: nil), clueTags: [], spans: [])
        ]

        let scores: [ModelScore] = [
            .init(id: "score_munich_it", findingId: "find_munich_it", model: "Pioneer Gemma 4 scoring router", worthOutreachScore: 88, urgency: .high, route: .humanReview, rationale: "Budget is approved, deadline is close, and portal registration blocks automated follow-up."),
            .init(id: "score_berlin_solar", findingId: "find_berlin_solar", model: "Pioneer Gemma 4 scoring router", worthOutreachScore: 76, urgency: .medium, route: .qualify, rationale: "Strong early signal with funded energy scope and a dated supplier information event."),
            .init(id: "score_hamburg_supplier_day", findingId: "find_hamburg_supplier_day", model: "Pioneer Gemma 4 scoring router", worthOutreachScore: 64, urgency: .medium, route: .qualify, rationale: "Relevant software category and supplier event, but no budget or formal tender yet."),
            .init(id: "score_eu_digital_services", findingId: "find_eu_digital_services", model: "Pioneer Gemma 4 scoring router", worthOutreachScore: 94, urgency: .high, route: .humanReview, rationale: "Large official framework with a near participation deadline and consortium requirement."),
            .init(id: "score_cologne_duplicate", findingId: "find_cologne_duplicate", model: "Pioneer Gemma 4 scoring router", worthOutreachScore: 22, urgency: .low, route: .ignore, rationale: "Duplicate extension notice for facility services, outside the target software profile."),
            .init(id: "score_random_event", findingId: "find_random_event", model: "Pioneer Gemma 4 scoring router", worthOutreachScore: 16, urgency: .low, route: .ignore, rationale: "No procurement clue, budget, source authority, deadline, or actionable buyer intent.")
        ]

        let geminiAnalyses: [GeminiAnalysis] = [
            .init(id: "gem_munich_it", findingId: "find_munich_it", model: "Gemini deep reasoning", summary: "This is likely an early procurement window before a full tender package is released. The account team should confirm portal registration, gather school-network references, and prepare a concise capability note.", risks: ["Portal registration may reveal mandatory certifications not in the public snippet.", "Deadline is close enough that slow internal approval could lose the window."], recommendedNextSteps: ["Ask user to approve contacting the procurement office.", "Assign public-sector IT owner to gather school WLAN references.", "Prepare registration checklist and capability note."], blocker: "Human approval required before contacting the procurement office."),
            .init(id: "gem_eu_digital_services", findingId: "find_eu_digital_services", model: "Gemini deep reasoning", summary: "The framework is high value, but participation depends on a consortium statement. Escalation is justified because the team must decide whether to lead, join, or decline a cross-border bid.", risks: ["Consortium statement creates legal and partner dependency before qualification."], recommendedNextSteps: ["Ask user whether to lead or join a consortium.", "Draft a partner shortlist and qualification memo."], blocker: "User must choose consortium strategy before agents draft outreach.")
        ]

        let opportunities: [Opportunity] = [
            .init(id: "opp_munich_it", findingId: "find_munich_it", title: "Munich school network modernization", buyer: "Landeshauptstadt München", owner: "DACH public sector sales", valueBand: "EUR 2M-3M", deadline: "2026-06-28", nextAction: "Approve procurement-office contact", status: .blocked),
            .init(id: "opp_berlin_solar", findingId: "find_berlin_solar", title: "Berlin civic buildings energy monitoring", buyer: "Senatsverwaltung Berlin", owner: "Energy partnerships", valueBand: "EUR 4M-5M planned", deadline: "2026-07-03", nextAction: "Reserve supplier information event", status: .readyForOutreach),
            .init(id: "opp_eu_digital_services", findingId: "find_eu_digital_services", title: "EU digital public services framework", buyer: "European Regional Innovation Office", owner: "EU enterprise team", valueBand: "EUR 10M+", deadline: "2026-06-24", nextAction: "Decide consortium strategy", status: .blocked)
        ]

        let approvals: [ApprovalRequest] = [
            .init(id: "appr_munich_it", findingId: "find_munich_it", opportunityId: "opp_munich_it", title: "Contact Munich procurement office", requester: "human_escalation_agent", blocker: "Portal registration and outreach require user approval.", requestedAction: "Approve a short email asking for registration access and clarification on school WLAN certifications.", dueAt: "2026-06-14T10:00:00.000Z", status: .pending, alertEligible: true),
            .init(id: "appr_eu_digital_services", findingId: "find_eu_digital_services", opportunityId: "opp_eu_digital_services", title: "Choose EU consortium route", requester: "human_escalation_agent", blocker: "Consortium strategy is a business judgment agents cannot make.", requestedAction: "Choose lead bidder, partner bidder, or decline before Gemini drafts the action plan.", dueAt: "2026-06-14T16:00:00.000Z", status: .pending, alertEligible: true),
            .init(id: "appr_hamburg_supplier_day", findingId: "find_hamburg_supplier_day", opportunityId: "opp_munich_it", title: "Reserve Hamburg supplier day seat", requester: "human_escalation_agent", blocker: "Event attendance needs a quick yes/no.", requestedAction: "Confirm whether the account team should attend the Hamburg supplier day on 19 June.", dueAt: "2026-06-15T09:00:00.000Z", status: .approved, alertEligible: false),
            .init(id: "appr_cologne_followup", findingId: "find_cologne_duplicate", opportunityId: "opp_munich_it", title: "Clarify Cologne cleaning duplicate", requester: "human_escalation_agent", blocker: "Source flagged a likely duplicate notice.", requestedAction: "Decide whether to ignore the Cologne cleaning extension or request the original tender text.", dueAt: "2026-06-16T12:00:00.000Z", status: .needsInfo, alertEligible: false)
        ]

        let events: [AgentEvent] = [
            .init(id: "evt_001", at: "2026-06-13T09:15:00.000Z", role: "research_scout", type: .scoutStarted, title: "Scout run started", detail: "Scanning 7 German/EU procurement and announcement sources.", findingId: nil),
            .init(id: "evt_002", at: "2026-06-13T09:15:18.000Z", role: "research_scout", type: .findingDiscovered, title: "6 raw findings discovered", detail: "Tavily enrichment and curated demo feed returned procurement signals.", findingId: nil),
            .init(id: "evt_003", at: "2026-06-13T09:15:47.000Z", role: "extraction_agent", type: .entitiesExtracted, title: "GLiNER2 extraction complete", detail: "Buyer, project, deadline, budget, contact persona, and clue tags extracted.", findingId: "find_munich_it"),
            .init(id: "evt_004", at: "2026-06-13T09:16:08.000Z", role: "scoring_router", type: .findingScored, title: "Gemma 4 routed high-value finding", detail: "Munich school network modernization scored 88 and routed to human review.", findingId: "find_munich_it"),
            .init(id: "evt_005", at: "2026-06-13T09:16:44.000Z", role: "reasoning_agent", type: .geminiAnalysis, title: "Gemini deep analysis generated", detail: "Reasoning reserved for high-value findings and blockers.", findingId: "find_munich_it"),
            .init(id: "evt_006", at: "2026-06-13T09:17:11.000Z", role: "human_escalation_agent", type: .approvalRequested, title: "Approval requested", detail: "Contacting the Munich procurement office needs user approval.", findingId: "find_munich_it")
        ]

        let cascade = CascadeInfo(
            extraction: "fine-tuned GLiNER2 procurement radar",
            scoring: "Pioneer Gemma 4 scoring router",
            reasoning: "Gemini deep reasoning",
            geminiGate: "score >= 70 OR route == human_review OR urgency == high OR human blocker exists"
        )

        let integrations = IntegrationStatus(
            mode: "fixture",
            clerk: false,
            database: false,
            tavily: true,
            pioneerGliner2: false,
            pioneerClues: false,
            pioneerScoring: false,
            pioneerDryRun: true,
            mockTenderBaseUrl: nil,
            gemini: false,
            missing: ["PIONEER_GLINER2_MODEL", "PIONEER_GEMMA4_MODEL", "GEMINI_API_KEY"]
        )

        return RadarSnapshot(
            scoutRun: run,
            sources: sources,
            findings: findings,
            extractions: extractions,
            scores: scores,
            geminiAnalyses: geminiAnalyses,
            opportunities: opportunities,
            approvals: approvals,
            events: events,
            cascade: cascade,
            integrations: integrations
        )
    }()

    // MARK: - Environment factories

    /// A RadarClient preloaded with the fixture snapshot — the canvas renders
    /// without ever calling out to the network.
    nonisolated static func makeRadarClient(
        snapshot: RadarSnapshot? = nil,
        stateStore: UserStateStore? = nil,
        realtime: RealtimeClient? = nil
    ) -> RadarClient {
        MainActor.assumeIsolated {
            let store = stateStore ?? UserStateStore()
            let client = RadarClient(
                baseURL: URL(string: "https://example.invalid")!,
                userState: store,
                realtime: realtime
            )
            client.seedForPreview(snapshot ?? Self.snapshot)
            return client
        }
    }

    nonisolated static func makeAlarmManager() -> AlarmManager {
        MainActor.assumeIsolated { AlarmManager() }
    }

    nonisolated static func makeUserStateStore() -> UserStateStore {
        MainActor.assumeIsolated { UserStateStore() }
    }

    nonisolated static func makeRealtimeClient() -> RealtimeClient {
        MainActor.assumeIsolated {
            RealtimeClient(
                baseURL: URL(string: "wss://example.invalid")!,
                stateStore: UserStateStore()
            )
        }
    }

    nonisolated static func makeNegotiationClient() -> NegotiationClient {
        MainActor.assumeIsolated {
            NegotiationClient(baseURL: URL(string: "https://example.invalid")!)
        }
    }

    /// Configure the Clerk singleton with the app's publishable key and
    /// return it. In the preview canvas `clerk.user` stays nil, so every
    /// `clerk.user?.…` in the views falls back to its placeholder. The
    /// `UserButton` from ClerkKitUI renders its own signed-out state.
    nonisolated static func previewClerk() -> Clerk {
        MainActor.assumeIsolated {
            Clerk.configure(publishableKey: AppConfig.clerkPublishableKey)
        }
    }
}

// MARK: - View modifier

/// Apply every environment object the views need, with sensible preview
/// defaults. Use `.previewEnvironments()` inside `#Preview` blocks.
struct PreviewEnvironments: ViewModifier {
    let radar: RadarClient
    let alarm: AlarmManager
    let realtime: RealtimeClient
    let userState: UserStateStore

    func body(content: Content) -> some View {
        content
            .environment(radar)
            .environment(alarm)
            .environment(realtime)
            .environment(userState)
    }
}

extension View {
    nonisolated func previewEnvironments(
        radar: RadarClient = PreviewSupport.makeRadarClient(),
        alarm: AlarmManager = PreviewSupport.makeAlarmManager(),
        realtime: RealtimeClient = PreviewSupport.makeRealtimeClient(),
        userState: UserStateStore = PreviewSupport.makeUserStateStore()
    ) -> some View {
        modifier(PreviewEnvironments(radar: radar, alarm: alarm, realtime: realtime, userState: userState))
    }
}

// MARK: - Snapshot variants for previews

extension RadarSnapshot {
    /// All approvals forced to "approved" so the Dashboard glance renders the
    /// "Inbox zero" state. Keeps the fixture shape intact.
    static func inboxZero(_ base: RadarSnapshot) -> RadarSnapshot {
        RadarSnapshot(
            scoutRun: base.scoutRun,
            sources: base.sources,
            findings: base.findings,
            extractions: base.extractions,
            scores: base.scores,
            geminiAnalyses: base.geminiAnalyses,
            opportunities: base.opportunities,
            approvals: base.approvals.map { approval in
                ApprovalRequest(
                    id: approval.id,
                    findingId: approval.findingId,
                    opportunityId: approval.opportunityId,
                    title: approval.title,
                    requester: approval.requester,
                    blocker: approval.blocker,
                    requestedAction: approval.requestedAction,
                    dueAt: approval.dueAt,
                    status: .approved,
                    alertEligible: approval.alertEligible
                )
            },
            events: base.events,
            cascade: base.cascade,
            integrations: base.integrations
        )
    }
}

#endif
