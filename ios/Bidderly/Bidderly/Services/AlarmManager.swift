import Foundation
import UserNotifications
import AVFoundation
import UIKit
#if canImport(SwiftUI)
import SwiftUI
#endif

/// Drives the "alarm" experience the user asked for: when an approval-requested event
/// arrives (or any other critical, user-input-required signal), the app fires a local
/// notification, plays a looped alarm tone, vibrates, and surfaces a fullscreen in-app
/// alarm sheet. The web app's ForegroundAlert is the equivalent.
@MainActor
@Observable
final class AlarmManager: NSObject {
    /// The active alarm, if any. The root view presents `AlarmSheet` when non-nil.
    var activeAlarm: Alarm?

    private var audioPlayer: AVAudioPlayer?
    private var hapticTimer: Timer?

    var notificationsAuthorized = false

    /// IDs of approvals we've already sounded the alarm for. Prevents re-firing
    /// on every refresh as long as the user hasn't dismissed it.
    private var raisedApprovalIds: Set<String> = []

    override init() {
        super.init()
    }

    // MARK: - Permissions

    func requestPermissionsIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound, .criticalAlert])) ?? false
            notificationsAuthorized = granted
        } else {
            notificationsAuthorized = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
        }
    }

    // MARK: - Triggering

    /// Raise an alarm for a pending approval. Idempotent on `approval.id` and on
    /// approvals we've already raised (so a periodic refresh won't re-fire).
    func raise(for approval: ApprovalRequest, findingTitle: String?) {
        if activeAlarm?.id == approval.id { return }
        if raisedApprovalIds.contains(approval.id) { return }
        raisedApprovalIds.insert(approval.id)
        let alarm = Alarm(
            id: approval.id,
            kind: .approvalRequired,
            title: approval.title,
            detail: approval.requestedAction,
            dueAt: ISO8601DateFormatter().date(from: approval.dueAt),
            findingTitle: findingTitle
        )
        activeAlarm = alarm
        startAudioLoop()
        startHaptics()
        scheduleLocalNotification(for: alarm)
    }

    /// Convenience: raise for a freshly-observed high-urgency, human-review event.
    func raiseForEvent(_ event: AgentEvent, snapshot: RadarSnapshot?) {
        let findingTitle = event.findingId.flatMap { id in
            snapshot?.findings.first { $0.id == id }?.title
        }
        let alarm = Alarm(
            id: event.id,
            kind: .scoutSignal,
            title: event.title,
            detail: event.detail,
            dueAt: ISO8601DateFormatter().date(from: event.at),
            findingTitle: findingTitle
        )
        activeAlarm = alarm
        startAudioLoop()
        startHaptics()
    }

    func dismiss() {
        activeAlarm = nil
        stopAudioLoop()
        hapticTimer?.invalidate()
        hapticTimer = nil
    }

    // MARK: - Audio + haptics

    private func startAudioLoop() {
        stopAudioLoop()
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers, .duckOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // non-fatal: alarm sheet still shows
        }

        // Use a system alarm sound — reliable without bundling assets.
        let soundID: SystemSoundID = 1304 // "Alarm" system sound
        var iteration = 0
        let playOnce: () -> Void = { [weak self] in
            guard self?.activeAlarm != nil, iteration < 6 else {
                self?.stopAudioLoop()
                return
            }
            iteration += 1
            AudioServicesPlaySystemSound(soundID)
        }
        playOnce()
        audioTimer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { _ in playOnce() }
    }

    private var audioTimer: Timer?

    private func stopAudioLoop() {
        audioTimer?.invalidate()
        audioTimer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func startHaptics() {
        let haptic = UIImpactFeedbackGenerator(style: .heavy)
        haptic.prepare()
        haptic.impactOccurred()
        hapticTimer = Timer.scheduledTimer(withTimeInterval: 1.6, repeats: true) { _ in
            haptic.impactOccurred()
        }
    }

    private func scheduleLocalNotification(for alarm: Alarm) {
        guard notificationsAuthorized else { return }
        let content = UNMutableNotificationContent()
        content.title = alarm.title
        content.body = alarm.detail
        content.sound = .defaultCritical
        content.interruptionLevel = .timeSensitive
        content.relevanceScore = 1.0
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1.5, repeats: false)
        let request = UNNotificationRequest(identifier: alarm.id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - Notification presentation (foreground)

extension AlarmManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list, .badge])
    }
}

// MARK: - Alarm model

struct Alarm: Identifiable {
    enum Kind {
        case approvalRequired
        case scoutSignal
    }

    let id: String
    let kind: Kind
    let title: String
    let detail: String
    let dueAt: Date?
    let findingTitle: String?
}
