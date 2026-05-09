// Google Places API client — proxied through Supabase Edge Function.
// The API key is server-side only; client never sees it.

import { supabase } from './supabase';
import { filterRenderableImageUrls, isRenderableRemoteImageUrl } from './imageUrl';

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  address: string;
  rating: number;
  total_ratings: number;
  photo_url: string | null;
  lat: number;
  lng: number;
}

async function callProxy<T>(action: string, payload: Record<string, unknown>): Promise<T | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    if (__DEV__) console.warn(`[places-proxy] No auth session for action: ${action}`);
    return null;
  }

  try {
    const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/places-proxy`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) {
      if (__DEV__) {
        const body = await res.text().catch(() => '');
        console.warn(`[places-proxy] ${action} failed (${res.status}): ${body}`);
      }
      return null;
    }
    return res.json();
  } catch (err) {
    if (__DEV__) console.warn(`[places-proxy] ${action} error:`, err);
    return null;
  }
}

function osmPlaceId(item: any): string {
  return [
    'osm',
    item.osm_type ?? 'node',
    item.osm_id ?? item.id ?? '0',
    item.lat ?? item.center?.lat ?? 0,
    item.lon ?? item.center?.lon ?? 0,
    encodeURIComponent(item.display_name ?? item.tags?.name ?? ''),
  ].join(':');
}

function parseOsmPlaceId(placeId: string) {
  const parts = String(placeId).split(':');
  if (parts[0] !== 'osm') return null;
  const lat = Number(parts[3]);
  const lng = Number(parts[4]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name: decodeURIComponent(parts.slice(5).join(':')) || 'Selected place',
    lat,
    lng,
  };
}

async function geocodeWithOsm(query: string, limit = 5): Promise<any[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: String(limit),
    q: query.trim(),
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AfterStay/1.3.0 places fallback',
    },
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

function osmSelectorFor(type: string | undefined, keyword: string | undefined): string {
  const haystack = `${type ?? ''} ${keyword ?? ''}`.toLowerCase();
  if (type === 'restaurant' || haystack.includes('food') || haystack.includes('dinner')) {
    return '["amenity"~"restaurant|fast_food|food_court"]';
  }
  if (type === 'cafe' || haystack.includes('coffee')) return '["amenity"="cafe"]';
  if (type === 'bar' || haystack.includes('nightlife')) return '["amenity"~"bar|pub|nightclub"]';
  if (type === 'atm' || haystack.includes('atm')) return '["amenity"="atm"]';
  if (type === 'store' || haystack.includes('shopping')) return '["shop"]';
  if (type === 'spa' || haystack.includes('wellness') || haystack.includes('massage')) {
    return '["shop"~"massage|beauty"]';
  }
  if (type === 'lodging' || haystack.includes('hotel') || haystack.includes('resort')) {
    return '["tourism"~"hotel|resort|guest_house"]';
  }
  if (haystack.includes('beach')) return '["natural"="beach"]';
  if (type === 'tourist_attraction' || haystack.includes('activity') || haystack.includes('tour') || haystack.includes('landmark')) {
    return '["tourism"~"attraction|viewpoint|theme_park|information"]';
  }
  return '["name"]';
}

function toNearbyOsmPlace(item: any): NearbyPlace | null {
  const tags = item.tags ?? {};
  const lat = Number(item.lat ?? item.center?.lat);
  const lng = Number(item.lon ?? item.center?.lon);
  const name = tags.name ?? tags.brand;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const category = tags.amenity ?? tags.tourism ?? tags.shop ?? tags.natural ?? 'place';
  const address = [
    tags['addr:street'],
    tags['addr:barangay'],
    tags['addr:city'],
    tags['addr:province'],
  ].filter(Boolean).join(', ');
  return {
    place_id: osmPlaceId({ ...item, lat, lon: lng, display_name: name }),
    name,
    rating: 0,
    total_ratings: 0,
    address,
    lat,
    lng,
    open_now: undefined,
    photo_url: null,
    photo_urls: [],
    types: [category].filter(Boolean),
  };
}

async function searchNearbyWithOsm(
  coords: { lat: number; lng: number },
  radius: number,
  type?: string,
  keyword?: string,
): Promise<NearbyPlace[]> {
  const safeRadius = Math.min(Math.max(Number(radius) || 5000, 500), 25000);
  const selector = osmSelectorFor(type, keyword);
  const query = `
    [out:json][timeout:12];
    (
      node(around:${safeRadius},${coords.lat},${coords.lng})${selector};
      way(around:${safeRadius},${coords.lat},${coords.lng})${selector};
      relation(around:${safeRadius},${coords.lat},${coords.lng})${selector};
    );
    out center tags 40;
  `;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AfterStay/1.3.0 places fallback',
    },
    body: new URLSearchParams({ data: query }).toString(),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const seen = new Set<string>();
  return (data.elements ?? [])
    .map(toNearbyOsmPlace)
    .filter((place: NearbyPlace | null): place is NearbyPlace => {
      if (!place) return false;
      const key = `${place.name}:${place.lat}:${place.lng}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

async function resolvePhotoUrl(photoRef: string, maxWidth = 800): Promise<string | null> {
  const result = await callProxy<{ url: string }>('photo', { photoReference: photoRef, maxWidth });
  if (isResolvedGooglePhotoUrl(result?.url)) return result.url;
  if (__DEV__ && photoRef) console.warn('[places-proxy] photo resolution returned no renderable URL');
  return null;
}

function isGooglePhotoApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'maps.googleapis.com' && parsed.pathname.includes('/place/photo');
  } catch {
    return false;
  }
}

