import { mapNearbyToDiscoverPlace } from '@/components/discover/shared';
import { DEFAULT_SEARCH_RADIUS, MAX_DISCOVER_RADIUS } from '@/lib/category-config';
import { searchNearby, searchNearbyPage } from '@/lib/google-places';
import { searchMultiCategory } from '@/lib/multi-category-search';
import type { DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';

type Coords = { lat: number; lng: number };

interface DiscoverPlaceSearchResult {
  cacheKey: string;
  places: readonly DiscoverPlace[];
  rawCount: number;
  nextPageToken?: string;
  errorMessage?: string;
  radius?: number;
}

export function buildDiscoverSearchCacheKey(
  coords: Coords,
  keyword?: string,
  type?: string,
  radius = DEFAULT_SEARCH_RADIUS,
) {
  return `${type ?? ''}_${keyword ?? ''}_${coords.lat}_${coords.lng}_${radius}`;
}

export function buildDiscoverAllCacheKey(coords: Coords) {
  return `all_multi_${coords.lat}_${coords.lng}`;
}

export async function runDiscoverPlaceSearch(
  coords: Coords,
  keyword?: string,
  type?: string,
  radius?: number,
): Promise<DiscoverPlaceSearchResult> {
  const searchRadius = Math.min(radius ?? DEFAULT_SEARCH_RADIUS, MAX_DISCOVER_RADIUS);
  const cacheKey = buildDiscoverSearchCacheKey(coords, keyword, type, searchRadius);
  const { places: results, nextPageToken, errorMessage } = await searchNearby(type, keyword, coords, searchRadius);
  return {
    cacheKey,
    places: results.map((p) => mapNearbyToDiscoverPlace(p, coords)),
    rawCount: results.length,
    nextPageToken,
    errorMessage,
    radius: searchRadius,
  };
}

export async function runDiscoverAllSearch(coords: Coords): Promise<DiscoverPlaceSearchResult> {
  const cacheKey = buildDiscoverAllCacheKey(coords);
  const { places: results } = await searchMultiCategory(coords);
  return {
    cacheKey,
    places: results.map((p) => mapNearbyToDiscoverPlace(p, coords)),
    rawCount: results.length,
  };
}

export async function runDiscoverMoreSearch(
  pageToken: string,
  coords?: Coords,
): Promise<Pick<DiscoverPlaceSearchResult, 'places' | 'nextPageToken' | 'rawCount'>> {
  const { places: results, nextPageToken } = await searchNearbyPage(pageToken);
  return {
    places: results.map((p) => mapNearbyToDiscoverPlace(p, coords)),
    rawCount: results.length,
    nextPageToken,
  };
}
