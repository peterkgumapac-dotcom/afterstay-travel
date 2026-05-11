import {
  pickHomeLoadedTrip,
  pickHomeSeedTrip,
  profileImpliesHomeHistory,
  resolveHomeHistoryStatus,
} from '../homeStartup';

describe('home startup trip selection', () => {
  const contextTrip = { id: 'trip-context' };
  const cachedTrip = { id: 'trip-cache' };

  it('does not let a cached null hide the segment active trip', () => {
    expect(pickHomeSeedTrip(null, undefined, contextTrip)).toBe(contextTrip);
    expect(pickHomeSeedTrip(undefined, null, contextTrip)).toBe(contextTrip);
  });

  it('keeps a real cached trip ahead of the context seed', () => {
    expect(pickHomeSeedTrip(cachedTrip, undefined, contextTrip)).toBe(cachedTrip);
  });

  it('falls back to segment trip after a non-forced null active-trip fetch', () => {
    expect(pickHomeLoadedTrip(null, contextTrip, false)).toBe(contextTrip);
  });

  it('allows forced refresh to clear stale context when the backend has no active trip', () => {
    expect(pickHomeLoadedTrip(null, contextTrip, true)).toBeNull();
  });

  it('does not classify a timed-out empty response as confirmed empty history', () => {
    expect(resolveHomeHistoryStatus({
      tripCount: 0,
      quickTripCount: 0,
      profileSuggestsHistory: false,
      uncertain: true,
    })).toBe('unknown');
  });

  it('keeps returning accounts out of the first-time branch when profile signals history', () => {
    const profile = { completedTripCount: 1, userSegment: 'returning' };
    expect(profileImpliesHomeHistory(profile)).toBe(true);
    expect(resolveHomeHistoryStatus({
      tripCount: 0,
      quickTripCount: 0,
      profileSuggestsHistory: profileImpliesHomeHistory(profile),
      uncertain: true,
    })).toBe('hasHistory');
  });

  it('only confirms empty history after authoritative empty trip and quick-trip data', () => {
    expect(resolveHomeHistoryStatus({
      tripCount: 0,
      quickTripCount: 0,
      profileSuggestsHistory: false,
      uncertain: false,
    })).toBe('empty');
  });
});
