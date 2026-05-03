import {
  DEFAULT_PLACE_FILTERS,
  applyPlaceFilters,
  countActivePlaceFilters,
  getFilterContext,
  getQuickFiltersForContext,
  matchesDestinationScope,
  resolveDestinationScope,
} from '@/lib/discoverPlaceFilters';
import type { DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';

const place = (overrides: Partial<DiscoverPlace>): DiscoverPlace => ({
  n: 'Place',
  t: 'Restaurant',
  r: 0,
  rv: '0 reviews',
  d: '',
  dn: 0,
  price: 0,
  openNow: false,
  img: '',
  ...overrides,
});

describe('discover place filters', () => {
  it('treats default filters as no active user filters', () => {
    expect(countActivePlaceFilters(DEFAULT_PLACE_FILTERS)).toBe(0);
  });

  it('does not hide unrated or premium places by default', () => {
    const places = [
      place({ n: 'New Cafe', r: 0, price: 0 }),
      place({ n: 'Premium Dinner', r: 4.8, price: 4 }),
    ];

    expect(applyPlaceFilters(places, DEFAULT_PLACE_FILTERS).map((p) => p.n)).toEqual([
      'New Cafe',
      'Premium Dinner',
    ]);
  });

  it('removes lodging from food and place discovery results', () => {
    const places = [
      place({ n: 'Beach Hotel', t: 'Hotel', types: ['lodging'] }),
      place({ n: 'Beach Cafe', t: 'Cafe', types: ['cafe'] }),
    ];

    expect(applyPlaceFilters(places, DEFAULT_PLACE_FILTERS).map((p) => p.n)).toEqual([
      'Beach Cafe',
    ]);
  });

  it('counts local and abroad destination scope as an active filter', () => {
    expect(countActivePlaceFilters({ ...DEFAULT_PLACE_FILTERS, destinationScope: 'local' })).toBe(1);
    expect(countActivePlaceFilters({ ...DEFAULT_PLACE_FILTERS, destinationScope: 'abroad' })).toBe(1);
  });

  it('classifies Philippine destinations as local and other countries as abroad', () => {
    expect(resolveDestinationScope({ countryCode: 'PH' })).toBe('local');
    expect(resolveDestinationScope({ countryCode: 'JP' })).toBe('abroad');
    expect(matchesDestinationScope({ countryCode: 'PH' }, 'local')).toBe(true);
    expect(matchesDestinationScope({ countryCode: 'ID' }, 'local')).toBe(false);
    expect(matchesDestinationScope({ countryCode: 'ID' }, 'abroad')).toBe(true);
  });

  it('does not show distance-dependent quick filters before an origin exists', () => {
    const context = getFilterContext({
      hasTrip: false,
      hasOrigin: false,
      originKind: 'none',
      memberCount: 0,
    });

    expect(context).toBe('no_origin');
    expect(getQuickFiltersForContext(context).map((f) => f.id)).toEqual([
      'saved_ideas',
      'popular',
      'food',
      'coffee',
      'beach',
    ]);
  });

  it('shows walkable and open-now quick filters for current location', () => {
    const context = getFilterContext({
      hasTrip: false,
      hasOrigin: true,
      originKind: 'current_location',
      memberCount: 0,
    });

    expect(context).toBe('near_me');
    expect(getQuickFiltersForContext(context).map((f) => f.id)).toEqual(
      expect.arrayContaining(['open_now', 'walkable']),
    );
  });

  it('shows group planning quick filters for active group trips', () => {
    const context = getFilterContext({
      hasTrip: true,
      hasOrigin: true,
      originKind: 'trip',
      memberCount: 3,
    });

    expect(context).toBe('active_trip_group');
    expect(getQuickFiltersForContext(context).map((f) => f.id)).toEqual(
      expect.arrayContaining(['recommended', 'needs_votes']),
    );
  });

  it('filters saved, recommended, and needs-votes places', () => {
    const places = [
      place({ n: 'Saved Cafe' }),
      place({ n: 'Group Dinner' }),
      place({ n: 'Finished Vote' }),
    ];

    expect(applyPlaceFilters(places, { ...DEFAULT_PLACE_FILTERS, savedOnly: true }, {
      savedNames: new Set(['Saved Cafe']),
      recommendedNames: new Set(['Group Dinner']),
      voteCountsByName: new Map([['Group Dinner', 1], ['Finished Vote', 3]]),
      memberCount: 3,
    }).map((p) => p.n)).toEqual(['Saved Cafe']);

    expect(applyPlaceFilters(places, { ...DEFAULT_PLACE_FILTERS, recommendedOnly: true }, {
      savedNames: new Set(['Saved Cafe']),
      recommendedNames: new Set(['Group Dinner']),
      voteCountsByName: new Map([['Group Dinner', 1], ['Finished Vote', 3]]),
      memberCount: 3,
    }).map((p) => p.n)).toEqual(['Group Dinner']);

    expect(applyPlaceFilters(places, { ...DEFAULT_PLACE_FILTERS, needsVotesOnly: true }, {
      savedNames: new Set(['Saved Cafe']),
      recommendedNames: new Set(['Group Dinner']),
      voteCountsByName: new Map([['Group Dinner', 1], ['Finished Vote', 3]]),
      memberCount: 3,
    }).map((p) => p.n)).toEqual(['Group Dinner']);
  });
});
