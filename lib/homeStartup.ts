export function pickHomeSeedTrip<T>(
  memoryTrip: T | null | undefined,
  persistedTrip: T | null | undefined,
  contextTrip: T | null,
): T | null | undefined {
  if (memoryTrip) return memoryTrip;
  if (persistedTrip) return persistedTrip;
  if (contextTrip) return contextTrip;
  if (memoryTrip === null || persistedTrip === null) return null;
  return undefined;
}

export function pickHomeLoadedTrip<T>(
  fetchedTrip: T | null,
  contextTrip: T | null,
  forceRefresh: boolean,
): T | null {
  if (fetchedTrip) return fetchedTrip;
  return forceRefresh ? null : contextTrip;
}
