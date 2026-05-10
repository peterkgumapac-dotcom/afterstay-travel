import { cacheGet, cacheSet } from '@/lib/cache';
import type { DiscoverMode } from '@/components/discover/DiscoverModeSwitch';

const DISCOVER_MODE_CACHE_KEY = 'discover_mode';
const EXPLORE_MOMENTS_LAUNCH_KEY = 'discover_mode_explore_launch_seen_v1';

export async function getInitialDiscoverMode(routeMode: DiscoverMode | null): Promise<DiscoverMode> {
  if (routeMode) {
    rememberDiscoverMode(routeMode);
    return routeMode;
  }

  const [cachedMode, hasSeenExploreLaunch] = await Promise.all([
    cacheGet<string>(DISCOVER_MODE_CACHE_KEY, 0),
    cacheGet<boolean>(EXPLORE_MOMENTS_LAUNCH_KEY, 0),
  ]);

  if (!hasSeenExploreLaunch) {
    rememberDiscoverMode('explore_moments');
    return 'explore_moments';
  }

  return cachedMode === 'explore_moments' || cachedMode === 'plan'
    ? cachedMode
    : 'explore_moments';
}

export function rememberDiscoverMode(mode: DiscoverMode) {
  cacheSet(DISCOVER_MODE_CACHE_KEY, mode);
  cacheSet(EXPLORE_MOMENTS_LAUNCH_KEY, true);
}
