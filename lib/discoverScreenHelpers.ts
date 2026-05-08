import { DEFAULT_PLACE_FILTERS, type PlaceFilterState } from '@/lib/discoverPlaceFilters';
import type { PlaceCategory } from '@/lib/types';

export type TabId = 'places' | 'stays' | 'concierge' | 'saved';
export type TravelMode = 'walk' | 'car';
export type DistanceOrigin = 'hotel' | 'me';
export type DiscoverOriginKind = 'trip' | 'selected_place' | 'current_location' | 'none';
export type FilterState = PlaceFilterState;

export const PLACE_CATEGORY_CHIPS = [
  'All',
  'Beach',
  'Food',
  'Coffee',
  'Activity',
  'Nightlife',
  'Wellness',
  'Date Night',
  'Rainy Day',
  'Worth the Drive',
  'Budget Friendly',
  'Shopping',
  'ATM',
  'Landmark',
] as const;

export const PRIMARY_PLACE_CATEGORY_CHIPS = ['Food', 'Coffee', 'Activity'] as const satisfies readonly typeof PLACE_CATEGORY_CHIPS[number][];

export const DEFAULT_FILTERS = DEFAULT_PLACE_FILTERS;

const BROAD_ORIGIN_TERMS = new Set([
  'japan',
  'philippines',
  'indonesia',
  'thailand',
  'korea',
  'south korea',
  'bali',
  'tokyo',
  'osaka',
  'kyoto',
  'manila',
  'cebu',
  'boracay',
  'siargao',
  'siargao island',
  'caticlan',
]);

export function destinationToLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const record = value as Record<string, unknown>;
  if (typeof record.label === 'string') return record.label;
  if (typeof record.name === 'string') return record.name;
  if (typeof record.destination === 'string') return record.destination;
  return '';
}

export function resolveCategory(types: string[]): PlaceCategory {
  const mapping: Record<string, PlaceCategory> = {
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
  for (const t of types) {
    if (mapping[t]) return mapping[t];
  }
  return 'Do';
}

export function isBroadOriginQuery(input: string): boolean {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return false;
  const firstSegment = normalized.split(',')[0]?.trim() ?? normalized;
  return BROAD_ORIGIN_TERMS.has(normalized) || BROAD_ORIGIN_TERMS.has(firstSegment);
}

export function originRefinementCopy(input: string): string {
  const trimmed = input.trim();
  return `${trimmed || 'That place'} is too broad. Search a hotel, address, station, landmark, neighborhood, or exact pin.`;
}
