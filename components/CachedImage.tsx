import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { cachedImageUri } from '@/lib/cache/mediaCache';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover' }: CachedImageProps) {
  const { colors } = useTheme();
  // Start by showing the remote URL immediately — no blank placeholder
  const [uri, setUri] = useState(remoteUrl);

  useEffect(() => {
    let cancelled = false;
    // Check disk cache in background — swap to local URI if available
    cachedImageUri(remoteUrl)
      .then((localUri) => { if (!cancelled) setUri(localUri); })
      .catch(() => { /* keep showing remote URL */ });
    return () => { cancelled = true; };
  }, [remoteUrl]);

  return (
    <Image
      source={{ uri, cache: 'force-cache' }}
      style={style}
      resizeMode={resizeMode}
      fadeDuration={150}
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
