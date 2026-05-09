import type { DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';
import { MAX_DISCOVER_RADIUS } from '@/lib/category-config';
import { DEFAULT_PLACE_FILTERS, type PlaceFilterState, type PlaceSortMode } from '@/lib/discoverPlaceFilters';
import type { TravelMode } from '@/features/discover/lib/screenConfig';

export type PlaceDistanceEntry = {
  place: DiscoverPlace;
  distanceKm: number;
  blendedScore: number;
};

type DistanceResolver = (lat?: number, lng?: number) => number;

function addDistanceToPlaces(
  list: readonly DiscoverPlace[],
  getDistanceKm: DistanceResolver,
  travelMode: TravelMode,
): PlaceDistanceEntry[] {
  const distancePenalty = travelMode === 'walk' ? 0.42 : 0.18;
  return list.map((place) => {
    const distanceKm = getDistanceKm(place.lat, place.lng);
    const qualityScore = (place.r ?? 0) * Math.log10(Math.max(place.totalRatings ?? 1, 1));
    return {
      place,
      distanceKm,
      blendedScore: qualityScore - distanceKm * distancePenalty,
    };
  });
}

function sortPlaceDistanceEntries(
  entries: PlaceDistanceEntry[],
  sortMode: PlaceSortMode = DEFAULT_PLACE_FILTERS.sortMode ?? 'best',
): PlaceDistanceEntry[] {
  return entries.sort((a, b) => {
    const openA = a.place.openNow ? 0 : 1;
    const openB = b.place.openNow ? 0 : 1;
    if (openA !== openB) return openA - openB;
    if (sortMode === 'distance') return a.distanceKm - b.distanceKm;
    if (sortMode === 'rating') return (b.place.r ?? 0) - (a.place.r ?? 0);
    if (sortMode === 'popular') return (b.place.totalRatings ?? 0) - (a.place.totalRatings ?? 0);
    return b.blendedScore - a.blendedScore;
  });
}

function keepInsideDiscoveryRadius(
  entries: PlaceDistanceEntry[],
  hasUsableOrigin: boolean,
): PlaceDistanceEntry[] {
  if (!hasUsableOrigin) return entries;
  const maxKm = MAX_DISCOVER_RADIUS / 1000;
  return entries.filter((entry) => entry.distanceKm === 0 || entry.distanceKm <= maxKm);
}

export function buildPlaceDistanceEntries({
  places,
  getDistanceKm,
  hasUsableOrigin,
  sortMode,
  travelMode,
}: {
  places: readonly DiscoverPlace[];
  getDistanceKm: DistanceResolver;
  hasUsableOrigin: boolean;
  sortMode?: PlaceSortMode;
  travelMode: TravelMode;
}): PlaceDistanceEntry[] {
  return sortPlaceDistanceEntries(
    keepInsideDiscoveryRadius(addDistanceToPlaces(places, getDistanceKm, travelMode), hasUsableOrigin),
    sortMode,
  );
}

function canRelaxPlaceFilters(filters: PlaceFilterState): boolean {
  const hasStrictFilter =
    filters.openNow ||
    filters.minRating > 0 ||
    (filters.minReviewCount ?? 0) > 0 ||
    (filters.placeTypes?.length ?? 0) > 0 ||
    (filters.vibes?.length ?? 0) > 0;

  return hasStrictFilter && !filters.savedOnly && !filters.recommendedOnly && !filters.needsVotesOnly;
}

export function getVisiblePlaceDistanceEntries({
  allPlacesWithDistance,
  canShowPlaceResults,
  filters,
  placesWithDistance,
}: {
  allPlacesWithDistance: readonly PlaceDistanceEntry[];
  canShowPlaceResults: boolean;
  filters: PlaceFilterState;
  placesWithDistance: readonly PlaceDistanceEntry[];
}): {
  entries: readonly PlaceDistanceEntry[];
  relaxed: boolean;
} {
  const minimumUsefulResults = Math.min(3, allPlacesWithDistance.length);
  const relaxed =
    canShowPlaceResults &&
    canRelaxPlaceFilters(filters) &&
    allPlacesWithDistance.length > 0 &&
    placesWithDistance.length < minimumUsefulResults;

  return {
    entries: canShowPlaceResults ? (relaxed ? allPlacesWithDistance : placesWithDistance) : [],
    relaxed,
  };
}

export function getPlacesEmptyText(filters: PlaceFilterState, hasUsableOrigin: boolean): string {
  if (!hasUsableOrigin) return 'Set a precise location or use current location before searching.';
  if (filters.openNow) return 'No open places found. Try All availability.';
  if (filters.savedOnly) return 'No saved ideas match this view yet.';
  if (filters.recommendedOnly) return 'No group recommendations match this view yet.';
  if (filters.needsVotesOnly) return 'No places need votes right now.';
  if (
    (filters.placeTypes?.length ?? 0) > 0 ||
    (filters.vibes?.length ?? 0) > 0 ||
    (filters.minReviewCount ?? 0) > 0 ||
    filters.minRating > 0
  ) {
    return 'No places match those advanced filters. Try Clear filters.';
  }
  return 'No places found within 10 km.';
}
