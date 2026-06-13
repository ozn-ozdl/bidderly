import SwiftUI

struct MainTabView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(AlarmManager.self) private var alarm

    @State private var selection = 0

    var body: some View {
        TabView(selection: $selection) {
            DashboardView()
                .tabItem { Label("Radar", systemImage: "dot.radiowaves.left.and.right") }
                .tag(0)

            FindingsView()
                .tabItem { Label("Findings", systemImage: "doc.text.magnifyingglass") }
                .tag(1)

            OpportunitiesView()
                .tabItem { Label("Opportunities", systemImage: "gauge.with.dots.needle.50percent") }
                .tag(2)

            ApprovalsView()
                .tabItem {
                    let pending = radar.pendingApprovals().count
                    Label("Approvals", systemImage: pending > 0 ? "bell.badge.fill" : "bell")
                        .badge(pending)
                }
                .tag(3)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(4)
        }
        .tint(AppTheme.deepTeal)
        .overlay(alarmOverlay)
        .task {
            await alarm.requestPermissionsIfNeeded()
            await radar.refresh()
            checkPendingAlarms()
            // Periodically re-poll the radar so newly-arrived approvals trigger an
            // alarm even when the app is in the foreground. (The web app uses SSE;
            // on iOS we poll the same snapshot endpoint every 30s.)
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30 * 1_000_000_000)
                await radar.refresh()
                checkPendingAlarms()
            }
        }
        .refreshable {
            await radar.refresh()
            checkPendingAlarms()
        }
    }

    private func checkPendingAlarms() {
        guard radar.snapshot != nil else { return }
        if let first = radar.pendingApprovals().first(where: { $0.alertEligible }) {
            let title = radar.bundle(forFinding: first.findingId)?.finding.title
            alarm.raise(for: first, findingTitle: title)
        }
    }

    @ViewBuilder
    private var alarmOverlay: some View {
        if let active = alarm.activeAlarm {
            AlarmSheet(
                alarm: active,
                onApprove: handleApprove,
                onNeedsInfo: handleNeedsInfo,
                onDismiss: { alarm.dismiss() }
            )
            .transition(.opacity)
        }
    }

    private func handleApprove() {
        guard let id = alarm.activeAlarm?.id else { return }
        radar.update(approvalId: id, status: .approved)
        alarm.dismiss()
        selection = 3
    }

    private func handleNeedsInfo() {
        guard let id = alarm.activeAlarm?.id else { return }
        radar.update(approvalId: id, status: .needsInfo)
        alarm.dismiss()
        selection = 3
    }
}
