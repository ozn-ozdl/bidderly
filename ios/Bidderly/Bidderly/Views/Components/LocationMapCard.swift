import SwiftUI
import MapKit

/// Apple Maps card for a single tender. Shows the tender pin and the Bidderly
/// home base, a polyline between them, and the great-circle distance. The
/// map zooms to fit both annotations and picks the standard system style
/// (light or dark) automatically.
struct LocationMapCard: View {
    let title: String
    let location: String
    let homeLabel: String

    init(title: String, location: String, homeLabel: String = "Bidderly HQ · Munich") {
        self.title = title
        self.location = location
        self.homeLabel = homeLabel
    }

    private var home: LatLng { Geo.homeBase }
    private var tender: LatLng? { Geo.coords(for: location) }

    private var distanceKm: Double? {
        tender.map { Geo.distanceKm(home, $0) }
    }

    private var region: MKCoordinateRegion {
        guard let tender else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: home.lat, longitude: home.lng),
                span: MKCoordinateSpan(latitudeDelta: 8, longitudeDelta: 10)
            )
        }
        let center = CLLocationCoordinate2D(
            latitude: (home.lat + tender.lat) / 2,
            longitude: (home.lng + tender.lng) / 2
        )
        let latSpan = max(1.5, abs(home.lat - tender.lat) * 1.8 + 0.5)
        let lngSpan = max(1.5, abs(home.lng - tender.lng) * 1.8 + 0.5)
        return MKCoordinateRegion(
            center: center,
            span: MKCoordinateSpan(latitudeDelta: latSpan, longitudeDelta: lngSpan)
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label("Location", systemImage: "mappin.and.ellipse")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                if let distanceKm {
                    Text("\(Geo.formatDistance(distanceKm)) from \(homeLabel)")
                        .font(.caption2.monospaced())
                        .foregroundStyle(AppTheme.slateMuted)
                }
            }
            Text(location)
                .font(.subheadline)
                .foregroundStyle(AppTheme.slateInk)

            if let tender {
                Map(initialPosition: .region(region), interactionModes: [.pan, .zoom]) {
                    Annotation(homeLabel, coordinate: CLLocationCoordinate2D(latitude: home.lat, longitude: home.lng)) {
                        HomePin()
                    }
                    .annotationTitles(.hidden)

                    Annotation(title, coordinate: CLLocationCoordinate2D(latitude: tender.lat, longitude: tender.lng)) {
                        TenderPin()
                    }
                    .annotationTitles(.hidden)

                    MapPolyline(coordinates: [
                        CLLocationCoordinate2D(latitude: home.lat, longitude: home.lng),
                        CLLocationCoordinate2D(latitude: tender.lat, longitude: tender.lng),
                    ])
                    .stroke(AppTheme.teal.opacity(0.7), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [4, 4]))
                }
                .mapStyle(.standard(elevation: .realistic))
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                Text("No coordinates for this location.")
                    .font(.caption)
                    .foregroundStyle(AppTheme.slateMuted)
                    .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
            }
        }
        .cardStyle()
    }
}

private struct HomePin: View {
    var body: some View {
        ZStack {
            Circle().fill(.white).frame(width: 22, height: 22)
            Circle().stroke(AppTheme.deepTeal, lineWidth: 2).frame(width: 22, height: 22)
            Image(systemName: "building.2.fill")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(AppTheme.deepTeal)
        }
        .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
    }
}

private struct TenderPin: View {
    var body: some View {
        ZStack {
            Circle().fill(AppTheme.amberAlert).frame(width: 22, height: 22)
            Circle().stroke(.white, lineWidth: 2).frame(width: 22, height: 22)
            Image(systemName: "mappin")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
        }
        .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
    }
}
