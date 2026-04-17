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

export async function cacheClear(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(k => k.startsWith(PREFIX));
    await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}

// Stale-while-revalidate wrapper: returns cached immediately (if any), kicks off
// fetch, and calls onUpdate with fresh data when it lands.
export async function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate: (value: T) => void
): Promise<T | undefined> {
  const cached = await cacheGet<T>(key);
  fetcher()
    .then(async value => {
      await cacheSet(key, value);
      onUpdate(value);
    })
    .catch(() => {
      // On error, keep the cached value (if any).
    });
  return cached;
}
