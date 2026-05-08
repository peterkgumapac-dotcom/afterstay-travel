import { supabase } from '@/lib/supabase';

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const SIGNED_URL_REFRESH_MARGIN_MS = 60 * 60 * 1000;
const SIGNED_URL_CACHE_MAX = 300;
const signedUrlCache = new Map<string, { url: string; expiresAtMs: number }>();

type StorageRef = {
  bucket: string;
  path: string;
};

function parseSupabaseStorageRef(value: string, fallbackBucket: string): StorageRef | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('http')) {
    return { bucket: fallbackBucket, path: trimmed.replace(/^\/+/, '') };
  }

  const marker = '/storage/v1/object/';
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) return null;

  const afterObject = trimmed.slice(markerIndex + marker.length);
  const bucketAndPath = afterObject.replace(/^public\//, '').replace(/^sign\//, '').split('?')[0];
  const slashIndex = bucketAndPath.indexOf('/');
  if (slashIndex <= 0) return null;

  return {
    bucket: bucketAndPath.slice(0, slashIndex),
    path: decodeURIComponent(bucketAndPath.slice(slashIndex + 1)),
  };
}

function pruneSignedUrlCache(now = Date.now()): void {
  for (const [key, value] of signedUrlCache) {
    if (value.expiresAtMs <= now) signedUrlCache.delete(key);
  }
  while (signedUrlCache.size > SIGNED_URL_CACHE_MAX) {
    const firstKey = signedUrlCache.keys().next().value;
    if (!firstKey) break;
    signedUrlCache.delete(firstKey);
  }
}

export async function resolveRenderableStorageUrl(
  value?: string,
  fallbackBucket = 'moments',
): Promise<string | undefined> {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (raw.startsWith('file:') || raw.startsWith('content:') || raw.startsWith('data:')) return raw;

  const ref = parseSupabaseStorageRef(raw, fallbackBucket);
  if (!ref) return raw.startsWith('http') ? raw : undefined;

  const cacheKey = `${ref.bucket}/${ref.path}`;
  pruneSignedUrlCache();
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAtMs - Date.now() > SIGNED_URL_REFRESH_MARGIN_MS) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .createSignedUrl(ref.path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return raw.startsWith('http') ? raw : undefined;

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAtMs: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  pruneSignedUrlCache();
  return data.signedUrl;
}
