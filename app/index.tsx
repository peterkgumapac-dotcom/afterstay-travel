import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getActiveTrip } from '@/lib/supabase';

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
          setOnboarded(true);
          return;
        }

        // No cache flag — check if user has existing trips in Supabase
        // This handles OTA updates or cache clears gracefully
        const trip = await getActiveTrip().catch(() => null);
        if (trip) {
          // User has trips — restore the flag and skip onboarding
          await cacheSet('onboarding_complete', true);
          setOnboarded(true);
        } else {
          setOnboarded(false);
        }
      } catch {
        // Network error — if we have a session, assume onboarded
        // Better to show home with loading than block on onboarding
        setOnboarded(true);
      }
    })();
  }, [session, loading]);

  if (loading || (session && onboarded === null)) {
    return <AfterStayLoader />;
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (onboarded === false) return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)/home" />;
}
