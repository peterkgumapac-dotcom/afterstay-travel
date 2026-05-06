import { CONFIG } from '@/lib/config';
import type { FeedPost } from '@/lib/types';

// Authoritative: only the server-issued userId grants verified status.
// Display name, handle, and badges are not trusted in a multi-tenant feed —
// they could be user- or tenant-controlled and impersonated.
//
// Source: EXPO_PUBLIC_OFFICIAL_AFTERSTAY_USER_ID env var → CONFIG.OFFICIAL_AFTERSTAY_USER_ID.
// When unset, no account is treated as official (safe default).
export const OFFICIAL_AFTERSTAY_HANDLE = 'afterstay';

function officialUserId(): string {
  return CONFIG.OFFICIAL_AFTERSTAY_USER_ID;
}

export function isOfficialAfterStayIdentity(input: {
  userId?: string | null;
  handle?: string | null;
  fullName?: string | null;
  badges?: readonly string[] | null;
}): boolean {
  const expected = officialUserId();
  return !!expected && input.userId === expected;
}

export function isOfficialAfterStayPost(post: Pick<FeedPost, 'userId' | 'userName' | 'metadata'>): boolean {
  const expected = officialUserId();
  return !!expected && post.userId === expected;
}

export function isTravelPulsePost(post: Pick<FeedPost, 'metadata' | 'type'>): boolean {
  const metadata = post.metadata ?? {};
  return (
    metadata.postType === 'travel_pulse' ||
    metadata.contentType === 'travel_pulse' ||
    metadata.series === 'travel_pulse'
  );
}
