import { getPlaceLocation, placeAutocomplete, searchPlace } from '@/lib/google-places';
import {
  isBroadOriginQuery,
  isVagueOriginQuery,
  originRefinementCopy,
  vagueOriginCopy,
} from './screenConfig';

type Coords = { lat: number; lng: number };

type ResolvedOrigin =
  | { status: 'ok'; label: string; coords: Coords; refinementText?: string }
  | { status: 'needs_refinement'; message: string };

const ORIGIN_NOT_FOUND_COPY =
  'Could not find that exact place. Search a hotel, address, station, landmark, neighborhood, or exact pin.';

async function geocodeWithExpo(query: string, label: string): Promise<(Coords & { name: string }) | null> {
  const Location = await import('expo-location');
  const geocoded = await Location.geocodeAsync(query).catch(() => []);
  const first = geocoded[0];
  if (!first) return null;
  return { name: label, lat: first.latitude, lng: first.longitude };
}

async function geocodeWithNominatim(query: string, label: string): Promise<(Coords & { name: string }) | null> {
  const params = new URLSearchParams({ format: 'json', limit: '1', q: query });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AfterStay/1.3.0',
    },
  }).catch(() => null);
  const data = res?.ok ? await res.json().catch(() => []) : [];
  const first = Array.isArray(data) ? data[0] : null;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { name: label, lat, lng };
}

export async function resolveExploreOriginInput(label: string, placeId?: string): Promise<ResolvedOrigin> {
  const cleaned = label.trim();
  if (!cleaned) return { status: 'needs_refinement', message: ORIGIN_NOT_FOUND_COPY };
  if (isVagueOriginQuery(cleaned)) {
    return { status: 'needs_refinement', message: vagueOriginCopy(cleaned) };
  }

  const isBroadQuery = isBroadOriginQuery(cleaned);
  const best = placeId ? { placeId, description: cleaned } : (await placeAutocomplete(cleaned))[0];
  if (isBroadQuery && !best) {
    return { status: 'needs_refinement', message: originRefinementCopy(cleaned) };
  }

  const query = best?.description ?? cleaned;
  const shortLabel = best?.description.split(',')[0] ?? cleaned;
  let loc = best ? await getPlaceLocation(best.placeId) : null;
  if (!loc) {
    const fallback = await searchPlace(query);
    if (fallback && fallback.lat != null && fallback.lng != null) {
      loc = { name: fallback.name, lat: fallback.lat, lng: fallback.lng };
    }
  }
  loc = loc ?? await geocodeWithExpo(query, shortLabel);
  loc = loc ?? await geocodeWithNominatim(query, shortLabel);

  if (!loc) return { status: 'needs_refinement', message: ORIGIN_NOT_FOUND_COPY };
  return {
    status: 'ok',
    label: shortLabel,
    coords: { lat: loc.lat, lng: loc.lng },
    refinementText: isBroadQuery
      ? `${shortLabel} is broad. For sharper results, change this to a hotel, station, landmark, neighborhood, or exact pin.`
      : undefined,
  };
}

export async function resolveCurrentLocationOrigin(): Promise<ResolvedOrigin> {
  const Location = await import('expo-location');
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return {
      status: 'needs_refinement',
      message: 'Enable location permission or search an exact place to find recommendations.',
    };
  }

  const loc = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.LocationAccuracy.Balanced }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
  ]) ?? await Location.getLastKnownPositionAsync({
    maxAge: 10 * 60 * 1000,
    requiredAccuracy: 5000,
  });
  if (!loc) {
    return {
      status: 'needs_refinement',
      message: 'Current location is unavailable. Search an exact place instead.',
    };
  }

  const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
  const geocoded = await Location.reverseGeocodeAsync({
    latitude: coords.lat,
    longitude: coords.lng,
  }).catch(() => []);
  const first = geocoded[0];
  const readableLocation = [
    first?.city || first?.district || first?.subregion,
    first?.region,
  ].filter(Boolean).join(', ');

  return {
    status: 'ok',
    coords,
    label: readableLocation ? `Current location · ${readableLocation}` : 'Current location',
    refinementText: 'Using device GPS. If this area looks wrong, tap Change and search a hotel, landmark, area, or exact pin.',
  };
}
