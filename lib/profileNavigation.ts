import type { Router } from 'expo-router';

function profileHref(targetUserId: string, currentUserId?: string) {
  if (currentUserId && targetUserId === currentUserId) {
    return '/profile/me' as never;
  }

  return {
    pathname: '/profile/[userId]',
    params: { userId: targetUserId },
  } as never;
}

export function pushProfile(router: Pick<Router, 'push'>, targetUserId?: string | null, currentUserId?: string | null) {
  if (!targetUserId) return;
  router.push(profileHref(targetUserId, currentUserId ?? undefined));
}
