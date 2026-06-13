import SwiftUI
import ClerkKit
import ClerkKitUI

struct SettingsView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(AlarmManager.self) private var alarm
    @Environment(RealtimeClient.self) private var realtime
    @Environment(Clerk.self) private var clerk
    @State private var presentProfile = false
    @State private var confirmReset = false
    @State private var isResetting = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    accountCard
                    cascadeCard
                    apiCard
                    diagnosticsCard
                    approvalsCard
                    alarmCard
                }
                .padding()
            }
            .background(AppTheme.slateBackground)
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
                    Text(name).font(.subheadline.weight(.semibold)).foregroundStyle(AppTheme.slateInk)
                    Text(email).font(.caption).foregroundStyle(AppTheme.slateMuted)
                }
                Spacer()
                UserButton()
                    .frame(width: 36, height: 36)
            }
            Text("Sign-in, sign-up, profile, and sign-out are powered by the Clerk iOS SDK (`ClerkKit` / `ClerkKitUI`).")
                .font(.caption)
                .foregroundStyle(AppTheme.slateMuted)
        }
        .cardStyle()
    }

    private var cascadeCard: some View {
        let cascade = radar.snapshot?.cascade
        return VStack(alignment: .leading, spacing: 10) {
            Label("Pioneer cascade", systemImage: "shield.checkered")
                .font(.subheadline.weight(.semibold))
            cascadeRow(icon: "text.magnifyingglass", title: "Extraction", model: cascade?.extraction ?? "fine-tuned GLiNER2")
            cascadeRow(icon: "gauge.with.dots.needle.50percent", title: "Scoring", model: cascade?.scoring ?? "Pioneer Gemma 4")
            cascadeRow(icon: "sparkles", title: "Reasoning", model: cascade?.reasoning ?? "Gemini deep reasoning")
            if let gate = cascade?.geminiGate {
                Text("Gate: \(gate)").font(.caption2).foregroundStyle(AppTheme.slateMuted)
            }
        }
        .cardStyle()
    }

    private func cascadeRow(icon: String, title: String, model: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(AppTheme.deepTeal)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(AppTheme.slateMuted)
                Text(model).font(.subheadline.weight(.medium)).foregroundStyle(AppTheme.slateInk)
            }
            Spacer()
        }
    }

    private var apiCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Backend", systemImage: "network")
                .font(.subheadline.weight(.semibold))
            HStack {
                Text("API base URL")
                    .font(.subheadline)
                Spacer()
                Text(AppConfig.apiBaseURL.absoluteString)
                    .font(.caption.monospaced())
                    .foregroundStyle(AppTheme.slateMuted)
            }
            HStack {
                Text("Realtime URL")
                    .font(.subheadline)
                Spacer()
                Text(AppConfig.realtimeBaseURL.absoluteString)
                    .font(.caption.monospaced())
                    .foregroundStyle(AppTheme.slateMuted)
            }
            HStack {
                Text("Realtime")
                    .font(.subheadline)
                Spacer()
                Text(realtime.isConnected ? "Connected" : "Disconnected")
                    .font(.caption.weight(.bold)).monospaced()
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background((realtime.isConnected ? AppTheme.success : AppTheme.amberAlert).opacity(0.15))
                    .foregroundStyle(realtime.isConnected ? AppTheme.success : AppTheme.amberAlert)
                    .clipShape(Capsule())
            }
            HStack {
                Text("Mode")
                    .font(.subheadline)
                Spacer()
                Text(radar.snapshot?.integrations?.mode.uppercased() ?? "—")
                    .font(.caption.weight(.bold)).monospaced()
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(AppTheme.teal.opacity(0.15))
                    .foregroundStyle(AppTheme.deepTeal)
                    .clipShape(Capsule())
            }
        }
        .cardStyle()
    }

    private var diagnosticsCard: some View {
        let integrations = radar.snapshot?.integrations
        return VStack(alignment: .leading, spacing: 8) {
            Label("Integration status", systemImage: "checkmark.shield.fill")
                .font(.subheadline.weight(.semibold))
            diagRow("Clerk", on: integrations?.clerk ?? false)
            diagRow("Database", on: integrations?.database ?? false)
            diagRow("Tavily", on: integrations?.tavily ?? false)
            diagRow("Pioneer GLiNER", on: integrations?.pioneerGliner ?? false)
            diagRow("Pioneer Gemma 4", on: integrations?.pioneerGemma ?? false)
            diagRow("Gemini", on: integrations?.gemini ?? false)
        }
        .cardStyle()
    }

    private func diagRow(_ label: String, on: Bool) -> some View {
        HStack {
            Image(systemName: on ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(on ? AppTheme.success : AppTheme.slateMuted)
            Text(label).font(.subheadline)
            Spacer()
            Text(on ? "Configured" : "Not configured")
                .font(.caption)
                .foregroundStyle(AppTheme.slateMuted)
        }
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
                        .foregroundStyle(AppTheme.slateInk)
                    Text("Sends every decision back to pending on the server and on this device.")
                        .font(.caption)
                        .foregroundStyle(AppTheme.slateMuted)
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
