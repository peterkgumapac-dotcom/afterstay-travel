import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { Platform, Vibration } from 'react-native';

const TAP_THROTTLE_MS = 80;

export interface UseHapticsReturn {
  tap: () => void;
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
  heartbeatTick: (intensity: 'light' | 'medium' | 'heavy') => void;
}

function fireAndForget(fn: () => Promise<void>) {
  fn().catch(() => {
    // Haptics unavailable on this device — fall back to vibration on Android
    if (Platform.OS === 'android') {
      Vibration.vibrate(50);
    }
  });
}

export function useHaptics(): UseHapticsReturn {
  const lastTapRef = useRef(0);

  const tap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_THROTTLE_MS) return;
    lastTapRef.current = now;
    fireAndForget(() => Haptics.selectionAsync());
  }, []);

  const light = useCallback(() => {
    fireAndForget(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, []);

  const medium = useCallback(() => {
    fireAndForget(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, []);

  const heavy = useCallback(() => {
    fireAndForget(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  }, []);

  const success = useCallback(() => {
    fireAndForget(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  }, []);

  const warning = useCallback(() => {
    fireAndForget(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }, []);

  const error = useCallback(() => {
    fireAndForget(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }, []);

  const heartbeatTick = useCallback((intensity: 'light' | 'medium' | 'heavy') => {
    switch (intensity) {
      case 'light':
        light();
        break;
      case 'medium':
        medium();
        break;
      case 'heavy':
        heavy();
        break;
    }
  }, [light, medium, heavy]);

  return { tap, light, medium, heavy, success, warning, error, heartbeatTick };
}
