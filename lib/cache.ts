// Thin AsyncStorage cache for offline-ish support.
// Stores raw JSON under a user-scoped namespaced key with a timestamp.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'afterstay:v2:';

// Current user ID — set by auth provider on sign-in, cleared on sign-out.
let _userId: string | undefined;

export function setCacheUserId(userId: string | undefined) {
  _userId = userId;
}

function scopedKey(key: string): string {
  return _userId ? `${PREFIX}${_userId}:${key}` : `${PREFIX}anon:${key}`;
}

interface Entry<T> {
  t: number;
  v: T;
}

/** Default TTL: 30 minutes. Pass 0 to skip expiry check. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export async function cacheGet<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(key));
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
    if (ttlMs > 0 && Date.now() - entry.t > ttlMs) {
      // Expired — remove stale entry
      AsyncStorage.removeItem(scopedKey(key)).catch(() => {});
      return undefined;
    }
    return entry.v;
  } catch {
    return undefined;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const entry: Entry<T> = { t: Date.now(), v: value };
    await AsyncStorage.setItem(scopedKey(key), JSON.stringify(entry));
  } catch {
    // Best-effort only.
  }
}

/**
 * Clear all trip-specific local data on trip transitions.
 * Profile settings, theme, notification prefs, and onboarding flag are preserved.
 */
export async function clearTripLocalData(): Promise<void> {
  // Scoped cache keys (go through scopedKey)
  const scopedKeys = [
    'trip:active',
    'trip:phase:override',
    'discover:anchor',
    'discover:travelMode',
  ];
  for (const key of scopedKeys) {
    try { await AsyncStorage.removeItem(scopedKey(key)); } catch { /* ignore */ }
  }

  // Also clear any flights:* keys
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const flightKeys = allKeys.filter(k => k.includes(':flights:'));
    if (flightKeys.length > 0) await AsyncStorage.multiRemove(flightKeys);
  } catch { /* ignore */ }

  // Global (non-scoped) keys that are trip-specific
  const globalTripKeys = [
    'quickAccess_v1',
    'top_picks_hidden',
    'top_picks_pool',
    'fate_names',
    'fate_decides_history',
  ];
  try {
    await AsyncStorage.multiRemove(globalTripKeys);
  } catch { /* ignore */ }
}
