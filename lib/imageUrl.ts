// Image URL helpers — append Supabase Storage transform params for responsive sizing.
// Only works with Supabase Storage public URLs; external URLs pass through unchanged.

import { CONFIG } from './config';

const SUPABASE_HOST = CONFIG.SUPABASE_URL?.replace('https://', '') ?? '';

type ImageSize = 'thumb' | 'small' | 'medium' | 'full';

const SIZE_MAP: Record<ImageSize, { width: number; quality: number }> = {
  thumb: { width: 150, quality: 60 },
  small: { width: 300, quality: 70 },
  medium: { width: 600, quality: 75 },
  full: { width: 800, quality: 80 },
};

/**
 * Returns a resized image URL using Supabase Storage transforms.
 * Falls back to the original URL for non-Supabase images.
 */
export function imageUrl(url: string | undefined, size: ImageSize = 'medium'): string | undefined {
  if (!url) return undefined;

  // Only transform Supabase Storage URLs
  if (!SUPABASE_HOST || !url.includes(SUPABASE_HOST)) return url;
  if (!url.includes('/storage/v1/object/public/')) return url;

  // Convert /object/public/ to /render/image/public/ for transforms
  const transformUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  );

  const { width, quality } = SIZE_MAP[size];
  return `${transformUrl}?width=${width}&quality=${quality}&resize=contain`;
}

/**
 * Shorthand helpers
 */
export const thumbUrl = (url: string | undefined) => imageUrl(url, 'thumb');
export const smallUrl = (url: string | undefined) => imageUrl(url, 'small');
export const mediumUrl = (url: string | undefined) => imageUrl(url, 'medium');
export const fullUrl = (url: string | undefined) => imageUrl(url, 'full');
