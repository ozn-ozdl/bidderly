import Foundation

@MainActor
final class RadarClient: ObservableObject {
    @Published var snapshot: RadarSnapshot?
    @Published var errorMessage: String?

    var baseURL = URL(string: "http://localhost:3000")!

    func refresh() async {
        do {
            let url = baseURL.appending(path: "/api/radar")
            let (data, _) = try await URLSession.shared.data(from: url)
            snapshot = try JSONDecoder().decode(RadarSnapshot.self, from: data)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
