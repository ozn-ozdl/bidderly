import SwiftUI
import ClerkKit
import ClerkKitUI

struct SettingsView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(AlarmManager.self) private var alarm
    @Environment(RealtimeClient.self) private var realtime
    @Environment(Clerk.self) private var clerk
    @State private var confirmReset = false
    @State private var isResetting = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    accountCard
                    systemStatusCard
                    approvalsCard
                    alarmCard
                    cascadeLogCard
                }
                .padding()
            }
            .appBackground()
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .alert("Reset all approval requests?", isPresented: $confirmReset) {
                Button("Cancel", role: .cancel) {}
                Button("Reset", role: .destructive) { Task { await performReset() } }
            } message: {
                Text("Every pending, approved, and needs-info decision returns to pending. The server snapshot is reset too.")
            }
        }
    }

    private func performReset() async {
        guard !isResetting else { return }
        isResetting = true
        defer { isResetting = false }
        _ = await radar.resetApprovals()
    }

    // MARK: - Cards

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Account", systemImage: "person.crop.circle.fill")
                .font(.subheadline.weight(.semibold))
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(AppTheme.gradient).frame(width: 44, height: 44)
                    Text(initials)
                        .font(.headline).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.subheadline.weight(.semibold)).appInk()
                    Text(email).font(.caption).appMuted()
                }
                Spacer()
                UserButton()
                    .frame(width: 36, height: 36)
            }
        }
        .cardStyle()
    }

    /// Merged backend-URL + integration-status card. The dev "what is it
    /// talking to" and the live "is it actually answering" live together so
    /// the user can correlate an outage with a config in one screen.
    private var systemStatusCard: some View {
        let integrations = radar.snapshot?.integrations
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("System", systemImage: "network")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                modePill(integrations?.mode)
            }
            row("API", value: AppConfig.apiBaseURL.absoluteString, mono: true)
            row("Realtime", value: AppConfig.realtimeBaseURL.absoluteString, mono: true)
            connectionRow(realtime: realtime)
            Divider()
            Text("INTEGRATIONS")
                .font(.caption2.weight(.bold))
                .tracking(0.6)
                .appMuted()
            diagRow("Clerk", on: integrations?.clerk ?? false)
            diagRow("Database", on: integrations?.database ?? false)
            diagRow("Tavily", on: integrations?.tavily ?? false)
            diagRow("Pioneer GLiNER", on: integrations?.pioneerGliner ?? false)
            diagRow("Pioneer Gemma 4", on: integrations?.pioneerGemma ?? false)
            diagRow("Gemini", on: integrations?.gemini ?? false)
        }
        .cardStyle()
    }

    private var approvalsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Approval queue", systemImage: "checkmark.seal")
                .font(.subheadline.weight(.semibold))
            HStack(spacing: 12) {
                Image(systemName: "arrow.counterclockwise.circle")
                    .font(.title2)
                    .foregroundStyle(AppTheme.deepTeal)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Reset approval requests")
                        .font(.subheadline.weight(.semibold))
                        .appInk()
                    Text("Sends every decision back to pending on the server and on this device.")
                        .font(.caption)
                        .appMuted()
                }
                Spacer()
            }
            Button {
                confirmReset = true
            } label: {
                HStack {
                    if isResetting { ProgressView().tint(.white) }
                    Text(isResetting ? "Resetting…" : "Reset approvals")
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
            }
            .background(isResetting ? AppTheme.slateMuted : AppTheme.deepTeal, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .foregroundStyle(.white)
            .disabled(isResetting)
        }
        .cardStyle()
    }

    private var alarmCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Alarm & notifications", systemImage: "bell.badge")
                .font(.subheadline.weight(.semibold))
            HStack {
                Text("Push permission")
                    .font(.subheadline)
                Spacer()
                Text(alarm.notificationsAuthorized ? "Granted" : "Not granted")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(alarm.notificationsAuthorized ? AppTheme.success : AppTheme.amberAlert)
            }
            Button {
                Task { await alarm.requestPermissionsIfNeeded() }
            } label: {
                Label("Request permission", systemImage: "bell.slash.fill")
                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                    .background(AppTheme.deepTeal, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .foregroundStyle(.white)
                    .font(.subheadline.weight(.semibold))
            }
            Button("Trigger sample alarm") {
                if let approval = radar.snapshot?.approvals.first(where: { $0.alertEligible }) {
                    let title = radar.bundle(forFinding: approval.findingId)?.finding.title
                    alarm.raise(for: approval, findingTitle: title)
                }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppTheme.deepTeal)
        }
        .cardStyle()
    }

    /// Power-user surface for the cascade's event log. Not the primary
    /// decision path — the Approvals tab owns that. Lives here so the
    /// Radar scroll stays focused on "what needs me" / "what qualified".
    private var cascadeLogCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Cascade log", systemImage: "clock.arrow.circlepath")
                .font(.subheadline.weight(.semibold))
            Text("The cascade's recent events. Power-user view, not the primary surface.")
                .font(.caption)
                .appMuted()
                .fixedSize(horizontal: false, vertical: true)
            NavigationLink {
                ActivityView()
                    .navigationTitle("Cascade log")
            } label: {
                HStack {
                    Text("Open cascade log")
                        .appInk()
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .appMuted()
                }
                .font(.subheadline.weight(.semibold))
                .padding(.vertical, 10)
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity)
                .appSurface()
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .cardStyle()
    }

    // MARK: - Row helpers

    private func row(_ label: String, value: String, mono: Bool = false) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.subheadline)
                .frame(width: 76, alignment: .leading)
            Text(value)
                .font(mono ? .caption.monospaced() : .caption)
                .appMuted()
                .multilineTextAlignment(.trailing)
        }
    }

    private func connectionRow(realtime: RealtimeClient) -> some View {
        HStack {
            Text("Realtime")
                .font(.subheadline)
                .frame(width: 76, alignment: .leading)
            Spacer()
            Text(realtime.isConnected ? "Connected" : "Disconnected")
                .font(.caption.weight(.bold)).monospaced()
                .padding(.horizontal, 6).padding(.vertical, 3)
                .background((realtime.isConnected ? AppTheme.success : AppTheme.amberAlert).opacity(0.15))
                .foregroundStyle(realtime.isConnected ? AppTheme.success : AppTheme.amberAlert)
                .clipShape(Capsule())
        }
    }

    private func modePill(_ mode: String?) -> some View {
        Text((mode ?? "—").uppercased())
            .font(.caption2.weight(.bold)).monospaced()
            .padding(.horizontal, 6).padding(.vertical, 3)
            .background(AppTheme.teal.opacity(0.15))
            .foregroundStyle(AppTheme.deepTeal)
            .clipShape(Capsule())
    }

    private func diagRow(_ label: String, on: Bool) -> some View {
        HStack {
            Image(systemName: on ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(on ? AppTheme.success : AppTheme.slateMuted)
            Text(label).font(.subheadline)
            Spacer()
            Text(on ? "Configured" : "Not configured")
                .font(.caption)
                .appMuted()
        }
    }

    // MARK: - Identity

    private var name: String {
        let first = clerk.user?.firstName ?? ""
        let last = clerk.user?.lastName ?? ""
        let joined = "\(first) \(last)".trimmingCharacters(in: .whitespaces)
        return joined.isEmpty ? (clerk.user?.id.prefix(8).description ?? "Clerk user") : joined
    }

    private var email: String {
        clerk.user?.primaryEmailAddress?.emailAddress ?? "Signed in via Clerk"
    }

    private var initials: String {
        let first = clerk.user?.firstName?.first.map(String.init) ?? ""
        let last = clerk.user?.lastName?.first.map(String.init) ?? ""
        return (first + last).uppercased().isEmpty ? "B" : (first + last).uppercased()
    }
}

#if DEBUG
#Preview("Settings · signed out") {
    SettingsView()
        .environment(PreviewSupport.previewClerk())
        .previewEnvironments()
}
#endif
