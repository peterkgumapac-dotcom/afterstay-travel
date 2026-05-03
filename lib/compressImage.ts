import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.7;
const PROFILE_COVER_ASPECT = 8 / 5;
const PROFILE_COVER_WIDTH = 1600;
const PROFILE_COVER_HEIGHT = 1000;
const PROFILE_COVER_QUALITY = 0.78;

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

function getCenteredCrop(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) return null;

  const sourceAspect = width / height;
  let cropWidth = width;
  let cropHeight = height;

  if (sourceAspect > PROFILE_COVER_ASPECT) {
    cropWidth = height * PROFILE_COVER_ASPECT;
  } else if (sourceAspect < PROFILE_COVER_ASPECT) {
    cropHeight = width / PROFILE_COVER_ASPECT;
  }

  return {
    originX: Math.max(0, Math.round((width - cropWidth) / 2)),
    originY: Math.max(0, Math.round((height - cropHeight) / 2)),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

export async function optimizeProfileCover(
  uri: string,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<string> {
  try {
    const crop = getCenteredCrop(sourceWidth, sourceHeight);
    const actions = [
      ...(crop ? [{ crop }] : []),
      { resize: { width: PROFILE_COVER_WIDTH, height: PROFILE_COVER_HEIGHT } },
    ];
    const result = await manipulateAsync(uri, actions, {
      compress: PROFILE_COVER_QUALITY,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  } catch {
    return compressImage(uri, PROFILE_COVER_WIDTH, PROFILE_COVER_QUALITY);
  }
}
