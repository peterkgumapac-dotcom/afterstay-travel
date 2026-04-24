import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { cachedImageUri, evictCachedImage } from '@/lib/cache/mediaCache';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 1500;

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover' }: CachedImageProps) {
  const { colors } = useTheme();
  const [uri, setUri] = useState(remoteUrl);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const retryCount = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Resolve cached URI in background
  useEffect(() => {
    let cancelled = false;
    retryCount.current = 0;
    setFailed(false);
    setLoaded(false);
    setUri(remoteUrl);

    cachedImageUri(remoteUrl)
      .then((localUri) => { if (!cancelled) setUri(localUri); })
      .catch(() => { /* keep showing remote URL */ });

    return () => { cancelled = true; };
  }, [remoteUrl]);

  const handleError = useCallback(() => {
    if (!mounted.current) return;

    if (retryCount.current < MAX_RETRIES) {
      retryCount.current += 1;
      // Evict potentially corrupted cache entry and retry
      evictCachedImage(remoteUrl);
      setTimeout(() => {
        if (!mounted.current) return;
        // Cycle: try remote URL directly on first retry, re-cache on second
        if (retryCount.current === 1) {
          setUri(remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + `_r=${Date.now()}`);
        } else {
          cachedImageUri(remoteUrl)
            .then((localUri) => { if (mounted.current) setUri(localUri); })
            .catch(() => { if (mounted.current) setFailed(true); });
        }
      }, RETRY_DELAY);
    } else {
      setFailed(true);
    }
  }, [remoteUrl]);

  // Failed state — subtle placeholder
  if (failed) {
    return (
      <View style={[style as any, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.failedDot, { backgroundColor: colors.text3 }]} />
      </View>
    );
  }

  return (
    <View style={style as any}>
      {/* Shimmer placeholder behind image */}
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
      )}
      <Animated.View entering={loaded ? undefined : FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri, cache: 'force-cache' }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={handleError}
          fadeDuration={0}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  failedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.4,
  },
});

export const CachedImage = React.memo(CachedImageInner);
