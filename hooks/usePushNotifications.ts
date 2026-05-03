import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { registerPushNotificationsForUser } from '@/lib/pushRegistration';

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

    const userId = user.id;
    let Notifs: any = null;

    async function setup() {
      // expo-notifications crashes in Expo Go since SDK 53.
      // Entire setup wrapped in try/catch — push is best-effort.
      try {
        Notifs = await import('expo-notifications');

        const registration = await registerPushNotificationsForUser(userId);
        if (registration.status !== 'registered') return;
        setToken(registration.token);

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
              case 'moment_comment':
              case 'moments_added':
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
      } catch (err) {
        if (__DEV__) console.warn('[Push] setup failed:', err);
        return;
      }
    }

    setup();

    return () => {
      listenersRef.current.forEach((sub) => sub.remove());
      listenersRef.current = [];
    };
  }, [router, user?.id]);

  return { token };
}
