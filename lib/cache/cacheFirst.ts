import { storage } from './storage';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

interface CachedEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

interface CacheFirstOptions {
  ttlMs?: number;
  staleWhileRevalidate?: boolean;
  forceRefresh?: boolean;
}

function isFresh<T>(entry: CachedEntry<T>): boolean {
  return Date.now() - entry.cachedAt < entry.ttlMs;
}

function readEntry<T>(key: string): CachedEntry<T> | undefined {
  try {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as CachedEntry<T>;
  } catch {
    return undefined;
  }
}

function writeEntry<T>(key: string, data: T, ttlMs: number): void {
  const entry: CachedEntry<T> = { data, cachedAt: Date.now(), ttlMs };
  storage.set(key, JSON.stringify(entry));
}

export async function cacheFirst<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheFirstOptions = {},
): Promise<T> {
  const {
    ttlMs = FIVE_MINUTES_MS,
    staleWhileRevalidate = true,
    forceRefresh = false,
  } = options;

  if (!forceRefresh) {
    const entry = readEntry<T>(key);
    if (entry) {
      if (isFresh(entry)) return entry.data;

      if (staleWhileRevalidate) {
        fetcher()
          .then((fresh) => writeEntry(key, fresh, ttlMs))
          .catch(() => {});
        return entry.data;
      }
    }
  }

  const fresh = await fetcher();
  writeEntry(key, fresh, ttlMs);
  return fresh;
}
