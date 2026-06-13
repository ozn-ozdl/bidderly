import Foundation

/// App-level configuration.
///
/// Set these values from your environment / Clerk dashboard before shipping:
///
/// - `clerkPublishableKey`: the **publishable** key (`pk_test_…` / `pk_live_…`) from
///   your Clerk dashboard → API Keys. Never put your Clerk *secret* key in the app —
///   secrets must stay server-side.
/// - `apiBaseURL`: the Next.js backend (`NEXT_PUBLIC_APP_URL`).
/// - `realtimeBaseURL`: the separate realtime service.
///
/// If Info.plist values exist they win, so you can override without editing this file.
nonisolated enum AppConfig {
    static let clerkPublishableKey: String = plist("CLERK_PUBLISHABLE_KEY")
        ?? "pk_test_YnJhdmUtemVicmEtODUuY2xlcmsuYWNjb3VudHMuZGV2JA"

    static let apiBaseURL: URL = URL(string: plist("API_BASE_URL") ?? "https://bidderly.win")!

    static let realtimeBaseURL: URL = URL(string: plist("REALTIME_BASE_URL") ?? "wss://bidderly-realtime-production.up.railway.app")!

    private static func plist(_ key: String) -> String? {
        // Xcode's auto-generated Info.plist preserves the original case of
        // INFOPLIST_KEY_* values, so a direct lookup works.
        let value = Bundle.main.object(forInfoDictionaryKey: key) as? String
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed?.isEmpty == false ? trimmed : nil
    }
}
