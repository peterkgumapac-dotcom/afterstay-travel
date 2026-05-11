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

export type HomeHistoryStatus = 'unknown' | 'empty' | 'hasHistory';

export type HomeHistoryProfileSignal = {
  tripCount?: number | null;
  completedTripCount?: number | null;
  lastTripId?: string | null;
  onboardedAt?: string | null;
  onboardingState?: Record<string, unknown> | null;
  userSegment?: string | null;
} | null;

export function profileImpliesHomeHistory(profile: HomeHistoryProfileSignal): boolean {
  if (!profile) return false;
  const onboardingStatus = String(profile.onboardingState?.status ?? '').toLowerCase();
  return (
    (profile.tripCount ?? 0) > 0 ||
    (profile.completedTripCount ?? 0) > 0 ||
    Boolean(profile.lastTripId) ||
    Boolean(profile.onboardedAt) ||
    onboardingStatus === 'complete' ||
    onboardingStatus === 'skipped' ||
    (profile.userSegment != null && profile.userSegment !== 'new')
  );
}

export function resolveHomeHistoryStatus(input: {
  tripCount: number;
  quickTripCount: number;
  profileSuggestsHistory: boolean;
  uncertain: boolean;
}): HomeHistoryStatus {
  if (input.tripCount > 0 || input.quickTripCount > 0 || input.profileSuggestsHistory) {
    return 'hasHistory';
  }
  return input.uncertain ? 'unknown' : 'empty';
}
