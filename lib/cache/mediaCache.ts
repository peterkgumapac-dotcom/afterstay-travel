import { Paths, File, Directory } from 'expo-file-system';

const MEDIA_DIR_NAME = 'media';
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500 MB

function simpleHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function extensionFrom(url: string): string {
  const match = url.match(/\.(jpe?g|png|webp|avif|gif)/i);
  return match ? match[0].toLowerCase() : '.jpg';
}

function getMediaDir(): Directory {
  return new Directory(Paths.cache, MEDIA_DIR_NAME);
}

export async function cachedImageUri(remoteUrl: string): Promise<string> {
  const filename = `${simpleHash(remoteUrl)}${extensionFrom(remoteUrl)}`;
  const mediaDir = getMediaDir();
  const localFile = new File(mediaDir, filename);

  if (localFile.exists) return localFile.uri;

  if (!mediaDir.exists) mediaDir.create();
  const tempFile = new File(Paths.cache, `tmp_${filename}`);
  await File.downloadFileAsync(remoteUrl, tempFile);
  tempFile.move(localFile);
  return localFile.uri;
}

