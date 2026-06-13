import SwiftUI
import UIKit

/// Brand palette with full light/dark mode support. Neutrals and text are
/// built on `UIColor(dynamicProvider:)` so they auto-adapt to the system
/// colour scheme; brand accents (teal, amber, success, danger, gradient)
/// stay consistent.
enum AppTheme {
    // MARK: - Brand accents (fixed across modes)

    static let deepTeal = Color(red: 0.051, green: 0.231, blue: 0.275)   // #0d3b46
    static let teal     = Color(red: 0.141, green: 0.510, blue: 0.529)
    static let amberAlert = Color(red: 0.937, green: 0.612, blue: 0.165)
    static let success  = Color(red: 0.129, green: 0.612, blue: 0.388)
    static let danger   = Color(red: 0.812, green: 0.247, blue: 0.247)

    // MARK: - Adaptive neutrals & text

    private static func adaptive(_ light: UIColor, _ dark: UIColor) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark ? dark : light
        })
    }

    /// Page background.
    static let slateBackground: Color = adaptive(
        UIColor(red: 0.965, green: 0.973, blue: 0.984, alpha: 1),
        UIColor(red: 0.043, green: 0.051, blue: 0.078, alpha: 1)
    )

    /// Card / elevated surface.
    static let surfaceCard: Color = adaptive(
        .white,
        UIColor(red: 0.090, green: 0.106, blue: 0.137, alpha: 1)
    )

    /// Primary text.
    static let slateInk: Color = adaptive(
        UIColor(red: 0.043, green: 0.090, blue: 0.141, alpha: 1),
        UIColor(red: 0.910, green: 0.918, blue: 0.929, alpha: 1)
    )

    /// Secondary / tertiary text.
    static let slateMuted: Color = adaptive(
        UIColor(red: 0.396, green: 0.443, blue: 0.510, alpha: 1),
        UIColor(red: 0.580, green: 0.600, blue: 0.643, alpha: 1)
    )

    // MARK: - Composed

    static let gradient = LinearGradient(
        colors: [deepTeal, teal],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let cardStyle = RoundedRectangle(cornerRadius: 16, style: .continuous)
}

extension View {
    @ViewBuilder
    func cardStyle(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(AppTheme.surfaceCard)
            .clipShape(AppTheme.cardStyle)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5)
            )
            .shadow(color: Color.primary.opacity(0.06), radius: 6, y: 2)
    }
}
