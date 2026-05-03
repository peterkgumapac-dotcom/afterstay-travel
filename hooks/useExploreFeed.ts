import { useState, useCallback, useEffect, useRef } from 'react';

import { getExploreFeed, getSavedPosts } from '@/lib/moments/exploreMomentsService';
import type { FeedPost } from '@/lib/types';

type FeedMode = 'recent' | 'trending' | 'saved';

const PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, (error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function mergePosts(existing: FeedPost[], next: FeedPost[]): FeedPost[] {
  const seen = new Set(existing.map((post) => post.id));
  const merged = [...existing];
  for (const post of next) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }
  return merged;
}

interface UseExploreFeedResult {
  posts: FeedPost[];
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addLocal: (post: FeedPost) => void;
  updateLocal: (postId: string, updater: (post: FeedPost) => FeedPost) => void;
  error: string | null;
}

export function useExploreFeed(mode: FeedMode = 'recent', enabled = true): UseExploreFeedResult {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback((offset: number) => {
    const promise = mode === 'saved'
      ? getSavedPosts(PAGE_SIZE, offset)
      : getExploreFeed({ mode, limit: PAGE_SIZE, offset });
    return withTimeout(promise, 'Moments are taking too long to load. Pull to retry.');
  }, [mode]);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const firstLoad = !loadedOnceRef.current;
    if (firstLoad) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const page = await fetchPage(0);
      if (!mountedRef.current) return;
      setPosts(page);
      offsetRef.current = page.length;
      setHasMore(page.length >= PAGE_SIZE);
      loadedOnceRef.current = true;
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
      loadingRef.current = false;
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const page = await fetchPage(offsetRef.current);
      if (!mountedRef.current) return;
      setPosts((prev) => mergePosts(prev, page));
      offsetRef.current += page.length;
      setHasMore(page.length >= PAGE_SIZE);
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load more');
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
      loadingRef.current = false;
    }
  }, [fetchPage, hasMore]);

  const addLocal = useCallback((post: FeedPost) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const updateLocal = useCallback((postId: string, updater: (post: FeedPost) => FeedPost) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? updater(post) : post)));
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { posts, isLoading, isRefreshing, hasMore, loadMore, refresh, addLocal, updateLocal, error };
}
