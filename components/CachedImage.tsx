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
  const [localUri, setLocalUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cachedImageUri(remoteUrl)
      .then((uri) => { if (!cancelled) setLocalUri(uri); })
      .catch(() => { if (!cancelled) setLocalUri(remoteUrl); });
    return () => { cancelled = true; };
  }, [remoteUrl]);

  if (!localUri) {
    return <View style={[styles.placeholder, { backgroundColor: colors.bg3 }, style]} />;
  }

  return <Image source={{ uri: localUri }} style={style} resizeMode={resizeMode} />;
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    height: '100%',
  },
});

export const CachedImage = React.memo(CachedImageInner);
