import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getOnboardingProgress, isOnboardingIncomplete } from '@/lib/onboardingProgress';
import { deriveUserStatus } from '@/lib/userStatus';
import { supabase } from '@/lib/supabase';

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
          setTarget(progress.stage === 'planning_draft' ? 'home' : 'onboarding');
          return;
        }
        if (progress?.status === 'complete' || progress?.status === 'skipped') {
          await cacheSet(`onboarding_complete:${session.user.id}`, true);
          setTarget('home');
          return;
        }

        const flag = await cacheGet<boolean>(`onboarding_complete:${session.user.id}`);
        if (flag) {
          if (__DEV__) console.log('[Index] onboarding flag cached — skipping check');
          setTarget('home');
          return;
        }

        // Ensure Supabase auth token is fully propagated before querying
        const { data: authData } = await supabase.auth.getUser();
        if (__DEV__) console.log('[Index] auth user:', authData.user?.id?.slice(0, 8));

        // Derive status from Supabase trips.
        // Retries are built into deriveUserStatus (auth token race on cold start)
        const result = await deriveUserStatus(session.user.id);
        if (__DEV__) console.log('[Index] derived status:', result.status, '| trips:', result.completedTrips.length + result.planningTrips.length + (result.activeTrip ? 1 : 0));

        if (result.status !== 'new') {
          // User has trips — restore the flag and skip onboarding
          await cacheSet(`onboarding_complete:${session.user.id}`, true);
          setTarget('home');
        } else {
          setTarget('welcome');
        }
      } catch (err) {
        if (__DEV__) console.error('[Index] error deriving status:', err);
        const cachedFlag = await cacheGet<boolean>(`onboarding_complete:${session.user.id}`);
        const cachedProgress = await getOnboardingProgress(session.user.id);
        if (cachedProgress && isOnboardingIncomplete(cachedProgress)) setTarget(cachedProgress.stage === 'planning_draft' ? 'home' : 'onboarding');
        else setTarget(cachedFlag ? 'home' : 'welcome');
      }
    })();
  }, [session, loading]);

  if (loading || (session && target === null)) {
    return <AfterStayLoader />;
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (target === 'welcome') return <Redirect href="/welcome" />;
  if (target === 'onboarding') return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)/home" />;
}
