import { pickHomeLoadedTrip, pickHomeSeedTrip } from '../homeStartup';

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
});
