import React, { useEffect, useRef, useState } from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { RefreshCw } from 'lucide-react-native';
import { cachedImageUri, evictCachedImage } from '@/lib/cache/mediaCache';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

const AUTO_RETRY_MS = 5000;
const MAX_AUTO_RETRIES = 6; // stop after 30s of retrying

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover' }: CachedImageProps) {
  const [uri, setUri] = useState(remoteUrl);
  const [showRetryIcon, setShowRetryIcon] = useState(false);
  const retryCount = useRef(0);
  const autoRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  // Spinning animation for retry icon
  const spin = useSharedValue(0);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${spin.value}deg` }],
  }));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    retryCount.current = 0;
    setShowRetryIcon(false);
    setUri(remoteUrl);

    cachedImageUri(remoteUrl)
      .then((localUri) => { if (!cancelled) setUri(localUri); })
      .catch(() => { /* keep remote URL */ });

    return () => { cancelled = true; };
  }, [remoteUrl]);

  const scheduleAutoRetry = () => {
    if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
    if (retryCount.current >= MAX_AUTO_RETRIES) return;

    autoRetryTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      retryCount.current += 1;
      evictCachedImage(remoteUrl);
      // Spin the icon
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), 2, false);
      setUri(remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + `_r=${Date.now()}`);
    }, AUTO_RETRY_MS);
  };

  return (
    <View style={style as any}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onLoad={() => {
          setShowRetryIcon(false);
          if (autoRetryTimer.current) clearTimeout(autoRetryTimer.current);
        }}
        onError={() => {
          if (retryCount.current === 0) {
            // First: evict cache, try raw remote URL
            retryCount.current = 1;
            evictCachedImage(remoteUrl);
            setUri(remoteUrl);
          } else if (retryCount.current === 1) {
            // Second: cache-bust
            retryCount.current = 2;
            setUri(remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + `_cb=${Date.now()}`);
          } else {
            // Show retry icon + auto-retry every 5s
            setShowRetryIcon(true);
            scheduleAutoRetry();
          }
        }}
        fadeDuration={150}
      />
      {showRetryIcon && (
        <View style={styles.retryOverlay} pointerEvents="none">
          <Animated.View style={spinStyle}>
            <RefreshCw size={18} color="#857d70" strokeWidth={1.8} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  retryOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,27,23,0.85)',
  },
});

export const CachedImage = React.memo(CachedImageInner);
