import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import AfterStayLoader from '@/components/AfterStayLoader';
import { cacheGet } from '@/lib/cache';
import { getActiveTrip } from '@/lib/supabase';

export default function Index() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const flag = await cacheGet<boolean>('onboarding_complete');
        if (flag) {
          setOnboarded(true);
        } else {
          const trip = await getActiveTrip().catch(() => null);
          setOnboarded(!!trip);
        }
      } catch {
        setOnboarded(false);
      }
    })();
  }, [session]);

  if (loading || (session && onboarded === null)) {
    return <AfterStayLoader />;
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (onboarded === false) return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)/home" />;
}
