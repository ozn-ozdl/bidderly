import SwiftUI

struct MainTabView: View {
    @Environment(RadarClient.self) private var radar
    @Environment(AlarmManager.self) private var alarm
    @Environment(UserStateStore.self) private var userState
    @Environment(RealtimeClient.self) private var realtime

    @State private var selection = 0

    var body: some View {
        TabView(selection: $selection) {
            RadarView(onOpenApprovals: { selection = 1 })
                .tabItem { Label("Radar", systemImage: "dot.radiowaves.left.and.right") }
                .tag(0)

            ApprovalsView()
                .tabItem {
                    let pending = radar.pendingApprovals().count
                    Label("Approvals", systemImage: pending > 0 ? "bell.badge.fill" : "bell")
                        .badge(pending)
                }
                .tag(1)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(2)
        }
        .tint(AppTheme.deepTeal)
        .overlay(alarmOverlay)
        .task {
            realtime.connect()
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
        .onDisappear {
            realtime.disconnect()
        }
    }

    private func checkPendingAlarms() {
        guard radar.snapshot != nil else { return }
        if let first = radar.pendingApprovals().first(where: { $0.alertEligible && !userState.isDismissed(findingId: $0.findingId) }) {
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
                onDismiss: handleDismiss
            )
            .transition(.opacity)
        }
    }

    private func handleApprove() {
        guard let id = alarm.activeAlarm?.id else { return }
        radar.update(approvalId: id, status: .approved)
        alarm.dismiss()
        selection = 1
    }

    private func handleNeedsInfo() {
        guard let id = alarm.activeAlarm?.id else { return }
        radar.update(approvalId: id, status: .needsInfo)
        alarm.dismiss()
        selection = 1
    }

    private func handleDismiss() {
        if let findingId = alarm.activeAlarm?.findingId {
            realtime.setDismissed(findingId: findingId, dismissed: true)
        }
        alarm.dismiss()
    }
}
