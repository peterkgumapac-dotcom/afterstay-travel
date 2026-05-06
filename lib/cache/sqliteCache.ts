import * as SQLite from 'expo-sqlite';

const DB_NAME = 'afterstay_cache.db';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initTables();
  return db;
}

async function initTables() {
  const database = await getDb();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS photo_metadata (
      id TEXT PRIMARY KEY NOT NULL,
      trip_id TEXT,
      photo_url TEXT,
      caption TEXT,
      location TEXT,
      date TEXT,
      taken_by TEXT,
      visibility TEXT,
      favorite_count INTEGER DEFAULT 0,
      is_favorited INTEGER DEFAULT 0,
      cached_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_photo_trip ON photo_metadata(trip_id);
    CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(date);

    CREATE TABLE IF NOT EXISTS offline_favorites (
      moment_id TEXT PRIMARY KEY NOT NULL,
      is_favorited INTEGER DEFAULT 1,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mutation_queue_user ON mutation_queue(user_id);
    CREATE INDEX IF NOT EXISTS idx_mutation_queue_created ON mutation_queue(created_at);
  `);
}

// ---------------------------------------------------------------------------
// Photo metadata cache
// ---------------------------------------------------------------------------

export interface CachedPhotoMeta {
  id: string;
  tripId?: string;
  photoUrl?: string;
  caption?: string;
  location?: string;
  date?: string;
  takenBy?: string;
  visibility?: string;
  favoriteCount?: number;
  isFavorited?: boolean;
}

export async function cachePhotoMeta(photos: CachedPhotoMeta[]): Promise<void> {
  const database = await getDb();
  const now = Date.now();
  const statement = await database.prepareAsync(
    `INSERT OR REPLACE INTO photo_metadata
      (id, trip_id, photo_url, caption, location, date, taken_by, visibility, favorite_count, is_favorited, cached_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const p of photos) {
      await statement.executeAsync([
        p.id,
        p.tripId ?? null,
        p.photoUrl ?? null,
        p.caption ?? null,
        p.location ?? null,
        p.date ?? null,
        p.takenBy ?? null,
        p.visibility ?? null,
        p.favoriteCount ?? 0,
        p.isFavorited ? 1 : 0,
        now,
      ]);
    }
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getCachedPhotosByTrip(tripId: string): Promise<CachedPhotoMeta[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM photo_metadata WHERE trip_id = ? ORDER BY date DESC`,
    [tripId]
  );
  return rows.map(row => ({
    id: row.id,
    tripId: row.trip_id,
    photoUrl: row.photo_url,
    caption: row.caption,
    location: row.location,
    date: row.date,
    takenBy: row.taken_by,
    visibility: row.visibility,
    favoriteCount: row.favorite_count,
    isFavorited: row.is_favorited === 1,
  }));
}

export async function getCachedPhotoById(id: string): Promise<CachedPhotoMeta | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<any>(
    `SELECT * FROM photo_metadata WHERE id = ?`,
    [id]
  );
  if (!row) return null;
  return {
    id: row.id,
    tripId: row.trip_id,
    photoUrl: row.photo_url,
    caption: row.caption,
    location: row.location,
    date: row.date,
    takenBy: row.taken_by,
    visibility: row.visibility,
    favoriteCount: row.favorite_count,
    isFavorited: row.is_favorited === 1,
  };
}

export async function clearPhotoCache(tripId?: string): Promise<void> {
  const database = await getDb();
  if (tripId) {
    await database.runAsync(`DELETE FROM photo_metadata WHERE trip_id = ?`, [tripId]);
  } else {
    await database.runAsync(`DELETE FROM photo_metadata`);
  }
}

// ---------------------------------------------------------------------------
// Offline favorites
// ---------------------------------------------------------------------------

export async function setOfflineFavorite(momentId: string, isFavorited: boolean): Promise<void> {
  const database = await getDb();
  if (isFavorited) {
    await database.runAsync(
      `INSERT OR REPLACE INTO offline_favorites (moment_id, is_favorited, updated_at) VALUES (?, 1, ?)`,
      [momentId, Date.now()]
    );
  } else {
    await database.runAsync(
      `DELETE FROM offline_favorites WHERE moment_id = ?`,
      [momentId]
    );
  }
}

export async function getOfflineFavorites(): Promise<Set<string>> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ moment_id: string }>(
    `SELECT moment_id FROM offline_favorites WHERE is_favorited = 1`
  );
  return new Set(rows.map(r => r.moment_id));
}

export async function clearOfflineFavorites(): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM offline_favorites`);
}

export async function clearSQLiteAccountCache(): Promise<void> {
  const database = await getDb();
  // Note: mutation_queue is intentionally NOT cleared here. It is bound to
  // the queued user via the user_id column and gets pruned per-user by
  // clearMutationQueueForUser() during sign-out so a user signing back in
  // can still drain pending writes they made offline.
  await database.execAsync(`
    DELETE FROM photo_metadata;
    DELETE FROM offline_favorites;
  `);
}

// ---------------------------------------------------------------------------
// Mutation queue (offline writes)
// ---------------------------------------------------------------------------

export interface QueuedMutation {
  id: string;
  userId?: string;
  kind: string;
  payload: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export async function enqueueMutationRow(row: Omit<QueuedMutation, 'attempts' | 'lastError'>): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO mutation_queue (id, user_id, kind, payload, created_at, attempts, last_error)
     VALUES (?, ?, ?, ?, ?, 0, NULL)`,
    [row.id, row.userId ?? null, row.kind, row.payload, row.createdAt],
  );
}

export async function listPendingMutationsForUser(userId: string | undefined): Promise<QueuedMutation[]> {
  const database = await getDb();
  const where = userId ? `WHERE user_id = ?` : `WHERE user_id IS NULL`;
  const args = userId ? [userId] : [];
  const rows = await database.getAllAsync<{
    id: string;
    user_id: string | null;
    kind: string;
    payload: string;
    created_at: number;
    attempts: number;
    last_error: string | null;
  }>(`SELECT * FROM mutation_queue ${where} ORDER BY created_at ASC`, args);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id ?? undefined,
    kind: r.kind,
    payload: r.payload,
    createdAt: r.created_at,
    attempts: r.attempts,
    lastError: r.last_error ?? undefined,
  }));
}

export async function deleteMutationRow(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(`DELETE FROM mutation_queue WHERE id = ?`, [id]);
}

export async function markMutationFailedRow(id: string, errorMessage: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `UPDATE mutation_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
    [errorMessage, id],
  );
}

export async function clearMutationQueueForUser(userId: string | undefined): Promise<void> {
  const database = await getDb();
  if (userId) {
    await database.runAsync(`DELETE FROM mutation_queue WHERE user_id = ?`, [userId]);
  } else {
    await database.runAsync(`DELETE FROM mutation_queue WHERE user_id IS NULL`);
  }
}

// ---------------------------------------------------------------------------
// Cache diagnostics
// ---------------------------------------------------------------------------

export async function getCacheStats(): Promise<{ photoCount: number; favoriteCount: number; queuedMutationCount: number }> {
  const database = await getDb();
  const photoRow = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM photo_metadata`);
  const favRow = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM offline_favorites`);
  const queueRow = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM mutation_queue`);
  return {
    photoCount: photoRow?.count ?? 0,
    favoriteCount: favRow?.count ?? 0,
    queuedMutationCount: queueRow?.count ?? 0,
  };
}
