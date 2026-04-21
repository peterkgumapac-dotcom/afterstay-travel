// In-memory cache for haversine distances.
// Haversine is inlined here to avoid circular dependency with lib/distance.ts.
const cache = new Map<string, number>();

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function cachedHaversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const key = `${lat1.toFixed(5)},${lng1.toFixed(5)},${lat2.toFixed(5)},${lng2.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const km = haversine(lat1, lng1, lat2, lng2);
  cache.set(key, km);
  return km;
}
