import { CONFIG } from './config';

export const haversine = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Cache hotel→place distances (static — hotel and places don't move)
const hotelDistanceCache = new Map<string, number>();

export const distanceFromHotel = (lat: number, lng: number): number => {
  const key = `${lat},${lng}`;
  const cached = hotelDistanceCache.get(key);
  if (cached !== undefined) return cached;
  const km = haversine(CONFIG.HOTEL_COORDS.lat, CONFIG.HOTEL_COORDS.lng, lat, lng);
  hotelDistanceCache.set(key, km);
  return km;
};

export const distanceFromPoint = (
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): number => {
  return haversine(fromLat, fromLng, toLat, toLng);
};

export const formatDistance = (km: number): string => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

export const estimateWalkTime = (km: number): string => {
  const minutes = Math.round((km / 4.5) * 60);
  if (minutes < 60) return `${minutes} min walk`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m walk`;
};

