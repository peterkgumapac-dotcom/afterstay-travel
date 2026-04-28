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

export interface CacheOptions {
  ttlMs?: number;
  forceRefresh?: boolean;
}

export function getCachedPromise<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttlMs = DEFAULT_TTL_MS, forceRefresh = false } = options;

  if (forceRefresh) {
    dataCache.delete(key);
    promiseCache.delete(key);
    timestampCache.delete(key);
  }

  // Return existing promise if inflight
  if (promiseCache.has(key)) {
    return promiseCache.get(key) as Promise<T>;
  }

  // Check cached data freshness
  const cached = dataCache.get(key) as T | undefined;
  const ts = timestampCache.get(key);
  if (cached !== undefined && ts !== undefined && Date.now() - ts < ttlMs) {
    return Promise.resolve(cached);
  }

  // Create new promise
  const promise = fetcher()
    .then((data) => {
      dataCache.set(key, data);
      timestampCache.set(key, Date.now());
      promiseCache.delete(key);
      return data;
    })
    .catch((err) => {
      promiseCache.delete(key);
      throw err;
    });

  promiseCache.set(key, promise);
  return promise as Promise<T>;
}

export function getCachedData<T>(key: string): T | undefined {
  return dataCache.get(key) as T | undefined;
}

export function setCachedData<T>(key: string, data: T): void {
  dataCache.set(key, data);
  timestampCache.set(key, Date.now());
}

export function hasCachedData(key: string): boolean {
  return dataCache.has(key);
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
