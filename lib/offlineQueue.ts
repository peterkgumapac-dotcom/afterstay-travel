/**
 * Offline mutation queue.
 *
 * When a write fails because the network is unavailable, persist it to
 * SQLite and replay it on the next app foreground / successful read /
 * explicit replay() call. Mutations are processed FIFO per user so the
 * server sees them in the order the user made them.
 *
 * Why no NetInfo dependency: real network detection requires a native
 * library + new EAS build. This queue treats any thrown error from the
 * mutation as a candidate for queueing — `isLikelyOfflineError()` decides
 * which errors mean "retry later" vs "real server error".
 *
 * Handlers are registered at module load by callers (see lib/supabase.ts
 * for the togglePacked wiring). Each handler receives the original
 * payload back; if it throws again at replay time, the row stays queued
 * with attempts incremented.
 */
import * as Crypto from 'expo-crypto';

import {
  clearMutationQueueForUser,
  deleteMutationRow,
  enqueueMutationRow,
  listPendingMutationsForUser,
  markMutationFailedRow,
} from './cache/sqliteCache';

type MutationHandler<P = unknown> = (payload: P) => Promise<void>;

const handlers = new Map<string, MutationHandler>();

let activeUserId: string | undefined;
let replayInFlight = false;

export function setOfflineQueueUserId(userId: string | undefined): void {
  activeUserId = userId;
}

export function registerMutationHandler<P>(kind: string, handler: MutationHandler<P>): void {
  handlers.set(kind, handler as MutationHandler);
}

export function isLikelyOfflineError(err: unknown): boolean {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  // Supabase/PostgREST surfaces these as plain Error.message strings.
  // We deliberately match conservatively — auth errors, RLS denies, and
  // 4xx responses must NOT be queued (queueing them would silently swallow
  // a real bug). Network-layer failures look like fetch failures or DNS
  // errors. Unknown errors fall through to "real server error".
  const offlineSignals = [
    'Network request failed',
    'fetch failed',
    'Failed to fetch',
    'TypeError: Network',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'Network connection lost',
    'The Internet connection appears to be offline',
  ];
  return offlineSignals.some((signal) => message.includes(signal));
}

export interface EnqueueOptions {
  /** Override the active user id (rarely needed). */
  userId?: string;
}

export async function enqueueMutation<P>(
  kind: string,
  payload: P,
  options: EnqueueOptions = {},
): Promise<string> {
  const id = Crypto.randomUUID();
  await enqueueMutationRow({
    id,
    userId: options.userId ?? activeUserId,
    kind,
    payload: JSON.stringify(payload),
    createdAt: Date.now(),
  });
  return id;
}

/**
 * Try the live mutation; on a likely-offline error, queue the same payload
 * for later replay. The optimistic UI update should already be applied by
 * the caller — this helper is the network-layer concern only.
 *
 * Returns true if the live mutation succeeded, false if it was queued.
 * Throws for non-offline errors (real failures the caller must handle).
 */
export async function tryOrQueueMutation<P>(
  kind: string,
  payload: P,
  liveCall: () => Promise<void>,
): Promise<{ delivered: boolean; queueId?: string }> {
  try {
    await liveCall();
    return { delivered: true };
  } catch (err) {
    if (!isLikelyOfflineError(err)) throw err;
    const queueId = await enqueueMutation(kind, payload);
    return { delivered: false, queueId };
  }
}

/**
 * Drain the queue for the active user. Call on app foreground, after
 * sign-in, and after a successful read finishes (best-effort).
 *
 * Concurrent calls are coalesced via `replayInFlight`.
 */
export async function replayPendingMutations(): Promise<{ replayed: number; failed: number }> {
  if (replayInFlight) return { replayed: 0, failed: 0 };
  replayInFlight = true;
  let replayed = 0;
  let failed = 0;
  try {
    const rows = await listPendingMutationsForUser(activeUserId);
    for (const row of rows) {
      const handler = handlers.get(row.kind);
      if (!handler) {
        // No handler registered (yet) — leave the row, it will retry on
        // the next replay. This protects against module-load ordering
        // issues where the queue replays before consumers register.
        continue;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(row.payload);
      } catch {
        // Corrupt row — drop it so it doesn't block the queue forever.
        await deleteMutationRow(row.id);
        failed += 1;
        continue;
      }
      try {
        await handler(payload);
        await deleteMutationRow(row.id);
        replayed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isLikelyOfflineError(err)) {
          // Still offline — stop draining; we'll resume on next foreground.
          await markMutationFailedRow(row.id, message);
          failed += 1;
          break;
        }
        // Non-offline error means the server actively rejected the
        // mutation. After 5 attempts give up so a permanent rejection
        // doesn't wedge the queue. Surface in last_error for diagnostics.
        await markMutationFailedRow(row.id, message);
        failed += 1;
        if (row.attempts + 1 >= 5) {
          await deleteMutationRow(row.id);
        }
      }
    }
  } finally {
    replayInFlight = false;
  }
  return { replayed, failed };
}

export async function pendingMutationCount(): Promise<number> {
  const rows = await listPendingMutationsForUser(activeUserId);
  return rows.length;
}

export async function dropPendingMutationsForActiveUser(): Promise<void> {
  await clearMutationQueueForUser(activeUserId);
}
