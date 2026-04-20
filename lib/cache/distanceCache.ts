import { storage } from './storage';
import { haversine } from '@/lib/distance';

const PRECISION = 5;
const PREFIX = 'v1:distance:';

function roundKey(n: number): string {
  return n.toFixed(PRECISION);
}

export function cachedHaversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const key = `${PREFIX}${roundKey(lat1)},${roundKey(lng1)},${roundKey(lat2)},${roundKey(lng2)}`;

  const cached = storage.getString(key);
  if (cached !== undefined) return Number(cached);

  const km = haversine(lat1, lng1, lat2, lng2);
  storage.set(key, km.toString());
  return km;
}
