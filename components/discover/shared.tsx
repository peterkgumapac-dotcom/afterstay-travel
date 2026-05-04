/**
 * Shared utilities for Discover tab components (Places, Stays, etc.)
 * Extracted from discover.tsx to avoid duplication across tab components.
 */

import { distanceFromPoint, formatDistance } from '@/lib/distance';
import type { NearbyPlace } from '@/lib/google-places';
import type { Place, PlaceCategory } from '@/lib/types';
import type { DiscoverPlace } from './DiscoverPlaceCard';

// ── Type label resolution ────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  cafe: 'Cafe',
  spa: 'Spa',
  beach: 'Beach',
  park: 'Park',
  shopping_mall: 'Shopping',
  store: 'Shopping',
  tourist_attraction: 'Attraction',
  point_of_interest: 'Landmark',
  natural_feature: 'Nature',
  gym: 'Wellness',
  lodging: 'Hotel',
  church: 'Culture',
};

export function resolveTypeLabel(types: string[]): string {
  for (const t of types) {
    if (TYPE_LABELS[t]) return TYPE_LABELS[t];
  }
  return 'Place';
}

// ── Category resolution (Google type → PlaceCategory) ────────────────

const CATEGORY_MAP: Record<string, PlaceCategory> = {
  restaurant: 'Eat',
  bar: 'Nightlife',
  cafe: 'Coffee',
  spa: 'Wellness',
  gym: 'Wellness',
  tourist_attraction: 'Do',
  natural_feature: 'Nature',
  park: 'Nature',
  shopping_mall: 'Essentials',
  store: 'Essentials',
  church: 'Culture',
  lodging: 'Stay',
};

export function resolveCategory(types: string[]): PlaceCategory {
  for (const t of types) {
    if (CATEGORY_MAP[t]) return CATEGORY_MAP[t];
  }
  return 'Do';
}

// ── Review count formatting ──────────────────────────────────────────

export function formatReviewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k reviews`;
  if (count === 0) return 'No reviews';
  return `${count} reviews`;
}

// ── NearbyPlace → DiscoverPlace mapper ───────────────────────────────

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80';

/** Map a Google Places result to a DiscoverPlace card model.
 *  Pass `refCoords` to compute distance from a specific point (trip hotel, user location, etc.).
 *  When omitted, distance fields default to 0. */
export function mapNearbyToDiscoverPlace(
  place: NearbyPlace,
  refCoords?: { lat: number; lng: number },
): DiscoverPlace {
  const km = refCoords
    ? distanceFromPoint(refCoords.lat, refCoords.lng, place.lat, place.lng)
    : 0;
  return {
    n: place.name,
    t: resolveTypeLabel(place.types),
    r: place.rating,
    rv: formatReviewCount(place.total_ratings),
    d: km > 0 ? formatDistance(km) : '',
    dn: km,
    price: place.price_level ?? 0,
    openNow: place.open_now ?? false,
    img: place.photo_url ?? FALLBACK_IMG,
    imgCandidates: place.photo_urls,
    placeId: place.place_id,
    address: place.address,
    mapsUrl: place.place_id
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`
      : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`,
    businessStatus: place.business_status,
    lat: place.lat,
    lng: place.lng,
    totalRatings: place.total_ratings,
    types: place.types ?? [],
    summary: place.editorial_summary,
  };
}

export function mapSavedToDiscoverPlace(
  place: Place,
  refCoords?: { lat: number; lng: number },
): DiscoverPlace {
  const km = refCoords && place.latitude != null && place.longitude != null
    ? distanceFromPoint(refCoords.lat, refCoords.lng, place.latitude, place.longitude)
    : 0;
  return {
    n: place.name,
    t: place.category,
    r: place.rating ?? 0,
    rv: formatReviewCount(place.totalRatings ?? 0),
    d: km > 0 ? formatDistance(km) : '',
    dn: km,
    price: 0,
    openNow: false,
    img: place.photoUrl ?? FALLBACK_IMG,
    placeId: place.googlePlaceId,
    address: place.address,
    mapsUrl: place.googleMapsUri ?? (place.googlePlaceId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.googlePlaceId}`
      : place.latitude != null && place.longitude != null
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : undefined),
    lat: place.latitude,
    lng: place.longitude,
    totalRatings: place.totalRatings ?? 0,
    types: [],
  };
}
