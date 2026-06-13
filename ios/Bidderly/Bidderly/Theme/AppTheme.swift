import SwiftUI

/// Brand palette mirroring the web dashboard (#0d3b46 deep teal + amber alerts).
enum AppTheme {
    static let deepTeal = Color(red: 0.051, green: 0.231, blue: 0.275)     // #0d3b46
    static let teal = Color(red: 0.141, green: 0.510, blue: 0.529)
    static let teal50 = Color(red: 0.941, green: 0.984, blue: 0.969)
    static let amberAlert = Color(red: 0.937, green: 0.612, blue: 0.165)
    static let slateInk = Color(red: 0.043, green: 0.090, blue: 0.141)
    static let slateMuted = Color(red: 0.396, green: 0.443, blue: 0.510)
    static let slateBackground = Color(red: 0.965, green: 0.973, blue: 0.984)
    static let surfaceCard = Color.white
    static let success = Color(red: 0.129, green: 0.612, blue: 0.388)
    static let danger = Color(red: 0.812, green: 0.247, blue: 0.247)

    static let gradient = LinearGradient(
        colors: [deepTeal, teal],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let cardStyle = RoundedRectangle(cornerRadius: 16, style: .continuous)
}

extension View {
    func cardStyle(padding: CGFloat = 16) -> some View {
        self.padding(padding)
            .background(AppTheme.surfaceCard)
            .clipShape(AppTheme.cardStyle)
            .shadow(color: Color.black.opacity(0.05), radius: 8, y: 3)
    }
}
