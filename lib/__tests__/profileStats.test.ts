import type { Flight, LifetimeStats, Moment, Trip } from '../types';
import {
  buildAchievementBadges,
  buildCountriesVisited,
  buildProfileCoverPhotoUrl,
  buildTravelProgressItems,
  buildTravelProgressItemsFromTrips,
  buildProfileMapData,
  buildProfileStatsFromTrips,
  buildTopTrip,
  extractAirportCode,
  haversineKm,
  normalizeStatsCountries,
} from '../profileStats';

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

const moments: Moment[] = [
  { id: 'm1', caption: '', date: '2024-04-21', tags: [], photo: 'https://example.com/1.jpg', userId: 'u1' },
  { id: 'm2', caption: '', date: '2024-04-22', tags: [], photo: 'https://example.com/2.jpg', userId: 'u1' },
];

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

describe('profileStats', () => {
  it('builds travel stats from visible trips and moments', () => {
    const stats = buildProfileStatsFromTrips({
      trips: [
        baseTrip,
        { ...baseTrip, id: 'draft', isDraft: true },
        { ...baseTrip, id: 'deleted', deletedAt: '2026-01-01T00:00:00Z' },
      ],
      moments,
      flights,
    });

    expect(stats.totalTrips).toBe(1);
    expect(stats.totalCountries).toBe(1);
    expect(stats.totalNights).toBe(7);
    expect(stats.totalSpent).toBe(36420);
    expect(stats.totalMoments).toBe(2);
    expect(stats.totalMiles).toBeGreaterThan(100);
    expect(stats.countriesList).toEqual(['Philippines']);
  });

  it('does not count multiple Philippine places as multiple countries', () => {
    const stats = buildProfileStatsFromTrips({
      trips: [
        { ...baseTrip, id: 'boracay', destination: 'Boracay', country: undefined, countryCode: undefined },
        { ...baseTrip, id: 'cebu', destination: 'Cebu', country: undefined, countryCode: undefined },
        { ...baseTrip, id: 'caticlan', destination: 'Caticlan', country: undefined, countryCode: undefined },
      ],
      moments,
    });

    expect(stats.totalTrips).toBe(3);
    expect(stats.totalCountries).toBe(1);
    expect(stats.countriesList).toEqual(['Philippines']);
  });

  it('normalizes place-like lifetime country lists before display', () => {
    const normalized = normalizeStatsCountries({
      totalTrips: 3,
      totalCountries: 3,
      totalNights: 21,
      totalMiles: 378,
      totalSpent: 0,
      homeCurrency: 'PHP',
      totalMoments: 102,
      countriesList: ['Boracay', 'Boracay, Philippines', 'Cebu'],
    });

    expect(normalized.totalCountries).toBe(1);
    expect(normalized.countriesList).toEqual(['Philippines']);
    expect(buildCountriesVisited(normalized)).toEqual([
      { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
    ]);
  });

  it('prefers lifetime stats when available and derives display helpers', () => {
    const lifetime: LifetimeStats = {
      totalTrips: 13,
      totalCountries: 8,
      totalNights: 75,
      totalMiles: 9754,
      totalSpent: 348000,
      homeCurrency: 'PHP',
      totalMoments: 23,
      countriesList: ['Philippines', 'Thailand'],
      earliestTripDate: '2024-01-10',
    };

    expect(buildCountriesVisited(lifetime)).toEqual([
      { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
      { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
    ]);
    expect(buildAchievementBadges(lifetime).map((badge) => badge.key)).toEqual([
      'explorer',
      'globetrotter',
      'memory_maker',
    ]);
  });

  it('selects the strongest completed top trip', () => {
    const top = buildTopTrip([
      baseTrip,
      { ...baseTrip, id: 'short', destination: 'Tokyo', totalSpent: 1000, nights: 2 },
      { ...baseTrip, id: 'upcoming', status: 'Planning', destination: 'Seoul', totalSpent: 999999 },
    ]);

    expect(top?.id).toBe('trip-1');
    expect(top?.destination).toBe('Boracay, Philippines');
  });

  it('extracts airport codes from scanned flight labels', () => {
    expect(extractAirportCode('Manila (MNL)')).toBe('MNL');
    expect(extractAirportCode('Godofredo P. Ramos / Caticlan')).toBe('MPH');
    expect(extractAirportCode('Tokyo')).toBe('TYO');
  });

  it('builds map routes and total distance from flights', () => {
    const mapData = buildProfileMapData({ trips: [baseTrip], flights, homeBase: 'Manila' });

    expect(mapData.homeAirportCode).toBe('MNL');
    expect(mapData.routes).toHaveLength(1);
    expect(mapData.routes[0].fromCode).toBe('MNL');
    expect(mapData.routes[0].toCode).toBe('MPH');
    expect(mapData.destinations.map((destination) => destination.code)).toEqual(['MPH']);
    expect(mapData.totalKm).toBeGreaterThan(250);
  });

  it('falls back to trip coordinates when airport codes are unknown', () => {
    const mapData = buildProfileMapData({
      trips: [{ ...baseTrip, destination: 'Mystery Beach', countryCode: 'PH' }],
      flights: [{ ...flights[0], from: 'Unknown origin', to: 'Unknown destination' }],
    });

    expect(mapData.routes).toHaveLength(0);
    expect(mapData.destinations).toHaveLength(1);
    expect(mapData.destinations[0].label).toBe('Mystery Beach');
    expect(mapData.totalKm).toBeGreaterThan(0);
  });

  it('calculates route distances with haversine', () => {
    expect(Math.round(haversineKm({ lat: 14.5086, lng: 121.0195 }, { lat: 11.9245, lng: 121.9540 }))).toBeGreaterThan(280);
  });

  it('chooses an explicit profile cover before travel photos', () => {
    expect(buildProfileCoverPhotoUrl({
      explicitCoverUrl: 'https://example.com/cover.jpg',
      moments,
      fallbackUrl: 'https://example.com/fallback.jpg',
    })).toBe('https://example.com/cover.jpg');
  });

  it('falls back to the first moment photo for profile cover', () => {
    expect(buildProfileCoverPhotoUrl({
      moments,
      fallbackUrl: 'https://example.com/fallback.jpg',
    })).toBe('https://example.com/1.jpg');
  });

  it('returns undefined when no profile cover source exists', () => {
    expect(buildProfileCoverPhotoUrl({ moments: [] })).toBeUndefined();
  });

  it('builds compact travel progress items from visited countries', () => {
    const progress = buildTravelProgressItems({
      totalTrips: 13,
      totalCountries: 8,
      totalNights: 75,
      totalMiles: 9754,
      totalSpent: 348000,
      homeCurrency: 'PHP',
      totalMoments: 23,
      countriesList: ['Philippines', 'Thailand', 'Vietnam', 'Indonesia', 'Singapore', 'Japan'],
    });

    expect(progress.map((item) => item.label)).toEqual(['Philippines', 'Thailand', 'Vietnam', 'Indonesia']);
    expect(progress[0].flag).toBe('🇵🇭');
    expect(progress[3].progress).toBe(1);
  });

  it('builds travel progress stops separately from country count', () => {
    const progress = buildTravelProgressItemsFromTrips([
      { ...baseTrip, id: 'boracay', destination: 'Boracay, Philippines', country: undefined, countryCode: undefined },
      { ...baseTrip, id: 'cebu', destination: 'Cebu', country: undefined, countryCode: undefined },
      { ...baseTrip, id: 'caticlan', destination: 'Caticlan', country: undefined, countryCode: undefined },
    ]);

    expect(progress.map((item) => item.label)).toEqual(['Boracay', 'Cebu', 'Caticlan']);
    expect(progress.every((item) => item.flag === '🇵🇭')).toBe(true);
  });
});
