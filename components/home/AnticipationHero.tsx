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
import type { GroupMember } from '@/lib/types';

const HERO_H = 320;
const SLIDE_DURATION = 4500; // 4.5s per slide
const DEST_PHOTO_TIMEOUT_MS = 10000;

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];
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
    kenBurnsScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    return () => cancelAnimation(kenBurnsScale);
  }, [kenBurnsScale]);

  const kenBurnsStyle = useAnimatedStyle(() => ({
    transform: [{ scale: kenBurnsScale.value }],
  }));

  useEffect(() => {
    setFailedUrls(new Set());
    setCurrentIndex(0);
    setNextIndex(1);
  }, [photos, destination]);

  const visiblePhotos = useMemo(
    () => photos.filter((url) => !failedUrls.has(url)),
    [photos, failedUrls],
  );

  // Fetch destination photos when no hotel photos are available, or when hotel images fail.
  const [destPhotos, setDestPhotos] = useState<string[]>([]);
  const destinationCacheKey = useMemo(
    () => `dest_photos:v4:${destination.trim().toLowerCase()}`,
    [destination],
  );

  useEffect(() => {
    if (!resolveDestinationFallback || visiblePhotos.length > 0 || !destination) return;
    let cancelled = false;
    setDestPhotos([]);
    (async () => {
      const cached = await cacheGet<string[] | string>(destinationCacheKey, 6 * 60 * 60 * 1000);
      const cachedList = Array.isArray(cached) ? cached.filter(Boolean) : cached ? [cached] : [];
      if (cachedList.length > 0) {
        if (!cancelled) setDestPhotos(cachedList);
        return;
      }

      const collected = await withTimeout(fetchDestinationPhotos(destination, 5), []);
      const queries = [
        `${destination} travel destination`,
        `${destination} landmark`,
        `${destination} hotel exterior`,
        `${destination} tourism`,
        destination,
      ];
      for (const query of queries) {
        const url = await withTimeout(findPlacePhoto(query), null);
        if (url && !collected.includes(url)) collected.push(url);
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
    () => visiblePhotos.length > 0 ? visiblePhotos : destPhotos.filter((url) => !failedUrls.has(url)),
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
    if (heroPhotos.length <= 1) return;
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
  }, [heroPhotos.length, fadeAnim]);

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
  const renderDesignedHero = () => (
    <>
      <LinearGradient
        colors={[accentSet[0], colors.bg2, colors.bg]}
        locations={[0, 0.56, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.sun, { backgroundColor: accentSet[1] }]} />
      <View style={[styles.orbit, styles.orbitOne, { borderColor: accentSet[2] }]} />
      <View style={[styles.orbit, styles.orbitTwo, { borderColor: accentSet[1] }]} />
      <View style={styles.horizon}>
        <View style={[styles.hill, styles.hillBack, { backgroundColor: accentSet[0] }]} />
        <View style={[styles.hill, styles.hillMid, { backgroundColor: colors.card }]} />
        <View style={[styles.hill, styles.hillFront, { backgroundColor: colors.bg }]} />
      </View>
      <View style={styles.routeLine} />
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
            {members.length > 0 && (
              <View style={styles.groupRow}>
                {members.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      styles.groupAvatar,
                      {
                        backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length],
                        marginLeft: i === 0 ? 0 : -8,
                        zIndex: members.length - i,
                      },
                    ]}
                  >
                    <Text style={styles.groupAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                ))}
                <Text style={styles.groupText}>
                  {members.length === 1
                    ? 'Solo traveler'
                    : `You + ${members.length - 1} traveler${members.length > 2 ? 's' : ''}`}
                </Text>
              </View>
            )}
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

          {/* Group member avatars */}
          {members.length > 0 && (
            <View style={styles.groupRow}>
              {members.map((m, i) => (
                <View
                  key={m.id}
                  style={[
                    styles.groupAvatar,
                    {
                      backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length],
                      marginLeft: i === 0 ? 0 : -8,
                      zIndex: members.length - i,
                    },
                  ]}
                >
                  <Text style={styles.groupAvatarText}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ))}
              <Text style={styles.groupText}>
                {members.length === 1
                  ? 'Solo traveler'
                  : `You + ${members.length - 1} traveler${members.length > 2 ? 's' : ''}`}
              </Text>
            </View>
          )}
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
      paddingBottom: 14,
    },
    container: {
      height: HERO_H,
      borderRadius: 22,
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
      bottom: 16,
      left: 18,
      right: 18,
      zIndex: 3,
    },
    confirmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
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
      fontSize: 22,
      fontWeight: '500',
      letterSpacing: -0.02 * 22,
      lineHeight: 22 * 1.1,
      marginBottom: 3,
    },
    roomInfo: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
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
    sun: {
      position: 'absolute',
      top: 34,
      right: 34,
      width: 84,
      height: 84,
      borderRadius: 42,
      opacity: 0.9,
    },
    orbit: {
      position: 'absolute',
      borderWidth: 1,
      opacity: 0.22,
      transform: [{ rotate: '-12deg' }],
    },
    orbitOne: {
      top: 64,
      left: -42,
      width: 260,
      height: 100,
      borderRadius: 130,
    },
    orbitTwo: {
      top: 112,
      right: -58,
      width: 240,
      height: 88,
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
      bottom: 96,
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
      bottom: 88,
    },
    routeDotEnd: {
      right: 48,
      bottom: 116,
    },
  });
