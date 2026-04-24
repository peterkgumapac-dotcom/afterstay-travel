import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { cachedImageUri, evictCachedImage } from '@/lib/cache/mediaCache';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover' }: CachedImageProps) {
  // Show remote URL immediately — swap to local when cache resolves
  const [uri, setUri] = useState(remoteUrl);
  const [failed, setFailed] = useState(false);
  const retryCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    retryCount.current = 0;
    setFailed(false);
    setUri(remoteUrl);

    cachedImageUri(remoteUrl)
      .then((localUri) => { if (!cancelled) setUri(localUri); })
      .catch(() => { /* keep remote URL — Image will load it directly */ });

    return () => { cancelled = true; };
  }, [remoteUrl]);

  if (failed) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f1b17' }]}>
        <ImageOff size={24} color="#544b41" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (retryCount.current === 0) {
          // First retry: evict corrupt cache, fall back to remote URL
          retryCount.current = 1;
          evictCachedImage(remoteUrl);
          setUri(remoteUrl);
        } else if (retryCount.current === 1) {
          // Second retry: append cache-buster to bypass CDN/HTTP cache
          retryCount.current = 2;
          const bustUrl = remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}`;
          setUri(bustUrl);
        } else {
          // Give up — show placeholder
          setFailed(true);
        }
      }}
      fadeDuration={150}
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
