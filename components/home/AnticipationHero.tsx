import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { fetchDestinationPhotos, findPlacePhoto } from '@/lib/google-places';
import { cacheGet, cacheSet } from '@/lib/cache';
import { filterRenderableImageUrls, isRenderableRemoteImageUrl } from '@/lib/imageUrl';
import type { GroupMember } from '@/lib/types';

const HERO_H = 214;
const SLIDE_DURATION = 4500; // 4.5s per slide
const DEST_PHOTO_TIMEOUT_MS = 10000;

const HERO_ACCENT_SETS = [
  ['#0f2f2f', '#d8ab7a', '#f3e6c8'],
  ['#23344d', '#e0b173', '#f5eddc'],
  ['#40251b', '#c9652b', '#efd4a4'],
  ['#172a40', '#8bb7c8', '#efd2a0'],
] as const;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), DEST_PHOTO_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, () => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

interface Props {
  photos: string[];
  hotelName: string;
  destination: string;
  dateRange: string;
  verified?: boolean;
  roomInfo?: string;
  bookingRef?: string;
  members?: GroupMember[];
  resolveDestinationFallback?: boolean;
  paused?: boolean;
  onViewTrip?: () => void;
}

export const AnticipationHero: React.FC<Props> = ({
  photos,
  hotelName,
  destination,
  dateRange,
  verified,
  roomInfo,
  bookingRef,
  members = [],
  resolveDestinationFallback = true,
  paused = false,
  onViewTrip,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const displayTitle = hotelName || destination || 'Your Trip';
  const displaySubtitle = hotelName ? destination : dateRange;
  const accentSet = useMemo(() => {
    const seed = (destination || hotelName || 'afterstay')
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return HERO_ACCENT_SETS[seed % HERO_ACCENT_SETS.length];
  }, [destination, hotelName]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const fadeAnim = useSharedValue(0);

  // Ken Burns scale animation
  const kenBurnsScale = useSharedValue(1);

  useEffect(() => {
    if (paused) {
      cancelAnimation(kenBurnsScale);
      return;
    }
    kenBurnsScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => cancelAnimation(kenBurnsScale);
  }, [kenBurnsScale, paused]);

  const kenBurnsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kenBurnsScale.value }],
  }));

  useEffect(() => {
    setFailedUrls(new Set());
    setCurrentIndex(0);
    setNextIndex(1);
  }, [photos, destination]);

  const visiblePhotos = useMemo(
    () => filterRenderableImageUrls(photos).filter((url) => !failedUrls.has(url)),
    [photos, failedUrls],
  );

  // Fetch destination photos when no hotel photos are available, or when hotel images fail.
  const [destPhotos, setDestPhotos] = useState<string[]>([]);
  const destinationCacheKey = useMemo(
    () => `dest_photos:v5:${destination.trim().toLowerCase()}`,
    [destination],
  );

  useEffect(() => {
    if (!resolveDestinationFallback || visiblePhotos.length > 0 || !destination) return;
    let cancelled = false;
    setDestPhotos([]);
    (async () => {
      const cached = await cacheGet<string[] | string>(destinationCacheKey, 6 * 60 * 60 * 1000);
      const cachedList = filterRenderableImageUrls(Array.isArray(cached) ? cached.filter(Boolean) : cached ? [cached] : []);
      if (cachedList.length > 0) {
        if (!cancelled) setDestPhotos(cachedList);
        return;
      }

      const collected = filterRenderableImageUrls(await withTimeout(fetchDestinationPhotos(destination, 5), []));
      const queries = [
        `${destination} travel destination`,
        `${destination} landmark`,
        `${destination} hotel exterior`,
        `${destination} tourism`,
        destination,
      ];
      for (const query of queries) {
        const url = await withTimeout(findPlacePhoto(query), null);
        if (isRenderableRemoteImageUrl(url) && !collected.includes(url)) collected.push(url);
        if (collected.length >= 5) break;
      }

      if (collected.length > 0 && !cancelled) {
        setDestPhotos(collected);
        await cacheSet(destinationCacheKey, collected);
      }
    })();
    return () => { cancelled = true; };
  }, [destination, destinationCacheKey, resolveDestinationFallback, visiblePhotos.length]);

  const heroPhotos = useMemo(
    () => visiblePhotos.length > 0 ? visiblePhotos : filterRenderableImageUrls(destPhotos).filter((url) => !failedUrls.has(url)),
    [destPhotos, failedUrls, visiblePhotos],
  );

  const handleImageError = useCallback((url?: string | null) => {
    if (!url) return;
    if (__DEV__) console.warn('[AnticipationHero] image failed:', url);
    if (destPhotos.includes(url)) {
      setDestPhotos((prev) => {
        const next = prev.filter((item) => item !== url);
        cacheSet(destinationCacheKey, next).catch(() => {});
        return next;
      });
    }
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, [destPhotos, destinationCacheKey]);

  useEffect(() => {
    if (heroPhotos.length === 0) return;
    setCurrentIndex((i) => Math.min(i, heroPhotos.length - 1));
    setNextIndex((i) => heroPhotos.length > 1 ? i % heroPhotos.length : 0);
  }, [heroPhotos.length]);

  // Photo cross-fade
  useEffect(() => {
    if (paused || heroPhotos.length <= 1) return;
    let timeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      fadeAnim.value = withTiming(1, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      });
      timeout = setTimeout(() => {
        setCurrentIndex((p) => (p + 1) % heroPhotos.length);
        setNextIndex((p) => (p + 2) % heroPhotos.length);
        fadeAnim.value = 0;
      }, 900);
    }, SLIDE_DURATION);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [heroPhotos.length, fadeAnim, paused]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const handleDotPress = useCallback(
    (i: number) => {
      Haptics.selectionAsync();
      setCurrentIndex(i);
      setNextIndex((i + 1) % heroPhotos.length);
    },
    [heroPhotos.length],
  );
  const companionLabel = useMemo(() => {
    if (members.length === 0) return '';
    return members.length === 1
      ? 'Solo traveler'
      : `You + ${members.length - 1} traveler${members.length > 2 ? 's' : ''}`;
  }, [members.length]);

  const metaLabel = useMemo(
    () => [dateRange, companionLabel].filter(Boolean).join(' · '),
    [companionLabel, dateRange],
  );

  const renderActionRow = () => (
    <View style={styles.actionRow}>
      <Pressable style={[styles.actionButton, styles.actionButtonPrimary]} onPress={onViewTrip} hitSlop={6}>
        <Text style={[styles.actionText, styles.actionTextPrimary]}>View Trip</Text>
      </Pressable>
    </View>
  );

  const renderDesignedHero = () => (
    <>
      <LinearGradient
        colors={[colors.card, colors.bg2, colors.bg]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.accentGlow, { backgroundColor: accentSet[1] }]} />
      <View style={[styles.mapLine, styles.mapLineOne, { borderColor: accentSet[2] }]} />
      <View style={[styles.mapLine, styles.mapLineTwo, { borderColor: accentSet[1] }]} />
      <View style={[styles.routeDot, styles.routeDotStart]} />
      <View style={[styles.routeDot, styles.routeDotEnd, { backgroundColor: accentSet[1] }]} />
    </>
  );

  if (heroPhotos.length === 0) {
    return (
      <View style={styles.outerWrap}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {renderDesignedHero()}
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.58)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.bottomInfo}>
            <View style={styles.confirmRow}>
              {verified && (
                <View style={styles.confirmBadge}>
                  <Text style={styles.confirmText}>{'\u2713'} Confirmed</Text>
                </View>
              )}
              {bookingRef && <Text style={styles.refText}>{bookingRef}</Text>}
            </View>
            <Text style={styles.hotelName}>{displayTitle}</Text>
            {displaySubtitle ? <Text style={styles.roomInfo}>{displaySubtitle}</Text> : null}
            {metaLabel ? <Text style={styles.metaText}>{metaLabel}</Text> : null}
            {renderActionRow()}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerWrap}>
      <View style={styles.container}>
        {renderDesignedHero()}

        {/* Current photo with Ken Burns */}
        <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
          <Image
            source={{ uri: heroPhotos[currentIndex] }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={220}
            onError={() => handleImageError(heroPhotos[currentIndex])}
          />
        </Animated.View>

        {/* Next photo fading in */}
        {heroPhotos.length > 1 && (
          <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
            <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
              <Image
                source={{ uri: heroPhotos[nextIndex] }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={220}
                onError={() => handleImageError(heroPhotos[nextIndex])}
              />
            </Animated.View>
          </Animated.View>
        )}

        {/* Dark gradient overlay */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.1)',
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0.75)',
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Pagination dots — top right, bar style */}
        <View style={styles.dots}>
          {heroPhotos.map((_, i) => (
            <Pressable key={i} onPress={() => handleDotPress(i)} hitSlop={8}>
              <View
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>

        {/* Bottom info overlay */}
        <View style={styles.bottomInfo}>
          {/* Confirmed badge + booking ref */}
          <View style={styles.confirmRow}>
            {verified && (
              <View style={styles.confirmBadge}>
                <Text style={styles.confirmText}>
                  {'\u2713'} Confirmed
                </Text>
              </View>
            )}
            {bookingRef && (
              <Text style={styles.refText}>{bookingRef}</Text>
            )}
          </View>

          {/* Hotel name */}
          <Text style={styles.hotelName}>{displayTitle}</Text>

          {/* Room info */}
          {(roomInfo || (!hotelName && dateRange) || displaySubtitle) && (
            <Text style={styles.roomInfo}>{roomInfo || (!hotelName ? dateRange : displaySubtitle)}</Text>
          )}

          {metaLabel ? <Text style={styles.metaText}>{metaLabel}</Text> : null}
          {renderActionRow()}
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    outerWrap: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    container: {
      height: HERO_H,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg2,
    },
    dots: {
      position: 'absolute',
      top: 16,
      right: 16,
      flexDirection: 'row',
      gap: 4,
      zIndex: 3,
    },
    dot: {
      width: 18,
      height: 3,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    dotActive: {
      backgroundColor: '#fff',
    },
    bottomInfo: {
      position: 'absolute',
      bottom: 12,
      left: 16,
      right: 16,
      zIndex: 3,
    },
    confirmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 5,
    },
    confirmBadge: {
      borderWidth: 1,
      borderColor: '#fff',
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 2,
      opacity: 0.92,
      transform: [{ rotate: '-4deg' }],
    },
    confirmText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '600',
    },
    refText: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 11,
    },
    hotelName: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.2,
      lineHeight: 22,
      marginBottom: 2,
    },
    roomInfo: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      lineHeight: 16,
    },
    metaText: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    actionButton: {
      minHeight: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      paddingHorizontal: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    actionButtonPrimary: {
      backgroundColor: 'rgba(216,171,122,0.95)',
      borderColor: 'rgba(216,171,122,0.95)',
    },
    actionText: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 11,
      fontWeight: '700',
    },
    actionTextPrimary: {
      color: '#160d08',
    },
    groupAvatar: {
      width: 26,
      height: 26,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: 'rgba(20,26,34,0.8)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupAvatarText: {
      color: '#0b0f14',
      fontSize: 11,
      fontWeight: '600',
    },
    groupText: {
      color: 'rgba(255,255,255,0.75)',
      fontSize: 11,
      marginLeft: 10,
    },
    accentGlow: {
      position: 'absolute',
      top: -34,
      right: -22,
      width: 150,
      height: 150,
      borderRadius: 75,
      opacity: 0.16,
    },
    mapLine: {
      position: 'absolute',
      borderWidth: 1,
      opacity: 0.16,
      transform: [{ rotate: '-8deg' }],
    },
    mapLineOne: {
      top: 46,
      left: -34,
      width: 280,
      height: 74,
      borderRadius: 140,
    },
    mapLineTwo: {
      top: 98,
      right: -58,
      width: 240,
      height: 70,
      borderRadius: 120,
    },
    horizon: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    hill: {
      position: 'absolute',
      bottom: -74,
      borderTopLeftRadius: 999,
      borderTopRightRadius: 999,
      opacity: 0.94,
    },
    hillBack: {
      left: -80,
      width: 260,
      height: 150,
      opacity: 0.48,
    },
    hillMid: {
      right: -70,
      width: 300,
      height: 166,
      opacity: 0.78,
    },
    hillFront: {
      left: 70,
      right: -30,
      height: 120,
      opacity: 0.82,
    },
    routeLine: {
      position: 'absolute',
      left: 44,
      right: 46,
      bottom: 78,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.32)',
      transform: [{ rotate: '-7deg' }],
    },
    routeDot: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.78)',
      borderWidth: 2,
      borderColor: 'rgba(15,13,11,0.6)',
    },
    routeDotStart: {
      left: 46,
      bottom: 70,
    },
    routeDotEnd: {
      right: 48,
      bottom: 94,
    },
  });
