import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { cacheGet } from '@/lib/cache';
import { getActiveTrip } from '@/lib/supabase';

export default function Index() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (onboarded === false) return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)/home" />;
}
