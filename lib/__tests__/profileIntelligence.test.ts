import type { Flight, FollowState, Moment, Trip } from '../types';
import {
  buildProfileDisplayFactsFromVisual,
  buildProfileRelationship,
  buildProfileTravelFacts,
} from '../profileIntelligence';

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

const moments: Moment[] = Array.from({ length: 12 }, (_, index) => ({
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

describe('profileIntelligence', () => {
  it('keeps trips, places, and countries separate for local travel', () => {
    const facts = buildProfileTravelFacts({
      trips: [
        { ...baseTrip, id: 'boracay', destination: 'Boracay', country: undefined, countryCode: undefined },
        { ...baseTrip, id: 'cebu', destination: 'Cebu', country: undefined, countryCode: undefined },
        { ...baseTrip, id: 'caticlan', destination: 'Caticlan', country: undefined, countryCode: undefined },
      ],
      moments,
    });

    expect(facts.tripCount).toBe(3);
    expect(facts.countryCount).toBe(1);
    expect(facts.placeCount).toBe(3);
    expect(facts.mapTemplate).toBe('local_explorer');
    expect(facts.travelVisual.animationMode).toBe('local_hops');
    expect(facts.badges.map((badge) => badge.key)).toEqual(['local_explorer', 'memory_maker', 'travel_flex']);
  });

  it('uses exact flight confidence and route data when airports are known', () => {
    const facts = buildProfileTravelFacts({
      trips: [baseTrip],
      flights,
      homeBase: 'Manila',
    });

    expect(facts.confidence).toBe('exact_flight');
    expect(facts.routes).toHaveLength(1);
    expect(facts.mapData.totalKm).toBeGreaterThan(250);
  });

  it('selects regional and global shells from country count', () => {
    const regional = buildProfileTravelFacts({
      trips: [
        baseTrip,
        { ...baseTrip, id: 'th', destination: 'Bangkok, Thailand', country: 'Thailand', countryCode: 'TH' },
        { ...baseTrip, id: 'vn', destination: 'Hoi An, Vietnam', country: 'Vietnam', countryCode: 'VN' },
      ],
    });
    const global = buildProfileTravelFacts({
      trips: [],
      fallbackStats: {
        totalTrips: 13,
        totalCountries: 9,
        totalNights: 75,
        totalMiles: 10000,
        totalSpent: 348000,
        homeCurrency: 'PHP',
        totalMoments: 23,
        countriesList: ['Philippines', 'Thailand', 'Vietnam', 'Indonesia', 'Singapore', 'Japan', 'South Korea', 'United States', 'France'],
      },
    });

    expect(regional.mapTemplate).toBe('regional_traveler');
    expect(global.mapTemplate).toBe('global_flex');
    expect(regional.badges[0].key).toBe('globetrotter');
  });

  it('limits badges to three in priority order', () => {
    const facts = buildProfileTravelFacts({
      trips: [
        baseTrip,
        { ...baseTrip, id: 'th', destination: 'Bangkok, Thailand', country: 'Thailand', countryCode: 'TH' },
        { ...baseTrip, id: 'vn', destination: 'Hoi An, Vietnam', country: 'Vietnam', countryCode: 'VN' },
      ],
      moments,
      isCompanion: true,
    });

    expect(facts.badges).toHaveLength(3);
    expect(facts.badges.map((badge) => badge.key)).toEqual(['globetrotter', 'memory_maker', 'trip_companion']);
  });

  it('uses the selected travel visual as the public profile stats source', () => {
    const facts = buildProfileTravelFacts({
      trips: [baseTrip],
      moments,
      fallbackStats: {
        totalTrips: 13,
        totalCountries: 8,
        totalNights: 75,
        totalMiles: 9754,
        totalSpent: 348000,
        homeCurrency: 'PHP',
        totalMoments: 23,
        countriesList: ['Philippines', 'Thailand', 'Vietnam', 'Indonesia', 'Singapore', 'Japan', 'South Korea', 'Hong Kong'],
      },
    });

    expect(facts.stats.totalTrips).toBe(1);
    expect(facts.stats.totalCountries).toBe(1);
    expect(facts.stats.totalNights).toBe(7);
    expect(facts.countries.map((country) => country.code)).toEqual(['PH']);
    expect(facts.travelVisual.counts.trips).toBe(facts.stats.totalTrips);
    expect(facts.travelVisual.counts.countries).toBe(facts.stats.totalCountries);
  });

  it('adapts the selected remote travel visual into display stats and countries', () => {
    const display = buildProfileDisplayFactsFromVisual({
      visual: {
        template: 'regional_traveler',
        animationMode: 'country_hops',
        counts: {
          trips: 13,
          countries: 8,
          places: 8,
          nights: 75,
          photos: 23,
          spent: 348000,
          km: 25263,
        },
        flags: [
          { countryCode: 'PH', countryName: 'Philippines', flag: '🇵🇭', visitedPlaces: 1 },
          { countryCode: 'TH', countryName: 'Thailand', flag: '🇹🇭', visitedPlaces: 1 },
        ],
        places: [],
        routes: [],
        home: { code: 'MNL', label: 'HOME' },
        confidence: 'exact_place',
        since: '2024',
      },
      isCompanion: true,
    });

    expect(display.stats.totalTrips).toBe(13);
    expect(display.stats.totalCountries).toBe(8);
    expect(display.stats.totalNights).toBe(75);
    expect(display.stats.totalSpent).toBe(348000);
    expect(display.countries.map((country) => country.code)).toEqual(['PH', 'TH']);
    expect(display.badges.map((badge) => badge.key)).toContain('globetrotter');
  });

  it('unlocks messages only for companions or mutual follows', () => {
    const oneWayFollow: FollowState = {
      isFollowing: true,
      isFollowedBy: false,
      followersCount: 4,
      followingCount: 2,
    };
    const mutualFollow: FollowState = {
      ...oneWayFollow,
      isFollowedBy: true,
    };

    expect(buildProfileRelationship({
      viewerId: 'viewer',
      profileUserId: 'profile',
      companionStatus: 'none',
      followState: oneWayFollow,
    }).canMessage).toBe(false);

    expect(buildProfileRelationship({
      viewerId: 'viewer',
      profileUserId: 'profile',
      companionStatus: 'none',
      followState: mutualFollow,
    }).canMessage).toBe(true);

    expect(buildProfileRelationship({
      viewerId: 'viewer',
      profileUserId: 'profile',
      companionStatus: 'companion',
      followState: oneWayFollow,
    }).canMessage).toBe(true);
  });
});
