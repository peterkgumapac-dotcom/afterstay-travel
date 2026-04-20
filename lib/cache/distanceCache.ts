import { haversine } from '@/lib/distance';

// In-memory cache — distances are pure math (no network), so memory-only is fine.
// Hotel and place coordinates don't change, so cache lives for the app session.
const cache = new Map<string, number>();

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
