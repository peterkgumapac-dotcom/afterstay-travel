// Google Places API client — proxied through Supabase Edge Function.
// The API key is server-side only; client never sees it.

import { supabase } from './supabase';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const PUBLIC_PLACES_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ||
  '';

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

async function resolvePhotoUrl(photoRef: string, maxWidth = 800): Promise<string | null> {
  const result = await callProxy<{ url: string }>('photo', { photoReference: photoRef, maxWidth });
  if (result?.url) return result.url;
  if (!PUBLIC_PLACES_KEY) return null;
  const params = new URLSearchParams({
    maxwidth: String(maxWidth),
    photo_reference: photoRef,
    key: PUBLIC_PLACES_KEY,
  });
  return `${PLACES_BASE}/photo?${params.toString()}`;
}

async function directSearch(query: string, fields?: string): Promise<any | null> {
  if (!PUBLIC_PLACES_KEY) return null;
  try {
    const params = new URLSearchParams({
      input: query,
      inputtype: 'textquery',
      fields: fields || 'place_id,name,formatted_address,rating,user_ratings_total,photos,geometry',
      key: PUBLIC_PLACES_KEY,
    });
    const res = await fetch(`${PLACES_BASE}/findplacefromtext/json?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    if (__DEV__) console.warn('[google-places] direct search failed:', err);
    return null;
  }
}

async function directPlaceLocation(placeId: string): Promise<any | null> {
  if (!PUBLIC_PLACES_KEY) return null;
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'name,geometry',
      key: PUBLIC_PLACES_KEY,
    });
    const res = await fetch(`${PLACES_BASE}/details/json?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    if (__DEV__) console.warn('[google-places] direct place location failed:', err);
    return null;
  }
}

async function directAutocomplete(
  input: string,
  locationBias?: { lat: number; lng: number },
): Promise<any | null> {
  if (!PUBLIC_PLACES_KEY) return null;
  try {
    const params = new URLSearchParams({
      input,
      key: PUBLIC_PLACES_KEY,
    });
    if (locationBias) {
      params.set('location', `${locationBias.lat},${locationBias.lng}`);
      params.set('radius', '50000');
    }
    const res = await fetch(`${PLACES_BASE}/autocomplete/json?${params.toString()}`);
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    if (__DEV__) console.warn('[google-places] direct autocomplete failed:', err);
    return null;
  }
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
  const data = await callProxy<any>('search', { query: fullQuery })
    ?? await directSearch(fullQuery);
  const candidate = data?.candidates?.[0];
  if (!candidate) return null;

  const bestRef = pickBestPhotoRef(candidate.photos);
  const photo_url = bestRef ? await resolvePhotoUrl(bestRef, 1200) : null;

  return {
    place_id: candidate.place_id ?? '',
    name: candidate.name ?? query,
    address: candidate.formatted_address ?? '',
    rating: candidate.rating ?? 0,
    total_ratings: candidate.user_ratings_total ?? 0,
    photo_url,
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
  const queries = [
    `${destination} travel destination`,
    `${destination} landmark`,
    `${destination} beach city skyline`,
    destination,
  ];
  for (const query of queries) {
    const data = await callProxy<any>('search', { query, fields: 'photos' })
      ?? await directSearch(query, 'photos');
    const photos: any[] = data?.candidates?.[0]?.photos ?? [];
    const urls = await resolvePhotos(photos, count, 1200);
    if (urls.length > 0) return urls;
  }
  return [];
}

export interface NearbyPlace {
  place_id: string;
  name: string;
  rating: number;
  total_ratings: number;
  price_level?: number;
  address: string;
  lat: number;
  lng: number;
  open_now?: boolean;
  photo_url: string | null;
  types: string[];
  editorial_summary?: string;
}

export interface NearbySearchResult {
  places: NearbyPlace[];
  nextPageToken?: string;
}

export interface PlaceDetails {
  name: string;
  rating: number;
  formatted_phone_number?: string;
  formatted_address: string;
  opening_hours?: { weekday_text: string[] };
  reviews?: { author_name: string; rating: number; text: string; relative_time_description: string }[];
  photos: string[];
  website?: string;
  url?: string;
  price_level?: number;
  editorial_summary?: string;
}

export async function searchNearby(
  type?: string,
  keyword?: string,
  coords?: { lat: number; lng: number },
  radius = 5000,
): Promise<NearbySearchResult> {
  if (!coords) return { places: [] };
  const data = await callProxy<any>('nearby', {
    lat: coords.lat,
    lng: coords.lng,
    radius,
    type,
    keyword,
  });
  if (!data?.results) return { places: [] };

  const places: NearbyPlace[] = (data.results as any[]).map((place: any) => ({
    place_id: place.place_id,
    name: place.name,
    rating: place.rating ?? 0,
    total_ratings: place.user_ratings_total ?? 0,
    price_level: place.price_level,
    address: place.vicinity ?? '',
    lat: place.geometry?.location?.lat ?? 0,
    lng: place.geometry?.location?.lng ?? 0,
    open_now: place.opening_hours?.open_now,
    photo_url: place.resolved_photo_url ?? null,
    types: place.types ?? [],
    editorial_summary: place.editorial_summary ?? undefined,
  }));

  return { places, nextPageToken: data.next_page_token ?? undefined };
}

/** Fetch the next page of nearby results using a page token. */
export async function searchNearbyPage(
  pageToken: string,
): Promise<NearbySearchResult> {
  const data = await callProxy<any>('nearby', { pagetoken: pageToken, lat: 0, lng: 0 });
  if (!data?.results) return { places: [] };

  const places: NearbyPlace[] = (data.results as any[]).map((place: any) => ({
    place_id: place.place_id,
    name: place.name,
    rating: place.rating ?? 0,
    total_ratings: place.user_ratings_total ?? 0,
    price_level: place.price_level,
    address: place.vicinity ?? '',
    lat: place.geometry?.location?.lat ?? 0,
    lng: place.geometry?.location?.lng ?? 0,
    open_now: place.opening_hours?.open_now,
    photo_url: place.resolved_photo_url ?? null,
    types: place.types ?? [],
    editorial_summary: place.editorial_summary ?? undefined,
  }));

  return { places, nextPageToken: data.next_page_token ?? undefined };
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const data = await callProxy<any>('details', { placeId });
  const r = data?.result;
  if (!r) return null;

  const photoUrls = await resolvePhotos(r.photos, 6, 600);

  return {
    name: r.name,
    rating: r.rating ?? 0,
    formatted_phone_number: r.formatted_phone_number,
    formatted_address: r.formatted_address ?? '',
    opening_hours: r.opening_hours ? { weekday_text: r.opening_hours.weekday_text ?? [] } : undefined,
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
  };
}

export async function getPlaceLocation(placeId: string): Promise<{ name: string; lat: number; lng: number } | null> {
  const data = await callProxy<any>('location', { placeId })
    ?? await directPlaceLocation(placeId);
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
    const data = proxyData?.predictions?.length
      ? proxyData
      : await directAutocomplete(input.trim(), locationBias) ?? proxyData;
    return (data?.predictions ?? []).filter((p: any) => p?.place_id && p?.description).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
    }));
  } catch {
    return [];
  }
}
