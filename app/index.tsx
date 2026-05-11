import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGetForUser, cacheSetForUser } from '@/lib/cache';
import { getOnboardingProgress, isOnboardingIncomplete } from '@/lib/onboardingProgress';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import type { Profile } from '@/lib/supabase';
import { markStartup } from '@/lib/startupPerf';
import { getStartupSnapshot } from '@/lib/startupSnapshot';
import { preloadHomeData } from '@/hooks/useTabHomeData';

type IndexTarget = 'welcome' | 'onboarding' | 'home' | null;

function routeHome(setTarget: (target: IndexTarget) => void) {
  markStartup('route_decided', { target: 'home' });
  preloadHomeData().catch(() => {});
  setTarget('home');
}

function routeTo(target: Exclude<IndexTarget, null>, setTarget: (target: IndexTarget) => void) {
  markStartup('route_decided', { target });
  setTarget(target);
}

function profileImpliesExistingAccount(profile: Profile | null): boolean {
  if (!profile) return false;
  const onboardingStatus = String(profile.onboardingState?.status ?? '').toLowerCase();
  return (
    profile.tripCount > 0 ||
    profile.completedTripCount > 0 ||
    Boolean(profile.lastTripId) ||
    Boolean(profile.onboardedAt) ||
    onboardingStatus === 'complete' ||
    onboardingStatus === 'skipped' ||
    profile.userSegment !== 'new'
  );
}

export default function Index() {
  const { session, loading } = useAuth();
  const {
    segment,
    profile,
    activeTrip,
    pastTrips,
    draftTrips,
    loading: segmentLoading,
  } = useUserSegment();
  const [target, setTarget] = useState<'welcome' | 'onboarding' | 'home' | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setTarget(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const userId = session.user.id;
      try {
        const cachedFlag = await cacheGetForUser<boolean>(`onboarding_complete:${userId}`, userId);
        const snapshot = await getStartupSnapshot(userId);

        if (cancelled) return;
        if (cachedFlag || (snapshot && snapshot.segment !== 'new')) {
          routeHome(setTarget);
          return;
        }

        if (segmentLoading) return;

        const progress = await getOnboardingProgress(userId);
        if (cancelled) return;
        if (progress && isOnboardingIncomplete(progress)) {
          if (progress.stage === 'planning_draft') routeHome(setTarget);
          else routeTo('onboarding', setTarget);
          return;
        }
        if (progress?.status === 'complete' || progress?.status === 'skipped') {
          await cacheSetForUser(`onboarding_complete:${userId}`, true, userId);
          routeHome(setTarget);
          return;
        }

        const hasExistingProfileState = profileImpliesExistingAccount(profile);
        const hasTripState = Boolean(activeTrip) || pastTrips.length > 0 || draftTrips.length > 0;
        if (segment !== 'new' || hasTripState || hasExistingProfileState) {
          await cacheSetForUser(`onboarding_complete:${userId}`, true, userId);
          routeHome(setTarget);
        } else if (cachedFlag) {
          routeHome(setTarget);
        } else {
          routeTo('welcome', setTarget);
        }
      } catch (err) {
        if (__DEV__) console.error('[Index] error deriving status:', err);
        const cachedFlag = await cacheGetForUser<boolean>(`onboarding_complete:${userId}`, userId);
        const cachedProgress = await getOnboardingProgress(userId);
        if (cancelled) return;
        if (cachedProgress && isOnboardingIncomplete(cachedProgress)) {
          if (cachedProgress.stage === 'planning_draft') routeHome(setTarget);
          else routeTo('onboarding', setTarget);
        } else if (cachedFlag) routeHome(setTarget);
        else routeTo('welcome', setTarget);
      }
    })();
    return () => { cancelled = true; };
  }, [
    activeTrip,
    draftTrips.length,
    loading,
    pastTrips.length,
    profile,
    segment,
    segmentLoading,
    session,
  ]);

  if (loading || (session && target === null)) {
    return (
      <AfterStayLoader
        message={loading ? 'Opening AfterStay...' : 'Finding your trip state...'}
        steps={[
          'Checking your session',
          'Looking for onboarding progress',
          'Loading trips for this account',
          'Sending you to the right screen',
        ]}
      />
    );
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (target === 'welcome') return <Redirect href="/welcome" />;
  if (target === 'onboarding') return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)/home" />;
}
