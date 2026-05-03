import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const EAS_PROJECT_ID = 'a804380e-5c0d-425e-ac2b-7c07b8b81fd4';

type PushProvider = 'firebase' | 'expo';

export type PushRegistrationResult =
  | {
      status: 'registered';
      provider: PushProvider;
      token: string;
      fcmToken: string | null;
      expoPushToken: string | null;
    }
  | {
      status: 'denied' | 'unavailable' | 'failed';
      message: string;
    };

function getProjectId(): string {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    (Constants.manifest as { extra?: { eas?: { projectId?: string } } } | null)?.extra?.eas?.projectId ??
    Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ??
    EAS_PROJECT_ID
  );
}

async function savePushTokens({
  userId,
  fcmToken,
  expoPushToken,
  provider,
}: {
  userId: string;
  fcmToken: string | null;
  expoPushToken: string | null;
  provider: PushProvider;
}) {
  const { error: rpcError } = await supabase.rpc('save_own_push_tokens', {
    p_fcm_token: fcmToken,
    p_expo_push_token: expoPushToken,
    p_push_provider: provider,
    p_push_enabled: true,
  });

  if (!rpcError) return;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      fcm_token: fcmToken,
      expo_push_token: expoPushToken,
      push_provider: provider,
      push_enabled: true,
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(updateError.message || rpcError.message || 'Unable to save push token.');
  }
}

export async function registerPushNotificationsForUser(userId: string): Promise<PushRegistrationResult> {
  if (!userId) {
    return { status: 'failed', message: 'You need to be signed in before enabling notifications.' };
  }

  let Notifs: typeof import('expo-notifications');
  try {
    Notifs = await import('expo-notifications');
  } catch {
    return {
      status: 'unavailable',
      message: 'Push notifications are not available in this app build.',
    };
  }

  try {
    Notifs.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const permission = await Notifs.getPermissionsAsync();
    let finalStatus = permission.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifs.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return {
        status: 'denied',
        message: 'Notification permission is not enabled for this device.',
      };
    }

    if (Platform.OS === 'android') {
      try {
        await Notifs.deleteNotificationChannelAsync('default');
      } catch {
        // Best-effort cleanup for the old silent channel.
      }
      await Notifs.setNotificationChannelAsync('afterstay', {
        name: 'AfterStay',
        importance: Notifs.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4A574',
        sound: 'default',
        enableVibrate: true,
      });
    }

    const projectId = getProjectId();
    const [devicePushToken, expoPushToken] = await Promise.all([
      Notifs.getDevicePushTokenAsync().catch(() => null),
      Notifs.getExpoPushTokenAsync({ projectId }).catch(() => null),
    ]);

    const fcmToken =
      Platform.OS === 'android' &&
      typeof devicePushToken?.data === 'string' &&
      devicePushToken.data.length > 0
        ? devicePushToken.data
        : null;
    const expoToken = typeof expoPushToken?.data === 'string' ? expoPushToken.data : null;
    const token = fcmToken ?? expoToken;

    if (!token) {
      return {
        status: 'failed',
        message: 'Permission is enabled, but the device did not return a push token.',
      };
    }

    const provider: PushProvider = fcmToken ? 'firebase' : 'expo';
    await savePushTokens({ userId, fcmToken, expoPushToken: expoToken, provider });

    return {
      status: 'registered',
      provider,
      token,
      fcmToken,
      expoPushToken: expoToken,
    };
  } catch (err) {
    if (__DEV__) console.warn('[Push] registration failed:', err);
    return {
      status: 'failed',
      message: err instanceof Error ? err.message : 'Unable to register this device for push notifications.',
    };
  }
}
