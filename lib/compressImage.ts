import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.7;

/**
 * Compress an image by resizing to a max width and saving as JPEG.
 * Always returns a file:// URI — if manipulation fails, copies the
 * original to a temp file so downstream readers never get a content:// URI.
 */
export async function compressImage(
  uri: string,
  maxWidth: number = MAX_WIDTH,
  quality: number = JPEG_QUALITY,
): Promise<string> {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    // Manipulation failed — ensure we return a file:// URI
    if (uri.startsWith('file://') || uri.startsWith('/')) return uri;
    // Android content:// URI — copy to a temp file
    const ext = (uri.split('.').pop() ?? 'jpg').split('?')[0];
    const tempPath = `${FileSystem.cacheDirectory}compress-fallback-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: tempPath });
    return tempPath;
  }
}
