import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.7;

/**
 * Compress an image by resizing to a max width and saving as JPEG.
 * Falls back to the original URI if manipulation fails.
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
    // Manipulation failed — return original URI as graceful fallback
    return uri;
  }
}
