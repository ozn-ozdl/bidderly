// Geographic helpers for the Insights surface. The fixture data carries
// human-readable locations ("Munich, Bavaria", "Berlin", …); this module
// resolves them to coordinates and projects them onto a simple DACH-region
// SVG, plus computes distance from a configurable "home base".

export type LatLng = { lat: number; lng: number };

/// The Bidderly "home base" — the DACH sales office used as the origin for
/// distance calculations. In a real deployment this would come from the
/// signed-in user's profile (office location).
export const HOME_BASE: LatLng = { lat: 48.1351, lng: 11.5820 }; // Munich

/// A small lookup of locations the demo data references. Extend as new
/// cities appear in the snapshot. The keys are matched by substring so
/// "Munich, Bavaria" and "Munich" both resolve to the Munich pin.
const LOCATION_COORDS: Record<string, LatLng> = {
  "Munich": { lat: 48.1351, lng: 11.5820 },
  "Berlin": { lat: 52.52, lng: 13.405 },
  "Hamburg": { lat: 53.5511, lng: 9.9937 },
  "Cologne": { lat: 50.9375, lng: 6.9603 },
  "European Union": { lat: 50.85, lng: 4.35 },
};

export function coordsForLocation(location: string | undefined | null): LatLng | null {
  if (!location) return null;
  const trimmed = location.trim();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (trimmed === key || trimmed.startsWith(`${key},`) || trimmed.includes(key)) {
      return coords;
    }
  }
  return null;
}

/// Great-circle distance in kilometres (Haversine).
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Map projection — fit the DACH region into an SVG viewBox.

const BOUNDS = { minLat: 46.5, maxLat: 55.5, minLng: 4.5, maxLng: 16.5 };

export const MAP_VIEW = { width: 400, height: 280 };

export function project(coords: LatLng): { x: number; y: number } {
  const x = ((coords.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * MAP_VIEW.width;
  const y =
    ((BOUNDS.maxLat - coords.lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * MAP_VIEW.height;
  return { x, y };
}

/// Format a distance as "584 km" or "1.2k km" for far points.
export function formatDistance(km: number): string {
  if (km < 10) return `${Math.round(km)} km`;
  if (km < 1000) return `${Math.round(km)} km`;
  return `${(km / 1000).toFixed(1)}k km`;
}

/// Parse a value band like "EUR 2M-3M" or "EUR 10M+" into a numeric lower
/// bound in millions of euros. Returns null when the band can't be parsed.
export function parseValueBandM(valueBand: string | undefined | null): number | null {
  if (!valueBand) return null;
  const m = valueBand.match(/(\d+(?:\.\d+)?)\s*M/i);
  return m ? Number(m[1]) : null;
}

/// Bucket for the value distribution chart.
export type ValueBucket = "Under 2M" | "2–5M" | "5–10M" | "10M+";

export function bucketForValue(m: number | null): ValueBucket {
  if (m == null) return "Under 2M";
  if (m < 2) return "Under 2M";
  if (m < 5) return "2–5M";
  if (m < 10) return "5–10M";
  return "10M+";
}

export const VALUE_BUCKETS: ValueBucket[] = ["Under 2M", "2–5M", "5–10M", "10M+"];
