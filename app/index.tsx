import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGet, cacheSet } from '@/lib/cache';
import { deriveUserStatus } from '@/lib/userStatus';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setOnboarded(null);
      return;
    }
    (async () => {
      try {
        // Check cache flag first
        const flag = await cacheGet<boolean>('onboarding_complete');
        if (flag) {
          console.log('[Index] onboarding flag cached — skipping check');
          setOnboarded(true);
          return;
        }

        // Ensure Supabase auth token is fully propagated before querying
        const { data: authData } = await supabase.auth.getUser();
        console.log('[Index] auth user:', authData.user?.id?.slice(0, 8));

        // Derive status from Supabase trips.
        // Retries are built into deriveUserStatus (auth token race on cold start)
        const result = await deriveUserStatus(session.user.id);
        console.log('[Index] derived status:', result.status, '| trips:', result.completedTrips.length + result.planningTrips.length + (result.activeTrip ? 1 : 0));

        if (result.status !== 'new') {
          // User has trips — restore the flag and skip onboarding
          await cacheSet('onboarding_complete', true);
          setOnboarded(true);
        } else {
          setOnboarded(false);
        }
      } catch (err) {
        console.error('[Index] error deriving status:', err);
        // Network error — if we have a session, assume onboarded
        setOnboarded(true);
      }
    })();
  }, [session, loading]);

  if (loading || (session && onboarded === null)) {
    return <AfterStayLoader />;
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (onboarded === false) return <Redirect href="/welcome" />;

  return <Redirect href="/(tabs)/home" />;
}
