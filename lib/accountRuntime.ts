import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearTripLocalData } from '@/lib/cache';
import { clearSQLiteAccountCache } from '@/lib/cache/sqliteCache';
import { queryClient } from '@/lib/queryClient';
import { clearTripCache } from '@/lib/supabase';
import { clearTabDataCache } from '@/lib/tabDataCache';
import { clearWidgetSnapshots } from '@/widgets/refresh';

const GLOBAL_ACCOUNT_KEYS = [
  'notif_dismissed_local',
  'quickAccess_v1',
  'top_picks_hidden',
  'top_picks_pool',
  'fate_names',
  'fate_decides_history',
];

export async function clearAccountRuntimeState(): Promise<void> {
  clearTripCache();
  clearTabDataCache();

  await queryClient.cancelQueries().catch(() => {});
  queryClient.clear();

  await Promise.allSettled([
    clearTripLocalData(),
    clearSQLiteAccountCache(),
    clearWidgetSnapshots(),
    AsyncStorage.multiRemove(GLOBAL_ACCOUNT_KEYS),
  ]);
}
