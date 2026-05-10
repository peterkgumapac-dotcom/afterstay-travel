import * as Updates from 'expo-updates';

const DISCOVER_DIAGNOSTICS_ENABLED = __DEV__;

export function logDiscoverDiagnostics(event: string, payload: Record<string, unknown>) {
  if (!DISCOVER_DIAGNOSTICS_ENABLED) return;
  console.info('[DiscoverDiagnostics]', event, {
    updateId: Updates.updateId?.slice(0, 8) ?? null,
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    ...payload,
  });
}
