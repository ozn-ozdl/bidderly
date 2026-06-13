//
//  BidderlyApp.swift
//  Bidderly
//
//  Created by Ozan Özdil on 13.06.26.
//

import SwiftUI
import ClerkKit
import ClerkKitUI

@main
struct BidderlyApp: App {
    @State private var alarm = AlarmManager()
    @State private var radar = RadarClient()
    private let clerk: Clerk

    init() {
        clerk = Clerk.configure(publishableKey: AppConfig.clerkPublishableKey)
        ApprovalActions.shared.client = radar
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(clerk)
                .environment(radar)
                .environment(alarm)
        }
    }
}

struct RootView: View {
    @Environment(Clerk.self) private var clerk

    var body: some View {
        Group {
            if clerk.user != nil {
                MainTabView()
            } else {
                AuthGate()
            }
        }
        .task {
            // Best-effort client warm-up so session/user state is current.
            _ = try? await clerk.refreshClient()
        }
    }
}

/// The Clerk iOS SDK ships a full-screen SwiftUI `AuthView` that handles sign-in,
/// sign-up, email-code verification, OAuth (incl. Sign in with Apple), MFA, and
/// password reset. We present it non-dismissible until a session exists.
struct AuthGate: View {
    var body: some View {
        ZStack {
            AppTheme.gradient.ignoresSafeArea()
            VStack {
                Spacer().frame(height: 60)
                VStack(spacing: 8) {
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .font(.system(size: 38, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Bidderly.win").font(.title2.weight(.bold)).foregroundStyle(.white)
                    Text("Opportunity radar")
                        .font(.caption.weight(.semibold))
                        .textCase(.uppercase)
                        .foregroundStyle(.white.opacity(0.8))
                        .monospaced()
                }
                Spacer()
            }
        }
        .overlay {
            AuthView(mode: .signInOrUp, isDismissible: false)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .shadow(color: .black.opacity(0.2), radius: 20, y: 10)
        }
    }
}
