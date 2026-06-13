# iOS Companion Scaffold

The hackathon demo targets foreground alerts rather than locked-screen push. The SwiftUI files in `ios/BidderlyRadarDemo/` show the companion app shape:

- Clerk-style sign-in gate.
- Radar summary from `GET /api/radar`.
- Pending approval inbox.
- Opportunity detail list.
- Foreground alert when an approval request is pending.

For a production iOS target:

1. Create an iOS app in Xcode named `BidderlyRadarDemo`.
2. Add Clerk's iOS SDK through Swift Package Manager.
3. Replace the demo `isSignedIn` state in `ContentView.swift` with Clerk session state.
4. Set `RadarClient.baseURL` to the Railway app URL.
5. For live foreground updates, bridge `GET /api/events` through a small SSE client or poll `/api/radar` every 15-30 seconds while the app is active.

Locked-screen push is intentionally out of scope for the current demo because the alert rule is product-specific: only alert when Gemma routes `human_review` or Gemini identifies a blocker requiring user input.
