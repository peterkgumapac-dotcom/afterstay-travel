import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { findPlacePhoto } from '@/lib/google-places';
import { cacheGet, cacheSet } from '@/lib/cache';
import type { GroupMember } from '@/lib/types';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = 320;
const SLIDE_DURATION = 4500; // 4.5s per slide
const DEST_PHOTO_TIMEOUT_MS = 10000;

const MEMBER_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), DEST_PHOTO_TIMEOUT_MS);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => clearTimeout(timer));
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
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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

  // Fetch destination photo when no hotel photos are available, or when hotel images fail.
  const [destPhoto, setDestPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (visiblePhotos.length > 0 || !destination) return;
    let cancelled = false;
    const cacheKey = `dest_photo:${destination.trim().toLowerCase()}`;
    setDestPhoto(null);
    (async () => {
      const cached = await cacheGet<string>(cacheKey, 24 * 60 * 60 * 1000);
      if (cached) { if (!cancelled) setDestPhoto(cached); return; }
      const queries = [
        `${destination} travel destination`,
        `${destination} landmark`,
        `${destination} hotel exterior`,
        `${destination} tourism`,
        destination,
      ];
      for (const query of queries) {
        const url = await withTimeout(findPlacePhoto(query), null);
        if (url && !cancelled) {
          setDestPhoto(url);
          await cacheSet(cacheKey, url);
          return;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [destination, visiblePhotos.length]);

  const heroPhotos = useMemo(
    () => visiblePhotos.length > 0 ? visiblePhotos : destPhoto && !failedUrls.has(destPhoto) ? [destPhoto] : [],
    [destPhoto, failedUrls, visiblePhotos],
  );

  const handleImageError = useCallback((url?: string | null) => {
    if (!url) return;
    if (__DEV__) console.warn('[AnticipationHero] image failed:', url);
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

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
  const canUseDestPhoto = !!destPhoto && !failedUrls.has(destPhoto);

  if (heroPhotos.length === 0) {
    // No hotel photos — show destination photo or gradient fallback
    return (
      <View style={styles.outerWrap}>
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          {canUseDestPhoto ? (
            <>
              <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
                <Image
                  source={{ uri: destPhoto }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  onError={() => handleImageError(destPhoto)}
                />
              </Animated.View>
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <LinearGradient
              colors={[colors.accentDim, colors.bg]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.emptyHero}>
            <Text style={[styles.emptyDestination, canUseDestPhoto && { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }]}>
              {destination || 'Your Trip'}
            </Text>
            <Text style={[styles.emptyDateRange, canUseDestPhoto && { color: 'rgba(255,255,255,0.85)' }]}>{dateRange}</Text>
            {hotelName ? (
              <Text style={[styles.emptyHotel, canUseDestPhoto && { color: 'rgba(255,255,255,0.7)' }]}>{hotelName}</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerWrap}>
      <View style={styles.container}>
        {/* Current photo with Ken Burns */}
        <Animated.View style={[StyleSheet.absoluteFill, kenBurnsStyle]}>
          <Image
            source={{ uri: heroPhotos[currentIndex] }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
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
                resizeMode="cover"
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
          <Text style={styles.hotelName}>{hotelName || destination || 'Your Trip'}</Text>

          {/* Room info */}
          {(roomInfo || (!hotelName && dateRange)) && (
            <Text style={styles.roomInfo}>{roomInfo || dateRange}</Text>
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
    emptyHero: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyDestination: {
      fontSize: 28,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    emptyDateRange: {
      fontSize: 13,
      color: colors.text2,
      marginTop: 6,
      textAlign: 'center',
    },
    emptyHotel: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 4,
      textAlign: 'center',
    },
  });
