import SwiftUI

/// Fullscreen, pulsing alarm sheet surfaced when `AlarmManager.activeAlarm != nil`.
/// Mirrors the web's `ForegroundAlert` but tuned for mobile: bigger touch targets,
/// live countdown to the due-at, and the option to dismiss or act now.
struct AlarmSheet: View {
    let alarm: Alarm
    let onApprove: () -> Void
    let onNeedsInfo: () -> Void
    let onDismiss: () -> Void

    @State private var pulse = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .transition(.opacity)

            VStack {
                Spacer()
                VStack(spacing: 0) {
                    // Header
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color.white.opacity(0.2))
                                .frame(width: 40, height: 40)
                                .scaleEffect(pulse ? 1.18 : 1)
                                .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)
                            Image(systemName: "bell.badge.fill")
                                .foregroundStyle(.white)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(alarm.kind == .approvalRequired ? "Approval needed" : "Critical signal")
                                .font(.headline)
                                .foregroundStyle(.white)
                            Text("Foreground alarm")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.white.opacity(0.8))
                                .monospaced()
                                .textCase(.uppercase)
                        }
                        Spacer()
                        Button(action: onDismiss) {
                            Image(systemName: "xmark")
                                .foregroundStyle(.white)
                                .padding(8)
                                .background(Color.white.opacity(0.18), in: Circle())
                        }
                        .accessibilityLabel("Dismiss alarm")
                    }
                    .padding()
                    .background(AppTheme.amberAlert)

                    // Body
                    VStack(alignment: .leading, spacing: 12) {
                        if let finding = alarm.findingTitle {
                            Text(finding)
                                .font(.system(size: 12, weight: .semibold))
                                .appMuted()
                                .textCase(.uppercase)
                        }
                        Text(alarm.title)
                            .font(.title3.weight(.semibold))
                            .appInk()
                        Text(alarm.detail)
                            .font(.subheadline)
                            .appMuted()
                            .fixedSize(horizontal: false, vertical: true)

                        if let due = alarm.dueAt {
                            DueCountdownRow(dueAt: due)
                        }

                        HStack(spacing: 10) {
                            Button(action: onApprove) {
                                Label("Approve", systemImage: "checkmark.circle.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(AppTheme.slateInk, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .foregroundStyle(.white)
                            }
                            Button(action: onNeedsInfo) {
                                Label("Request info", systemImage: "questionmark.circle")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(Color.gray.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    .appInk()
                            }
                        }
                    }
                    .padding()
                }
                .appSurface()
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(.horizontal, 24)
                .padding(.bottom, 36)
            }
        }
        .onAppear { pulse = true }
    }
}

private struct DueCountdownRow: View {
    let dueAt: Date

    var body: some View {
        let remaining = dueAt.timeIntervalSinceNow
        let overdue = remaining < 0
        let magnitude = abs(remaining)
        HStack(spacing: 6) {
            Image(systemName: overdue ? "exclamationmark.triangle.fill" : "clock.fill")
                .foregroundStyle(overdue ? AppTheme.danger : AppTheme.amberAlert)
            Text(overdue
                 ? "Overdue — \(formatted(magnitude)) ago"
                 : "Action due in \(formatted(magnitude))")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(overdue ? AppTheme.danger : AppTheme.amberAlert)
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background((overdue ? AppTheme.danger : AppTheme.amberAlert).opacity(0.1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func formatted(_ seconds: TimeInterval) -> String {
        let interval = Int(seconds)
        let h = interval / 3600
        let m = (interval % 3600) / 60
        if h > 0 { return "\(h)h \(m)m" }
        if m > 0 { return "\(m)m" }
        return "<1m"
    }
}

#if DEBUG
#Preview("AlarmSheet · pending approval") {
    let approval = PreviewSupport.snapshot.approvals.first { $0.status == .pending }!
    let alarm = Alarm(
        id: approval.id,
        kind: .approvalRequired,
        title: approval.title,
        detail: approval.requestedAction,
        dueAt: ISO8601DateFormatter().date(from: approval.dueAt),
        findingId: approval.findingId,
        findingTitle: PreviewSupport.snapshot.findings.first { $0.id == approval.findingId }?.title
    )
    ZStack {
        AppTheme.slateBackground.ignoresSafeArea()
        AlarmSheet(
            alarm: alarm,
            onApprove: {},
            onNeedsInfo: {},
            onDismiss: {}
        )
    }
    .previewEnvironments()
}
#endif
