import type { LifetimeStats, Moment, Trip } from '../types';
import {
  buildAchievementBadges,
  buildCountriesVisited,
  buildProfileStatsFromTrips,
  buildTopTrip,
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

describe('profileStats', () => {
  it('builds travel stats from visible trips and moments', () => {
    const stats = buildProfileStatsFromTrips({
      trips: [
        baseTrip,
        { ...baseTrip, id: 'draft', isDraft: true },
        { ...baseTrip, id: 'deleted', deletedAt: '2026-01-01T00:00:00Z' },
      ],
      moments,
    });

    expect(stats.totalTrips).toBe(1);
    expect(stats.totalCountries).toBe(1);
    expect(stats.totalNights).toBe(7);
    expect(stats.totalSpent).toBe(36420);
    expect(stats.totalMoments).toBe(2);
    expect(stats.countriesList).toEqual(['Philippines']);
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
});