function isResolvedGooglePhotoUrl(url: string | undefined | null): url is string {
  return isRenderableRemoteImageUrl(url) && !isGooglePhotoApiUrl(url);
}

// Pick the best exterior/place photo — avoid food close-ups and product shots.
function pickBestPhotoRef(photos: any[] | undefined): string | null {
  if (!photos || photos.length === 0) return null;
  const candidates = photos.slice(0, 5);
  const landscape = candidates.find((p: any) => (p.width ?? 0) > (p.height ?? 0));
  const best = landscape ?? photos[0];
  return best?.photo_reference ?? null;
}

async function resolvePhotos(photos: any[] | undefined, count = 1, maxWidth = 1200): Promise<string[]> {
  if (!photos || photos.length === 0) return [];
  const refs = photos
    .slice(0, count)
    .map((p: any) => p.photo_reference)
    .filter(Boolean) as string[];
  const urls = await Promise.all(refs.map((ref) => resolvePhotoUrl(ref, maxWidth)));
  return urls.filter((u): u is string => u !== null);
}

export async function searchPlace(
  query: string,
  location?: string,
): Promise<PlaceSearchResult | null> {
  const fullQuery = location ? `${query} ${location}` : query;
  const data = await callProxy<any>('search', { query: fullQuery });
  let candidate = data?.candidates?.[0];
  if (!candidate) {
    const fallback = await geocodeWithOsm(fullQuery, 1);
    const first = fallback[0];
    if (first) {
      candidate = {
        place_id: osmPlaceId(first),
        name: first.name ?? first.display_name?.split(',')?.[0] ?? query,
        formatted_address: first.display_name ?? '',
        rating: 0,
        user_ratings_total: 0,
        photos: [],
        geometry: { location: { lat: Number(first.lat), lng: Number(first.lon) } },
      };
    }
  }
  if (!candidate) return null;

  const bestRef = pickBestPhotoRef(candidate.photos);
  const photo_url = bestRef ? await resolvePhotoUrl(bestRef, 1200) : null;
  const renderablePhotoUrl = isRenderableRemoteImageUrl(photo_url) ? photo_url : null;

  return {
    place_id: candidate.place_id ?? '',
    name: candidate.name ?? query,
    address: candidate.formatted_address ?? '',
    rating: candidate.rating ?? 0,
    total_ratings: candidate.user_ratings_total ?? 0,
    photo_url: renderablePhotoUrl,
    lat: candidate.geometry?.location?.lat ?? 0,
    lng: candidate.geometry?.location?.lng ?? 0,
  };
}

export async function findPlacePhoto(name: string, location?: string): Promise<string | null> {
  const result = await searchPlace(name, location);
  return result?.photo_url ?? null;
}

export async function fetchDestinationPhotos(
  destination: string,
  count = 6,
): Promise<string[]> {
  if (!destination) return [];
  const collected: string[] = [];
  const queries = [
    `${destination} travel destination`,
    `${destination} landmark`,
    `${destination} beach city skyline`,
    destination,
  ];
  for (const query of queries) {
    const data = await callProxy<any>('search', { query, fields: 'photos' });
    const photos: any[] = data?.candidates?.[0]?.photos ?? [];
    const urls = await resolvePhotos(photos, count, 1200);
    for (const url of urls) {
      if (!isRenderableRemoteImageUrl(url)) continue;
      if (!collected.includes(url)) collected.push(url);
      if (collected.length >= count) return collected;
    }
  }
  return filterRenderableImageUrls(collected);
}

