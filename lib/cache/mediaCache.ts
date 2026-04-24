import { Paths, File, Directory } from 'expo-file-system';

const MEDIA_DIR_NAME = 'media';
const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500 MB
const MIN_VALID_BYTES = 100; // Anything smaller is likely corrupted

function simpleHash(url: string): string {
  // FNV-1a inspired — better distribution than shift-subtract
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

/**
 * Returns a local file URI for the given remote URL.
 * Downloads and caches on first access; serves from disk cache thereafter.
 * Validates file size to prevent serving corrupted/empty downloads.
 */
export async function cachedImageUri(remoteUrl: string): Promise<string> {
  const filename = `${simpleHash(remoteUrl)}${extensionFrom(remoteUrl)}`;
  const mediaDir = getMediaDir();
  const localFile = new File(mediaDir, filename);

  // Serve from cache if file exists AND is non-trivial in size
  if (localFile.exists) {
    try {
      const size = localFile.size ?? 0;
      if (size >= MIN_VALID_BYTES) return localFile.uri;
      // Corrupted — remove and re-download
      localFile.delete();
    } catch {
      // Can't stat — treat as missing
    }
  }

  if (!mediaDir.exists) mediaDir.create();

  const tempFile = new File(Paths.cache, `tmp_${Date.now()}_${filename}`);
  try {
    await File.downloadFileAsync(remoteUrl, tempFile);

    // Validate download
    if (!tempFile.exists) throw new Error('Download produced no file');
    const downloadedSize = tempFile.size ?? 0;
    if (downloadedSize < MIN_VALID_BYTES) {
      tempFile.delete();
      throw new Error(`Download too small: ${downloadedSize} bytes`);
    }

    tempFile.move(localFile);
    return localFile.uri;
  } catch (err) {
    // Clean up temp file on failure
    try { if (tempFile.exists) tempFile.delete(); } catch { /* ignore */ }
    throw err;
  }
}

/**
 * Remove a single cached image (e.g. when the source URL changed).
 */
export function evictCachedImage(remoteUrl: string): void {
  const filename = `${simpleHash(remoteUrl)}${extensionFrom(remoteUrl)}`;
  const localFile = new File(getMediaDir(), filename);
  try { if (localFile.exists) localFile.delete(); } catch { /* ignore */ }
}
