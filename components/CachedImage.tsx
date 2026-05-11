import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { cachedImageUri } from '@/lib/cache/mediaCache';
import { resolveRenderableStorageUrl } from '@/lib/storageMedia';

// Warm neutral placeholder — shows a soft dark amber instead of black while loading
const FALLBACK_BLURHASH = 'L15OE2-;00xu~q%M4nof00D%00Rj';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  blurhash?: string;
  resolveDiskCache?: boolean;
  transition?: number;
  storageBucket?: string;
}

function CachedImageInner({
  remoteUrl,
  style,
  resizeMode = 'cover',
  blurhash,
  resolveDiskCache = true,
  transition = 200,
  storageBucket = 'moments',
}: CachedImageProps) {
  const [uri, setUri] = useState<string | null>(resolveDiskCache ? null : remoteUrl);
  const [renderableUrl, setRenderableUrl] = useState(remoteUrl);
  const retried = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    retried.current = false;

    const resolveUrl = async () => {
      const resolved = await resolveRenderableStorageUrl(remoteUrl, storageBucket).catch(() => remoteUrl);
      return resolved ?? remoteUrl;
    };

    if (!resolveDiskCache) {
      resolveUrl().then((resolved) => {
        if (!mounted.current) return;
        setRenderableUrl(resolved);
        setUri(resolved);
      });
      return () => { mounted.current = false; };
    }

    setUri(null);

    // Resolve Supabase storage refs first, then try disk cache and fall back to
    // the renderable remote URL. This keeps albums/collages working when rows
    // store a storage path instead of a directly renderable URL.
    resolveUrl()
      .then(async (resolved) => {
        if (!mounted.current) return;
        setRenderableUrl(resolved);
        return cachedImageUri(resolved)
          .then((localUri) => localUri)
          .catch(() => resolved);
      })
      .then((resolvedOrLocal) => {
        if (!resolvedOrLocal) return;
        if (mounted.current) setUri(resolvedOrLocal);
      })
      .catch(() => {
        setRenderableUrl(remoteUrl);
        if (mounted.current) setUri(remoteUrl);
      });

    return () => { mounted.current = false; };
  }, [remoteUrl, resolveDiskCache, storageBucket]);

  const handleError = useCallback(() => {
    if (!retried.current) {
      retried.current = true;
      // Bypass cache on retry — append cache-bust param
      setUri(renderableUrl + (renderableUrl.includes('?') ? '&' : '?') + `_r=${Date.now()}`);
    }
  }, [renderableUrl]);

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
      transition={transition}
      cachePolicy="memory-disk"
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