export interface NearbyPlace {
  place_id: string;
  name: string;
  rating: number;
  total_ratings: number;
  price_level?: number;
  business_status?: string;
  address: string;
  lat: number;
  lng: number;
  open_now?: boolean;
  photo_url: string | null;
  photo_reference?: string;
  photo_urls?: string[];
  types: string[];
  editorial_summary?: string;
}

export interface NearbySearchResult {
  places: NearbyPlace[];
  nextPageToken?: string;
  status?: string;
  errorMessage?: string;
}

export interface PlaceDetails {
  name: string;
  rating: number;
  total_ratings?: number;
  formatted_phone_number?: string;
  formatted_address: string;
  opening_hours?: { weekday_text: string[]; open_now?: boolean };
  reviews?: { author_name: string; rating: number; text: string; relative_time_description: string }[];
  photos: string[];
  website?: string;
  url?: string;
  price_level?: number;
  editorial_summary?: string;
  coords?: { lat: number; lng: number };
}

export async function searchNearby(
  type?: string,
  keyword?: string,
  coords?: { lat: number; lng: number },
  radius = 5000,
): Promise<NearbySearchResult> {
  if (!coords) return { places: [] };
  const payload = {
    lat: coords.lat,
    lng: coords.lng,
    radius,
    type,
    keyword,
  };
  const data = await callProxy<any>('nearby', payload);
  if (!data) {
    const fallback = await searchNearbyWithOsm(coords, radius, type, keyword).catch(() => []);
    return fallback.length > 0
      ? { places: fallback, status: 'OK' }
      : { places: [], errorMessage: 'Places service is unavailable. Check your connection and try again.' };
  }
  if (data.status === 'ERROR' || data.error_message) {
    const fallback = await searchNearbyWithOsm(coords, radius, type, keyword).catch(() => []);
    return fallback.length > 0
      ? { places: fallback, status: 'OK' }
      : { places: [], status: data.status, errorMessage: data.error_message ?? 'Could not load places.' };
  }
  if (!data.results) {
    const fallback = await searchNearbyWithOsm(coords, radius, type, keyword).catch(() => []);
    return { places: fallback, status: fallback.length > 0 ? 'OK' : data.status };
  }

  const places: NearbyPlace[] = await Promise.all((data.results as any[]).map(async (place: any) => {
    const photoRef = pickBestPhotoRef(place.photos) ?? undefined;
    const resolvedPhoto = isResolvedGooglePhotoUrl(place.resolved_photo_url)
      ? place.resolved_photo_url
      : (photoRef ? await resolvePhotoUrl(photoRef, 800) : null);
    const photoUrls = [resolvedPhoto].filter(Boolean) as string[];
    return {
      place_id: place.place_id,
      name: place.name,
      rating: place.rating ?? 0,
      total_ratings: place.user_ratings_total ?? 0,
      price_level: place.price_level,
      business_status: place.business_status,
      address: place.vicinity ?? '',
      lat: place.geometry?.location?.lat ?? 0,
      lng: place.geometry?.location?.lng ?? 0,
      open_now: place.opening_hours?.open_now,
      photo_url: photoUrls[0] ?? null,
      photo_reference: photoRef,
      photo_urls: photoUrls,
      types: place.types ?? [],
      editorial_summary: place.editorial_summary ?? undefined,
    };
  }));

  return { places, nextPageToken: data.next_page_token ?? undefined, status: data.status };
}

