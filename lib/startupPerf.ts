import * as Sentry from '@sentry/react-native';

type StartupMarker =
  | 'js_start'
  | 'fonts_ready'
  | 'auth_session_ready'
  | 'route_decided'
  | 'home_cached_paint'
  | 'home_fresh_hydrated';

const startupStartMs = globalThis.performance?.now?.() ?? Date.now();
const markers = new Map<StartupMarker, number>();

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function markStartup(name: StartupMarker, data?: Record<string, unknown>): void {
  if (markers.has(name)) return;
  const elapsedMs = Math.round(nowMs() - startupStartMs);
  markers.set(name, elapsedMs);

  if (__DEV__) {
    console.log(`[startup] ${name} ${elapsedMs}ms`, data ?? '');
    return;
  }

  Sentry.addBreadcrumb({
    category: 'startup',
    message: name,
    level: 'info',
    data: { elapsedMs, ...data },
  });
}

markStartup('js_start');
