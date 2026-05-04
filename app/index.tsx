import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getOnboardingProgress, isOnboardingIncomplete } from '@/lib/onboardingProgress';
import { deriveUserStatus } from '@/lib/userStatus';
import { preloadHomeData } from '@/hooks/useTabHomeData';

type IndexTarget = 'welcome' | 'onboarding' | 'home' | null;

function routeHome(setTarget: (target: IndexTarget) => void) {
  preloadHomeData().catch(() => {});
  setTarget('home');
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
        if (flag) {
          if (__DEV__) console.log('[Index] onboarding flag cached — skipping check');
          routeHome(setTarget);
          return;
        }

        // Derive status from Supabase trips.
        // Retries are built into deriveUserStatus (auth token race on cold start)
        const result = await deriveUserStatus(session.user.id);
        if (__DEV__)
          console.log(
            '[Index] derived status:',
            result.status,
            '| trips:',
            result.completedTrips.length + result.planningTrips.length + (result.activeTrip ? 1 : 0),
          );

        if (result.uncertain || result.error) {
          if (__DEV__) console.warn('[Index] trip status uncertain — avoiding new-user redirect:', result.error);
          const cachedFlag = await cacheGet<boolean>(`onboarding_complete:${session.user.id}`);
          const cachedProgress = await getOnboardingProgress(session.user.id);
          if (cachedProgress && isOnboardingIncomplete(cachedProgress)) {
            if (cachedProgress.stage === 'planning_draft') routeHome(setTarget);
            else setTarget('onboarding');
          } else {
            if (cachedFlag === false) setTarget('welcome');
            else routeHome(setTarget);
          }
          return;
        }

        if (result.status !== 'new') {
          // User has trips — restore the flag and skip onboarding
          await cacheSet(`onboarding_complete:${session.user.id}`, true);
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
