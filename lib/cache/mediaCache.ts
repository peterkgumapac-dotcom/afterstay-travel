import { Paths, File, Directory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MEDIA_DIR_NAME = 'media-v2'; // v2: new hash + validated downloads
const MIN_VALID_BYTES = 100;
const MAX_CONCURRENT = 6; // limit parallel downloads

const CACHE_VERSION_KEY = 'media-cache-version';
const CURRENT_VERSION = '2';

let activeDownloads = 0;
const pendingQueue: Array<() => void> = [];

function runNext() {
  if (pendingQueue.length > 0 && activeDownloads < MAX_CONCURRENT) {
    activeDownloads++;
    const next = pendingQueue.shift()!;
    next();
  }
}

function withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeDownloads--;
          runNext();
        });
    };

    if (activeDownloads < MAX_CONCURRENT) {
      activeDownloads++;
      run();
    } else {
      pendingQueue.push(run);
    }
  });
}

function fnvHash(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = (h * 0x01000193) | 0;
  }
  return Math.abs(h).toString(36);
}

function extensionFrom(url: string): string {
  const match = url.match(/\.(jpe?g|png|webp|avif|gif)/i);
  return match ? match[0].toLowerCase() : '.jpg';
}

function getMediaDir(): Directory {
  return new Directory(Paths.cache, MEDIA_DIR_NAME);
}

/** Wipe old cache dirs on version bump. */
export async function migrateMediaCache(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_VERSION_KEY);
    if (stored === CURRENT_VERSION) return;

    // Clear old v1 cache
    const oldDir = new Directory(Paths.cache, 'media');
    if (oldDir.exists) oldDir.delete();

    await AsyncStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
  } catch { /* ignore */ }
}

/**
 * Returns a local file URI for the given remote URL.
 * Downloads and caches on first access; serves from disk cache thereafter.
 */
export async function cachedImageUri(remoteUrl: string): Promise<string> {
  const filename = `${fnvHash(remoteUrl)}${extensionFrom(remoteUrl)}`;
  const mediaDir = getMediaDir();
  const localFile = new File(mediaDir, filename);

  if (localFile.exists) {
    try {
      const size = localFile.size ?? 0;
      if (size >= MIN_VALID_BYTES) return localFile.uri;
      localFile.delete();
    } catch { /* treat as missing */ }
  }

  return withConcurrency(async () => {
    // Re-check after waiting in queue — another call may have cached it
    if (localFile.exists) {
      const size = localFile.size ?? 0;
      if (size >= MIN_VALID_BYTES) return localFile.uri;
    }

    if (!mediaDir.exists) mediaDir.create();

    const tempFile = new File(Paths.cache, `tmp_${Date.now()}_${filename}`);
    try {
      await File.downloadFileAsync(remoteUrl, tempFile);

      if (!tempFile.exists) throw new Error('Download produced no file');
      const downloadedSize = tempFile.size ?? 0;
      if (downloadedSize < MIN_VALID_BYTES) {
        tempFile.delete();
        throw new Error(`Download too small: ${downloadedSize}b`);
      }

      tempFile.move(localFile);
      return localFile.uri;
    } catch (err) {
      try { if (tempFile.exists) tempFile.delete(); } catch { /* ignore */ }
      throw err;
    }
  });
}

/** Remove a single cached image. */
export function evictCachedImage(remoteUrl: string): void {
  const filename = `${fnvHash(remoteUrl)}${extensionFrom(remoteUrl)}`;
  const localFile = new File(getMediaDir(), filename);
  try { if (localFile.exists) localFile.delete(); } catch { /* ignore */ }
}
