import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getOnboardingProgress, isOnboardingIncomplete } from '@/lib/onboardingProgress';
import { deriveUserStatus } from '@/lib/userStatus';
import { getProfile, type Profile } from '@/lib/supabase';
import { preloadHomeData } from '@/hooks/useTabHomeData';

type IndexTarget = 'welcome' | 'onboarding' | 'home' | null;

function routeHome(setTarget: (target: IndexTarget) => void) {
  preloadHomeData().catch(() => {});
  setTarget('home');
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
  const [target, setTarget] = useState<'welcome' | 'onboarding' | 'home' | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setTarget(null);
      return;
    }
    (async () => {
      try {
        const progress = await getOnboardingProgress(session.user.id);
        if (progress && isOnboardingIncomplete(progress)) {
          if (__DEV__) console.log('[Index] resuming onboarding:', progress.stage);
          if (progress.stage === 'planning_draft') routeHome(setTarget);
          else setTarget('onboarding');
          return;
        }
        if (progress?.status === 'complete' || progress?.status === 'skipped') {
          await cacheSet(`onboarding_complete:${session.user.id}`, true);
          routeHome(setTarget);
          return;
        }

        const flag = await cacheGet<boolean>(`onboarding_complete:${session.user.id}`);

        // Derive status from Supabase trips.
        // Retries are built into deriveUserStatus (auth token race on cold start)
        const [result, profile] = await Promise.all([
          deriveUserStatus(session.user.id),
          getProfile(session.user.id).catch(() => null),
        ]);
        const hasExistingProfileState = profileImpliesExistingAccount(profile);
        if (__DEV__)
          console.log(
            '[Index] derived status:',
            result.status,
            '| trips:',
            result.completedTrips.length + result.planningTrips.length + (result.activeTrip ? 1 : 0),
            '| profileExisting:',
            hasExistingProfileState,
          );

        if (result.uncertain || result.error) {
          if (__DEV__) console.warn('[Index] trip status uncertain — avoiding new-user redirect:', result.error);
          const cachedFlag = await cacheGet<boolean>(`onboarding_complete:${session.user.id}`);
          const cachedProgress = await getOnboardingProgress(session.user.id);
          if (hasExistingProfileState) {
            await cacheSet(`onboarding_complete:${session.user.id}`, true);
            routeHome(setTarget);
          } else if (cachedProgress && isOnboardingIncomplete(cachedProgress)) {
            if (cachedProgress.stage === 'planning_draft') routeHome(setTarget);
            else setTarget('onboarding');
          } else {
            if (cachedFlag === false) setTarget('welcome');
            else routeHome(setTarget);
          }
          return;
        }

        if (result.status !== 'new' || hasExistingProfileState) {
          // User has trips — restore the flag and skip onboarding
          await cacheSet(`onboarding_complete:${session.user.id}`, true);
          routeHome(setTarget);
        } else if (flag) {
          // A cached completion flag can let a truly no-trip returning account
          // into Home, but it must never skip the fresh status check above.
          routeHome(setTarget);
        } else {
          setTarget('welcome');
        }
      } catch (err) {
        if (__DEV__) console.error('[Index] error deriving status:', err);
        const cachedFlag = await cacheGet<boolean>(`onboarding_complete:${session.user.id}`);
        const cachedProgress = await getOnboardingProgress(session.user.id);
        if (cachedProgress && isOnboardingIncomplete(cachedProgress)) {
          if (cachedProgress.stage === 'planning_draft') routeHome(setTarget);
          else setTarget('onboarding');
        } else if (cachedFlag) routeHome(setTarget);
        else setTarget('welcome');
      }
    })();
  }, [session, loading]);

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
