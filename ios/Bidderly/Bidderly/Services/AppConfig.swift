import Foundation

/// App-level configuration.
///
/// Set these values from your environment / Clerk dashboard before shipping:
///
/// - `clerkPublishableKey`: the **publishable** key (`pk_test_…` / `pk_live_…`) from
///   your Clerk dashboard → API Keys. Never put your Clerk *secret* key in the app —
///   secrets must stay server-side.
/// - `apiBaseURL`: the Next.js backend (`NEXT_PUBLIC_APP_URL`). In dev, point this at
///   `http://localhost:3000`. In production, `https://bidderly.win`.
/// - `bearerToken`: optional. Used only if you protect `/api/*` with a bearer check
///   (e.g. `SCOUT_CRON_SECRET` on the cron route). Leave `nil` for fixture/demo mode.
///
/// If Info.plist values exist they win, so you can override without editing this file.
nonisolated enum AppConfig {
    static let clerkPublishableKey: String = plist("CLERK_PUBLISHABLE_KEY")
        ?? "pk_test_REPLACE_ME_WITH_YOUR_CLERK_PUBLISHABLE_KEY"

    static let apiBaseURL: URL = URL(string: plist("API_BASE_URL") ?? "http://localhost:3000")!

    static let bearerToken: String? = plist("API_BEARER_TOKEN").flatMap { $0.isEmpty ? nil : $0 }

    private static func plist(_ key: String) -> String? {
        // Xcode's auto-generated Info.plist preserves the original case of
        // INFOPLIST_KEY_* values, so a direct lookup works.
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }
}
