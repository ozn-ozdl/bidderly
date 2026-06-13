import SwiftUI

/// Brand palette + adaptive modifiers. Brand accents are fixed; the neutrals
/// and text adapt to the system colour scheme via `.appInk()` / `.appMuted()`
/// / `.appBackground()` view modifiers that read `@Environment(\.colorScheme)`.
/// `cardStyle()` also picks the right surface colour for the current mode.
enum AppTheme {
    // MARK: - Brand accents (fixed across modes)

    static let deepTeal = Color(red: 0.051, green: 0.231, blue: 0.275)   // #0d3b46
    static let teal     = Color(red: 0.141, green: 0.510, blue: 0.529)
    static let amberAlert = Color(red: 0.937, green: 0.612, blue: 0.165)
    static let success  = Color(red: 0.129, green: 0.612, blue: 0.388)
    static let danger   = Color(red: 0.812, green: 0.247, blue: 0.247)

    // MARK: - Light-mode (default) neutrals

    /// Page background.
    static let slateBackground = Color(red: 0.965, green: 0.973, blue: 0.984)
    /// Card / elevated surface.
    static let surfaceCard = Color.white
    /// Primary text.
    static let slateInk    = Color(red: 0.043, green: 0.090, blue: 0.141)
    /// Secondary text.
    static let slateMuted  = Color(red: 0.396, green: 0.443, blue: 0.510)

    // MARK: - Composed

    static let gradient = LinearGradient(
        colors: [deepTeal, teal],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let cardStyle = RoundedRectangle(cornerRadius: 16, style: .continuous)
}

/// Dark-mode counterparts. Used by the `.app*()` modifiers below.
enum AppThemeDark {
    static let surfaceCard     = Color(red: 0.090, green: 0.106, blue: 0.137)
    static let slateBackground = Color(red: 0.043, green: 0.051, blue: 0.078)
    static let slateInk        = Color(red: 0.910, green: 0.918, blue: 0.929)
    static let slateMuted      = Color(red: 0.580, green: 0.600, blue: 0.643)
}

// MARK: - Adaptive modifiers

private struct AppInkStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content.foregroundStyle(scheme == .dark ? AppThemeDark.slateInk : AppTheme.slateInk)
    }
}

private struct AppMutedStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content.foregroundStyle(scheme == .dark ? AppThemeDark.slateMuted : AppTheme.slateMuted)
    }
}

private struct AppBackgroundStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content.background(scheme == .dark ? AppThemeDark.slateBackground : AppTheme.slateBackground)
    }
}

private struct AppSurfaceStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View {
        content.background(scheme == .dark ? AppThemeDark.surfaceCard : AppTheme.surfaceCard)
    }
}

private struct AppCardStyle: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    let padding: CGFloat
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(scheme == .dark ? AppThemeDark.surfaceCard : AppTheme.surfaceCard)
            .clipShape(AppTheme.cardStyle)
            .overlay(
                AppTheme.cardStyle
                    .strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5)
            )
            .shadow(color: Color.primary.opacity(0.06), radius: 6, y: 2)
    }
}

extension View {
    /// Primary text colour. Adapts to the system colour scheme.
    func appInk() -> some View { modifier(AppInkStyle()) }
    /// Secondary / muted text colour. Adapts to the system colour scheme.
    func appMuted() -> some View { modifier(AppMutedStyle()) }
    /// Page background. Adapts to the system colour scheme.
    func appBackground() -> some View { modifier(AppBackgroundStyle()) }
    /// Elevated card surface. Adapts to the system colour scheme. Pair with
    /// `.clipShape(AppTheme.cardStyle)` for a rounded card.
    func appSurface() -> some View { modifier(AppSurfaceStyle()) }
    /// Card surface (adaptive background + hairline + shadow).
    func cardStyle(padding: CGFloat = 16) -> some View {
        modifier(AppCardStyle(padding: padding))
    }
}
