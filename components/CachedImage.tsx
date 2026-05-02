import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { cachedImageUri } from '@/lib/cache/mediaCache';

// Warm neutral placeholder — shows a soft dark amber instead of black while loading
const FALLBACK_BLURHASH = 'L15OE2-;00xu~q%M4nof00D%00Rj';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  blurhash?: string;
}

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover', blurhash }: CachedImageProps) {
  const [uri, setUri] = useState<string | null>(null);
  const retried = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    retried.current = false;
    setUri(null);

    // Try disk cache first, fall back to remote URL
    cachedImageUri(remoteUrl)
      .then((localUri) => {
        if (mounted.current) setUri(localUri);
      })
      .catch(() => {
        // Cache miss or download failed — use remote URL directly
        if (mounted.current) setUri(remoteUrl);
      });

    return () => { mounted.current = false; };
  }, [remoteUrl]);

  const handleError = useCallback(() => {
    if (!retried.current) {
      retried.current = true;
      // Bypass cache on retry — append cache-bust param
      setUri(remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + `_r=${Date.now()}`);
    }
  }, [remoteUrl]);

  const resolvedBlurhash = blurhash || FALLBACK_BLURHASH;

  // Show blurhash placeholder immediately while cache resolves
  if (!uri) {
    return (
      <Image
        style={style as any}
        placeholder={{ blurhash: resolvedBlurhash }}
        contentFit={resizeMode === 'cover' ? 'cover' : resizeMode === 'contain' ? 'contain' : 'cover'}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style as any}
      contentFit={resizeMode === 'cover' ? 'cover' : resizeMode === 'contain' ? 'contain' : 'cover'}
      placeholder={{ blurhash: resolvedBlurhash }}
      onError={handleError}
      transition={200}
      cachePolicy="memory-disk"
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
