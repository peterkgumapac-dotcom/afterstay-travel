import type { DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';

export type DestinationScope = 'all' | 'local' | 'abroad';
export type PlaceSortMode = 'best' | 'distance' | 'rating' | 'popular';
type FilterOriginKind = 'trip' | 'selected_place' | 'searched_destination' | 'current_location' | 'none';
type FilterContext =
  | 'no_origin'
  | 'destination'
  | 'near_me'
  | 'active_trip_solo'
  | 'active_trip_group';

type QuickFilterId =
  | 'saved_ideas'
  | 'popular'
  | 'food'
  | 'coffee'
  | 'beach'
  | 'top_rated'
  | 'budget'
  | 'activities'
  | 'open_now'
  | 'walkable'
  | 'near_hotel'
  | 'saved'
  | 'worth_the_drive'
  | 'recommended'
  | 'needs_votes';

type QuickFilter = {
  id: QuickFilterId;
  label: string;
};

export type PlaceFilterState = {
  destinationScope: DestinationScope;
  minRating: number;
  openNow: boolean;
  nearby: boolean;
  maxPrice: number;
  savedOnly?: boolean;
  recommendedOnly?: boolean;
  needsVotesOnly?: boolean;
  sortMode?: PlaceSortMode;
};

export const DEFAULT_PLACE_FILTERS: PlaceFilterState = {
  destinationScope: 'all',
  minRating: 0,
  openNow: false,
  nearby: false,
  maxPrice: 4,
  savedOnly: false,
  recommendedOnly: false,
  needsVotesOnly: false,
  sortMode: 'best',
};

type DestinationLike = {
  countryCode?: string;
  scope?: DestinationScope;
};

type FilterContextInput = {
  hasTrip: boolean;
  hasOrigin: boolean;
  originKind: FilterOriginKind;
  memberCount: number;
};

type PlaceFilterMetadata = {
  savedNames?: ReadonlySet<string>;
  recommendedNames?: ReadonlySet<string>;
  voteCountsByName?: ReadonlyMap<string, number>;
  memberCount?: number;
};

const QUICK_FILTERS_BY_CONTEXT: Record<FilterContext, QuickFilter[]> = {
  no_origin: [
    { id: 'saved_ideas', label: 'Saved Ideas' },
    { id: 'popular', label: 'Popular' },
    { id: 'food', label: 'Food' },
    { id: 'coffee', label: 'Coffee' },
    { id: 'beach', label: 'Beach' },
  ],
  destination: [
    { id: 'food', label: 'Food' },
    { id: 'coffee', label: 'Coffee' },
    { id: 'activities', label: 'Activities' },
    { id: 'top_rated', label: 'Top rated' },
    { id: 'open_now', label: 'Open now' },
    { id: 'budget', label: 'Budget' },
  ],
  near_me: [
    { id: 'open_now', label: 'Open now' },
    { id: 'walkable', label: 'Walkable' },
    { id: 'coffee', label: 'Coffee' },
    { id: 'food', label: 'Food' },
    { id: 'budget', label: 'Budget' },
  ],
  active_trip_solo: [
    { id: 'near_hotel', label: 'Near hotel' },
    { id: 'open_now', label: 'Open now' },
    { id: 'saved', label: 'Saved' },
    { id: 'budget', label: 'Budget' },
    { id: 'worth_the_drive', label: 'Worth the drive' },
  ],
  active_trip_group: [
    { id: 'recommended', label: 'Recommended' },
    { id: 'needs_votes', label: 'Needs votes' },
    { id: 'near_hotel', label: 'Near hotel' },
    { id: 'open_now', label: 'Open now' },
    { id: 'budget', label: 'Budget' },
  ],
};

export function getFilterContext(input: FilterContextInput): FilterContext {
  if (input.hasTrip) {
    return input.memberCount >= 2 ? 'active_trip_group' : 'active_trip_solo';
  }
  if (input.originKind === 'current_location') return 'near_me';
  if (input.hasOrigin || input.originKind === 'selected_place' || input.originKind === 'searched_destination') return 'destination';
  return 'no_origin';
}

export function getQuickFiltersForContext(context: FilterContext): QuickFilter[] {
  return QUICK_FILTERS_BY_CONTEXT[context];
}

export function resolveDestinationScope(destination: DestinationLike): Exclude<DestinationScope, 'all'> {
  if (destination.scope === 'local' || destination.scope === 'abroad') return destination.scope;
  return destination.countryCode?.toUpperCase() === 'PH' ? 'local' : 'abroad';
}

export function matchesDestinationScope(
  destination: DestinationLike,
  scope: DestinationScope,
): boolean {
  if (scope === 'all') return true;
  return resolveDestinationScope(destination) === scope;
}

export function countActivePlaceFilters(f: PlaceFilterState): number {
  return (
    (f.destinationScope !== DEFAULT_PLACE_FILTERS.destinationScope ? 1 : 0) +
    (f.minRating > 0 ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.nearby ? 1 : 0) +
    (f.maxPrice < DEFAULT_PLACE_FILTERS.maxPrice ? 1 : 0) +
    (f.savedOnly ? 1 : 0) +
    (f.recommendedOnly ? 1 : 0) +
    (f.needsVotesOnly ? 1 : 0) +
    (f.sortMode && f.sortMode !== DEFAULT_PLACE_FILTERS.sortMode ? 1 : 0)
  );
}

export function applyPlaceFilters(
  list: readonly DiscoverPlace[],
  f: PlaceFilterState,
  metadata: PlaceFilterMetadata = {},
): DiscoverPlace[] {
  return list.filter((p) => {
    const t = (p.t ?? '').toLowerCase();
    const types = (p.types ?? []).map((s) => s.toLowerCase());
    if (
      t === 'hotel' ||
      t === 'lodging' ||
      types.includes('lodging') ||
      types.includes('hotel')
    ) {
      return false;
    }
    if (f.savedOnly && !metadata.savedNames?.has(p.n)) return false;
    if (f.recommendedOnly && !metadata.recommendedNames?.has(p.n)) return false;
    if (f.needsVotesOnly) {
      const memberCount = metadata.memberCount ?? 0;
      const voteCount = metadata.voteCountsByName?.get(p.n);
      if (!voteCount || memberCount < 2 || voteCount >= memberCount) return false;
    }
    if (f.minRating && p.r < f.minRating) return false;
    if (f.openNow && !p.openNow) return false;
    if (f.maxPrice < DEFAULT_PLACE_FILTERS.maxPrice && p.price > f.maxPrice) return false;
    return true;
  });
}
