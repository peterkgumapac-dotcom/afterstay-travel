// Thin AsyncStorage cache for offline-ish support.
// Stores raw JSON under a namespaced key with a timestamp.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'afterstay:v1:';

interface Entry<T> {
  t: number;
  v: T;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
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
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Best-effort only.
  }
}

