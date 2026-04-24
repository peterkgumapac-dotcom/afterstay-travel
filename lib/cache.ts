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

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(key));
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as Entry<T>;
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
