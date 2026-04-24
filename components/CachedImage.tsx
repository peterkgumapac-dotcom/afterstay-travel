import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { cachedImageUri } from '@/lib/cache/mediaCache';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover' }: CachedImageProps) {
  // Show remote URL immediately — swap to local when cache resolves
  const [uri, setUri] = useState(remoteUrl);
  const retried = useRef(false);

  useEffect(() => {
    let cancelled = false;
    retried.current = false;
    setUri(remoteUrl);

    cachedImageUri(remoteUrl)
      .then((localUri) => { if (!cancelled) setUri(localUri); })
      .catch(() => { /* keep remote URL — Image will load it directly */ });

    return () => { cancelled = true; };
  }, [remoteUrl]);

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        // One retry: fall back to raw remote URL if cached URI failed
        if (!retried.current) {
          retried.current = true;
          setUri(remoteUrl);
        }
      }}
      fadeDuration={150}
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
