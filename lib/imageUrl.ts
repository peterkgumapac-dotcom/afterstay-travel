// Image URL helpers.
// When Supabase Image Transforms are enabled, these can append ?width=N.
//
// A few third-party image hosts rate-limit mobile image clients aggressively.
// Keep those out of always-on hero surfaces so a failed remote image does not
// turn every cold launch into another doomed network request.

const BLOCKED_RENDER_HOSTS = new Set([
  'upload.wikimedia.org',
]);

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isRenderableRemoteImageUrl(url: string | undefined | null): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const host = hostFor(url);
  if (!host) return false;
  return !BLOCKED_RENDER_HOSTS.has(host);
}

export function filterRenderableImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (!isRenderableRemoteImageUrl(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

export function imageUrl(url: string | undefined): string | undefined {
  return isRenderableRemoteImageUrl(url) ? url : undefined;
}

export const thumbUrl = (url: string | undefined) => url;
export const smallUrl = (url: string | undefined) => url;
export const mediumUrl = (url: string | undefined) => url;
export const fullUrl = (url: string | undefined) => url;
