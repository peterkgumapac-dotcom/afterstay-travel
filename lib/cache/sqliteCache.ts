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

// ---------------------------------------------------------------------------
// Cache diagnostics
// ---------------------------------------------------------------------------

export async function getCacheStats(): Promise<{ photoCount: number; favoriteCount: number }> {
  const database = await getDb();
  const photoRow = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM photo_metadata`);
  const favRow = await database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM offline_favorites`);
  return {
    photoCount: photoRow?.count ?? 0,
    favoriteCount: favRow?.count ?? 0,
  };
}
