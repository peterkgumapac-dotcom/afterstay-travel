import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { lightColors } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';

export default function MyProfileRoute() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      router.replace('/auth/login' as never);
      return;
    }
    router.replace({ pathname: '/profile/[userId]', params: { userId: user.id, source: 'self' } } as never);
  }, [loading, router, user?.id]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={lightColors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.bg,
  },
});
