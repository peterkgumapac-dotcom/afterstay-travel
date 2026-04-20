// Offline writes queue — stores failed mutations in AsyncStorage
// and retries them when connectivity returns.

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offline_queue';

interface QueueEntry {
  readonly id: string;
  readonly fn: string;
  readonly args: readonly unknown[];
  readonly createdAt: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readQueue(): Promise<readonly QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueEntry[];
  } catch {
    return [];
  }
}

async function writeQueue(entries: readonly QueueEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

/** Add a failed mutation to the offline queue. */
export async function enqueue(fnName: string, args: unknown[]): Promise<void> {
  const current = await readQueue();
  const entry: QueueEntry = {
    id: generateId(),
    fn: fnName,
    args,
    createdAt: Date.now(),
  };
  await writeQueue([...current, entry]);
}

/**
 * Retry all queued items against the provided function registry.
 * Successful items are removed; failed items stay in the queue.
 */
export async function processQueue(
  registry: Record<string, (...args: unknown[]) => Promise<unknown>>,
): Promise<{ processed: number; failed: number }> {
  const current = await readQueue();
  if (current.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  const remaining: QueueEntry[] = [];

  for (const entry of current) {
    const handler = registry[entry.fn];
    if (!handler) {
      remaining.push(entry);
      continue;
    }
    try {
      await handler(...entry.args);
      processed += 1;
    } catch {
      remaining.push(entry);
    }
  }

  await writeQueue(remaining);
  return { processed, failed: remaining.length };
}

/** Return the number of pending items in the queue. */
export async function getQueueSize(): Promise<number> {
  const current = await readQueue();
  return current.length;
}

/** Remove all items from the offline queue. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
