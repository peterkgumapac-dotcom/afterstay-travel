import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

/**
 * Registers for Expo push notifications, saves token to Supabase,
 * and handles notification taps for deep linking.
 *
 * Lazy-loads expo-notifications to avoid crashes when native module is missing.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const listenersRef = useRef<{ remove: () => void }[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    let Notifs: any = null;

    async function setup() {
      // expo-notifications crashes in Expo Go since SDK 53.
      // Entire setup wrapped in try/catch — push is best-effort.
      try {
        Notifs = await import('expo-notifications');

        // Probe — throws if native module unavailable
        const perm = await Notifs.getPermissionsAsync();
        let finalStatus = perm.status;

        // Configure foreground behavior
        Notifs.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        // Request permission
        if (finalStatus !== 'granted') {
          const { status } = await Notifs.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // Android channel
        if (Platform.OS === 'android') {
          await Notifs.setNotificationChannelAsync('default', {
            name: 'AfterStay',
            importance: 4,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D4A574',
          });
        }

        // Get push token
        let projectId: string | undefined;
        try {
          const Constants = require('expo-constants').default;
          projectId = Constants.expoConfig?.extra?.eas?.projectId;
        } catch { /* ignore */ }
        if (!projectId) return;

        const pushToken = await Notifs.getExpoPushTokenAsync({ projectId });
        setToken(pushToken.data);

        // Save token and enable push
        await supabase
          .from('profiles')
          .update({ expo_push_token: pushToken.data, push_enabled: true })
          .eq('id', user!.id);

        // Listen for notifications while app is open
        const sub1 = Notifs.addNotificationReceivedListener(() => {});
        listenersRef.current.push(sub1);

        // Listen for user tapping a notification — route by type
        const sub2 = Notifs.addNotificationResponseReceivedListener(
          (response: any) => {
            const data = response?.notification?.request?.content?.data;
            if (!data) return;
            switch (data.type) {
              case 'vote_needed':
                router.push('/(tabs)/discover' as never); break;
              case 'expense_added':
              case 'budget_threshold':
                router.push('/(tabs)/budget' as never); break;
              case 'member_joined':
                router.push('/(tabs)/trip' as never); break;
              case 'trip_recap_ready':
                router.push('/(tabs)/moments' as never); break;
              case 'flight_boarding':
              case 'departure_prep':
              case 'trip_starting':
              case 'last_day':
              case 'check_in_reminder':
              case 'check_out_reminder':
                router.push('/(tabs)/home' as never); break;
              default:
                if (data.tripId) router.push('/(tabs)/home' as never);
                if (data.expenseId) router.push('/(tabs)/budget' as never);
            }
          },
        );
        listenersRef.current.push(sub2);
      } catch {
        // Push notifications not available — silently ignore
        return;
      }
    }

    setup();

    return () => {
      listenersRef.current.forEach((sub) => sub.remove());
      listenersRef.current = [];
    };
  }, [user?.id]);

  return { token };
}
