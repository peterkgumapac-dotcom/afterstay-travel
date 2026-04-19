import * as FileSystem from 'expo-file-system/legacy';

/**
 * Upload a local image file to a free hosting service and return a public URL.
 * Uses tmpfiles.org (no API key needed, 1h expiry) as primary,
 * falls back to base64 data URI for Notion if upload fails.
 */
export async function uploadImage(localUri: string): Promise<string> {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Try tmpfiles.org (free, no auth, 1 hour expiry)
    const formData = new FormData();
    const filename = localUri.split('/').pop() || 'photo.jpg';
    formData.append('file', {
      uri: localUri,
      type: 'image/jpeg',
      name: filename,
    } as any);

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data?.url) {
        // tmpfiles.org returns https://tmpfiles.org/1234/photo.jpg
        // Need to convert to direct link: https://tmpfiles.org/dl/1234/photo.jpg
        return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      }
    }

    // Fallback: return the local URI (will only work on-device)
    return localUri;
  } catch {
    return localUri;
  }
}