/** Fetch the next page of nearby results using a page token. */
export async function searchNearbyPage(
  pageToken: string,
): Promise<NearbySearchResult> {
  const payload = { pagetoken: pageToken, lat: 0, lng: 0 };
  const data = await callProxy<any>('nearby', payload);
  if (!data) {
    return { places: [], errorMessage: 'Places service is unavailable. Check your connection and try again.' };
  }
  if (data.status === 'ERROR' || data.error_message) {
    return { places: [], status: data.status, errorMessage: data.error_message ?? 'Could not load more places.' };
  }
  if (!data.results) return { places: [], status: data.status };

  const places: NearbyPlace[] = await Promise.all((data.results as any[]).map(async (place: any) => {
    const photoRef = pickBestPhotoRef(place.photos) ?? undefined;
    const resolvedPhoto = isResolvedGooglePhotoUrl(place.resolved_photo_url)
      ? place.resolved_photo_url
      : (photoRef ? await resolvePhotoUrl(photoRef, 800) : null);
    const photoUrls = [resolvedPhoto].filter(Boolean) as string[];
    return {
      place_id: place.place_id,
      name: place.name,
      rating: place.rating ?? 0,
      total_ratings: place.user_ratings_total ?? 0,
      price_level: place.price_level,
      business_status: place.business_status,
      address: place.vicinity ?? '',
      lat: place.geometry?.location?.lat ?? 0,
      lng: place.geometry?.location?.lng ?? 0,
      open_now: place.opening_hours?.open_now,
      photo_url: photoUrls[0] ?? null,
      photo_reference: photoRef,
      photo_urls: photoUrls,
      types: place.types ?? [],
      editorial_summary: place.editorial_summary ?? undefined,
    };
  }));

  return { places, nextPageToken: data.next_page_token ?? undefined, status: data.status };
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const osmLocation = parseOsmPlaceId(placeId);
  if (osmLocation) {
    return {
      name: osmLocation.name,
      rating: 0,
      total_ratings: 0,
      formatted_address: osmLocation.name,
      photos: [],
      url: `https://www.google.com/maps/search/?api=1&query=${osmLocation.lat},${osmLocation.lng}`,
      coords: { lat: osmLocation.lat, lng: osmLocation.lng },
    };
  }
  const data = await callProxy<any>('details', { placeId });
  const r = data?.result;
  if (!r) return null;

  const photoUrls = await resolvePhotos(r.photos, 6, 600);

  return {
    name: r.name,
    rating: r.rating ?? 0,
    total_ratings: r.user_ratings_total,
    formatted_phone_number: r.formatted_phone_number,
    formatted_address: r.formatted_address ?? '',
    opening_hours: r.opening_hours ? { weekday_text: r.opening_hours.weekday_text ?? [], open_now: r.opening_hours.open_now } : undefined,
    reviews: (r.reviews ?? []).slice(0, 3).map((rv: any) => ({
      author_name: rv.author_name,
      rating: rv.rating,
      text: rv.text,
      relative_time_description: rv.relative_time_description,
    })),
    photos: photoUrls,
    website: r.website,
    url: r.url,
    price_level: r.price_level,
    editorial_summary: r.editorial_summary?.overview,
    coords: typeof r.geometry?.location?.lat === 'number' && typeof r.geometry?.location?.lng === 'number'
      ? { lat: r.geometry.location.lat, lng: r.geometry.location.lng }
      : undefined,
  };
}

export async function getPlaceLocation(placeId: string): Promise<{ name: string; lat: number; lng: number } | null> {
  const osmLocation = parseOsmPlaceId(placeId);
  if (osmLocation) return osmLocation;
  const data = await callProxy<any>('location', { placeId });
  const r = data?.result;
  if (!r?.geometry?.location) return null;
  return {
    name: r.name,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  };
}

// ── Autocomplete ─────────────────────────────────────────────────────────

export interface AutocompleteResult {
  placeId: string;
  description: string;
}

export async function placeAutocomplete(
  input: string,
  locationBias?: { lat: number; lng: number },
): Promise<AutocompleteResult[]> {
  if (!input.trim()) return [];
  try {
    const proxyData = await callProxy<any>('autocomplete', {
      input: input.trim(),
      lat: locationBias?.lat,
      lng: locationBias?.lng,
    });
    const proxyResults = (proxyData?.predictions ?? []).filter((p: any) => p?.place_id && p?.description).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
    }));
    if (proxyResults.length > 0) return proxyResults;
    const fallback = await geocodeWithOsm(input.trim(), 5);
    return fallback.map((item: any) => ({
      placeId: osmPlaceId(item),
      description: item.display_name ?? item.name ?? input.trim(),
    }));
  } catch {
    const fallback = await geocodeWithOsm(input.trim(), 5).catch(() => []);
    return fallback.map((item: any) => ({
      placeId: osmPlaceId(item),
      description: item.display_name ?? item.name ?? input.trim(),
    }));
  }
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string | null> {
  const data = await callProxy<any>('geocode', {
    lat,
    lng,
    resultType: 'point_of_interest|establishment|locality',
  });
  const name = data?.results?.[0]?.formatted_address?.split(',')?.[0]?.trim();
  return name || null;
}
