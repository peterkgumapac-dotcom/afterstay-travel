/**
 * Tab Data Cache
 *
 * In-memory promise-based cache for instant tab switching.
 * Keeps the last fetched data available so tabs never show
 * loading states when revisited.
 */

import { use, useMemo } from 'react';

const dataCache = new Map<string, unknown>();
const promiseCache = new Map<string, Promise<unknown>>();
const timestampCache = new Map<string, number>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cacheUserId: string | undefined;

export interface CacheOptions {
  ttlMs?: number;
  forceRefresh?: boolean;
}

export function setTabDataCacheUserId(userId: string | undefined): void {
  if (cacheUserId === userId) return;
  clearTabDataCache();
  cacheUserId = userId;
}

export function clearTabDataCache(): void {
  dataCache.clear();
  promiseCache.clear();
  timestampCache.clear();
}

function scopedKey(key: string): string {
  return cacheUserId ? `${cacheUserId}:${key}` : `anon:${key}`;
}

export function getCachedPromise<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, forceRefresh = false } = options;
  const cacheKey = scopedKey(key);

  if (forceRefresh) {
    dataCache.delete(cacheKey);
    promiseCache.delete(cacheKey);
    timestampCache.delete(cacheKey);
  }

  // Return existing promise if inflight
  if (promiseCache.has(cacheKey)) {
    return promiseCache.get(cacheKey) as Promise<T>;
  }

  // Check cached data freshness
  const cached = dataCache.get(cacheKey) as T | undefined;
  const ts = timestampCache.get(cacheKey);
  if (cached !== undefined && ts !== undefined && Date.now() - ts < ttlMs) {
    return Promise.resolve(cached);
  }

  // Create new promise
  const promise = fetcher()
    .then((data) => {
      dataCache.set(cacheKey, data);
      timestampCache.set(cacheKey, Date.now());
      promiseCache.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      promiseCache.delete(cacheKey);
      throw err;
    });

  promiseCache.set(cacheKey, promise);
  return promise as Promise<T>;
}

export function getCachedData<T>(key: string): T | undefined {
  return dataCache.get(scopedKey(key)) as T | undefined;
}

export function setCachedData<T>(key: string, data: T): void {
  const cacheKey = scopedKey(key);
  dataCache.set(cacheKey, data);
  timestampCache.set(cacheKey, Date.now());
}

export function hasCachedData(key: string): boolean {
  return dataCache.has(scopedKey(key));
}

export function invalidateCache(keyPattern?: string): void {
  if (keyPattern) {
    for (const key of dataCache.keys()) {
      if (key.includes(keyPattern)) {
        dataCache.delete(key);
        promiseCache.delete(key);
        timestampCache.delete(key);
      }
    }
  } else {
    dataCache.clear();
    promiseCache.clear();
    timestampCache.clear();
  }
}

export function invalidateTripCache(tripId?: string): void {
  if (tripId) {
    invalidateCache(`trip:${tripId}`);
  }
  invalidateCache('trips:');
  invalidateCache('activeTrip');
  invalidateCache('home:');
}

/**
 * React 19 use() wrapper for reading cached promises inside components.
 * Suspends until the promise resolves, then returns the data.
 */
export function useCachedPromise<T>(key: string, fetcher: () => Promise<T>): T {
  const promise = useMemo(() => getCachedPromise(key, fetcher), [key]);
  return use(promise) as T;
}

/**
 * Non-suspending hook — returns cached data immediately if available,
 * undefined otherwise. Use for cache-first UIs.
 */
export function useCachedData<T>(key: string): T | undefined {
  return useMemo(() => getCachedData<T>(key), [key]);
}
