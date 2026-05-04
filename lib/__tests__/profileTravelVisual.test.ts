import type { Flight, LifetimeStats, Moment, Trip } from '../types';
import {
  buildTravelFlexVisual,
  chooseTravelFlexAnimationMode,
  chooseTravelFlexTemplate,
  normalizeTravelFlexVisualFromRpc,
  visibleTravelFlexFlags,
} from '../profileTravelVisual';

const baseTrip: Trip = {
  id: 'trip-1',
  name: 'Boracay',
  destination: 'Boracay, Philippines',
  startDate: '2024-04-20',
  endDate: '2024-04-27',
  nights: 7,
  accommodation: '',
  address: '',
  roomType: '',
  status: 'Completed',
  country: 'Philippines',
  countryCode: 'PH',
  totalSpent: 36420,
  latitude: 11.9674,
  longitude: 121.9248,
};

const moments: Moment[] = Array.from({ length: 3 }, (_, index) => ({
  id: `moment-${index}`,
  caption: '',
  date: '2024-04-21',
  tags: [],
  photo: `https://example.com/${index}.jpg`,
  userId: 'user-1',
}));

const flights: Flight[] = [
  {
    id: 'flight-1',
    direction: 'Outbound',
    flightNumber: 'PR 2045',
    airline: 'Philippine Airlines',
    from: 'Manila (MNL)',
    to: 'Boracay (MPH)',
    departTime: '2024-04-20T01:00:00Z',
    arriveTime: '2024-04-20T02:10:00Z',
  },
];

describe('profileTravelVisual', () => {
  it('selects the expected skeleton templates by travel volume', () => {
    expect(chooseTravelFlexTemplate({ trips: 0, countries: 0, places: 0 })).toBe('empty');
    expect(chooseTravelFlexTemplate({ trips: 1, countries: 1, places: 1 })).toBe('first_place');
    expect(chooseTravelFlexTemplate({ trips: 3, countries: 1, places: 3 })).toBe('local_explorer');
    expect(chooseTravelFlexTemplate({ trips: 2, countries: 2, places: 2 })).toBe('first_abroad');
    expect(chooseTravelFlexTemplate({ trips: 5, countries: 5, places: 8 })).toBe('regional_traveler');
    expect(chooseTravelFlexTemplate({ trips: 14, countries: 9, places: 20 })).toBe('global_flex');
  });

  it('chooses animation modes that match the template', () => {
    expect(chooseTravelFlexAnimationMode('empty')).toBe('none');
    expect(chooseTravelFlexAnimationMode('first_place', 1, 1)).toBe('single_arc');
    expect(chooseTravelFlexAnimationMode('local_explorer', 0, 3)).toBe('local_hops');
    expect(chooseTravelFlexAnimationMode('regional_traveler', 4, 5)).toBe('country_hops');
    expect(chooseTravelFlexAnimationMode('global_flex', 10, 12)).toBe('route_constellation');
  });

  it('keeps local Philippine places as one country with multiple places', () => {
    const visual = buildTravelFlexVisual({
      trips: [
        { ...baseTrip, id: 'boracay', destination: 'Boracay', country: 'Philippines', countryCode: 'PH' },
        { ...baseTrip, id: 'cebu', destination: 'Cebu', country: 'Philippines', countryCode: 'PH' },
        { ...baseTrip, id: 'hoi-an-text', destination: 'Boracay, Philippines', country: 'Philippines', countryCode: 'PH' },
      ],
      moments,
    });

    expect(visual.template).toBe('local_explorer');
    expect(visual.counts.countries).toBe(1);
    expect(visual.counts.places).toBe(2);
    expect(visual.flags).toEqual([
      expect.objectContaining({ countryCode: 'PH', visitedPlaces: 2 }),
    ]);
  });

  it('prefers exact flight confidence and flight-derived kilometers', () => {
    const visual = buildTravelFlexVisual({
      trips: [baseTrip],
      flights,
      homeBase: 'Manila',
    });

    expect(visual.confidence).toBe('exact_flight');
    expect(visual.routes[0]).toEqual(expect.objectContaining({
      fromCode: 'MNL',
      toCode: 'MPH',
      confidence: 'exact_flight',
    }));
    expect(visual.counts.km).toBeGreaterThan(250);
  });

  it('deduplicates flags and reports overflow count', () => {
    const result = visibleTravelFlexFlags([
      { countryCode: 'PH', countryName: 'Philippines', flag: '🇵🇭', visitedPlaces: 2 },
      { countryCode: 'PH', countryName: 'Philippines', flag: '🇵🇭', visitedPlaces: 1 },
      { countryCode: 'TH', countryName: 'Thailand', flag: '🇹🇭', visitedPlaces: 1 },
      { countryCode: 'VN', countryName: 'Vietnam', flag: '🇻🇳', visitedPlaces: 1 },
    ], 2);

    expect(result.visible.map((flag) => flag.countryCode)).toEqual(['PH', 'TH']);
    expect(result.extraCount).toBe(1);
  });

  it('normalizes the public RPC payload for the frontend card', () => {
    const visual = normalizeTravelFlexVisualFromRpc({
      counts: { trips: 13, countries: 9, places: 20, nights: 75, photos: 23, spent: 348000, km: 15698 },
      template: 'global_flex',
      animationMode: 'route_constellation',
      confidence: 'country_estimate',
      flags: [{ countryCode: 'JP', countryName: 'Japan', visitedPlaces: 1 }],
      places: [{ id: 'tokyo', label: 'Tokyo', countryCode: 'JP', confidence: 'country_estimate' }],
      routes: [{ id: 'r1', fromLabel: 'HOME', toLabel: 'Tokyo', confidence: 'country_estimate' }],
      home: { code: 'MNL', label: 'Manila' },
      since: '2024',
    });

    expect(visual?.template).toBe('global_flex');
    expect(visual?.flags[0].flag).toBe('🇯🇵');
    expect(visual?.animationMode).toBe('route_constellation');
  });

  it('falls back to lifetime stats when no local trip rows are visible yet', () => {
    const fallbackStats: LifetimeStats = {
      totalTrips: 13,
      totalCountries: 3,
      totalNights: 75,
      totalMiles: 9754,
      totalSpent: 348000,
      homeCurrency: 'PHP',
      totalMoments: 23,
      countriesList: ['Philippines', 'Thailand', 'Vietnam'],
    };

    const visual = buildTravelFlexVisual({ trips: [], fallbackStats });

    expect(visual.template).toBe('regional_traveler');
    expect(visual.counts.countries).toBe(3);
    expect(visual.flags.map((flag) => flag.countryCode)).toEqual(['PH', 'TH', 'VN']);
  });
});
