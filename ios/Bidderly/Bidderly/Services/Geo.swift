import Foundation

/// Geographic helpers for the Insights surface. Mirrors src/lib/geo.ts.

struct LatLng: Hashable {
    let lat: Double
    let lng: Double
}

enum Geo {
    /// The Bidderly "home base" — origin for distance calculations.
    static let homeBase = LatLng(lat: 48.1351, lng: 11.5820) // Munich

    private static let locationCoords: [String: LatLng] = [
        "Munich": LatLng(lat: 48.1351, lng: 11.5820),
        "Berlin": LatLng(lat: 52.52, lng: 13.405),
        "Hamburg": LatLng(lat: 53.5511, lng: 9.9937),
        "Cologne": LatLng(lat: 50.9375, lng: 6.9603),
        "European Union": LatLng(lat: 50.85, lng: 4.35),
    ]

    static func coords(for location: String?) -> LatLng? {
        guard let location, !location.isEmpty else { return nil }
        for (key, coords) in locationCoords {
            if location == key || location.hasPrefix("\(key),") || location.contains(key) {
                return coords
            }
        }
        return nil
    }

    /// Great-circle distance in kilometres (Haversine).
    static func distanceKm(_ a: LatLng, _ b: LatLng) -> Double {
        let R = 6371.0
        let toRad = { (deg: Double) in deg * .pi / 180.0 }
        let dLat = toRad(b.lat - a.lat)
        let dLng = toRad(b.lng - a.lng)
        let lat1 = toRad(a.lat)
        let lat2 = toRad(b.lat)
        let h = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * R * asin(min(1.0, sqrt(h)))
    }

    static func formatDistance(_ km: Double) -> String {
        if km < 1000 { return "\(Int(km.rounded())) km" }
        return String(format: "%.1fk km", km / 1000.0)
    }
}
