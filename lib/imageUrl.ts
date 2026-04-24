// Image URL helpers — append Supabase Storage transform params for responsive sizing.
// Uses the standard /object/public/ endpoint with transform query params.
// If transforms aren't enabled on the Supabase project, the original image is returned
// (Supabase ignores unknown query params on the public endpoint).

import { CONFIG } from './config';

const SUPABASE_HOST = CONFIG.SUPABASE_URL?.replace('https://', '') ?? '';

type ImageSize = 'thumb' | 'small' | 'medium' | 'full';

const SIZE_MAP: Record<ImageSize, number> = {
  thumb: 150,
  small: 300,
  medium: 600,
  full: 800,
};

/**
 * Returns an image URL with width hint. For Supabase Storage URLs,
 * appends ?width=N. For other URLs, returns as-is.
 * Safe even if Supabase Image Transforms aren't enabled — the param is ignored.
 */
export function imageUrl(url: string | undefined, size: ImageSize = 'medium'): string | undefined {
  if (!url) return undefined;
  // Only add params to Supabase Storage URLs
  if (!SUPABASE_HOST || !url.includes(SUPABASE_HOST)) return url;
  if (!url.includes('/storage/v1/object/public/')) return url;

  const width = SIZE_MAP[size];
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}`;
}

export const thumbUrl = (url: string | undefined) => imageUrl(url, 'thumb');
export const smallUrl = (url: string | undefined) => imageUrl(url, 'small');
export const mediumUrl = (url: string | undefined) => imageUrl(url, 'medium');
export const fullUrl = (url: string | undefined) => imageUrl(url, 'full');
