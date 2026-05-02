import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
// interpolate + cancelAnimation used by ProgressBar
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Heart,
  MapPin,
  Share2,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react-native';
import { Share } from 'react-native';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import {
  getTripById,
  getMoments,
  getExpenses,
  getExpenseSummary,
  getSavedPlaces,
  getGroupMembers,
  getMomentFavorites,
  resolvePhotoUrl,
} from '@/lib/supabase';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import type { Expense, GroupMember, Moment, Place, Trip } from '@/lib/types';
import type { MomentFavoriteMap } from '@/lib/supabase';

const { width: SW, height: SH } = Dimensions.get('window');
const SLIDE_DURATION = 5000;
const AVATAR_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];
const CATEGORY_COLORS: Record<string, string> = {
  Food: '#d8ab7a', Transport: '#d17858', Activity: '#d9a441',
  Accommodation: '#b89478', Shopping: '#c49460', Other: '#857d70',
};

// ---------- SLIDE TYPES ----------

type SlideType = 'hero' | 'stats' | 'moments' | 'peak' | 'spending' | 'places' | 'share';

// ---------- ANIMATED PROGRESS BAR ----------

function ProgressBar({
  index,
  currentSlide,
  isPaused,
  duration,
  onComplete,
}: {
  index: number;
  currentSlide: number;
  isPaused: boolean;
  duration: number;
  onComplete: () => void;
}) {
  const progress = useSharedValue(0);
  const wasStarted = useRef(false);

  useEffect(() => {
    if (index < currentSlide) {
      // Already passed — fill instantly
      cancelAnimation(progress);
      progress.value = 1;
      wasStarted.current = false;
    } else if (index > currentSlide) {
      // Not yet — empty
      cancelAnimation(progress);
      progress.value = 0;
      wasStarted.current = false;
    } else {
      // Current slide — animate fill
      progress.value = 0;
      wasStarted.current = true;
      progress.value = withTiming(1, {
        duration,
        easing: Easing.linear,
      }, (finished) => {
        if (finished) runOnJS(onComplete)();
      });
    }
  }, [currentSlide, index]);

  useEffect(() => {
    if (index !== currentSlide) return;
    if (isPaused) {
      // Freeze at current position
      const current = progress.value;
      cancelAnimation(progress);
      progress.value = current;
    } else if (wasStarted.current) {
      // Resume from current position
      const current = progress.value;
      const remaining = (1 - current) * duration;
      if (remaining > 50) {
        progress.value = withTiming(1, {
          duration: remaining,
          easing: Easing.linear,
        }, (finished) => {
          if (finished) runOnJS(onComplete)();
        });
      }
    }
  }, [isPaused]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: '#fff',
  }));

  return (
    <View style={pStyles.track}>
      <Animated.View style={[pStyles.fill, animStyle]} />
    </View>
  );
}

const pStyles = StyleSheet.create({
  track: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
});

// ---------- SCREEN ----------

export default function TripRecapScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ total: number; byCategory: Record<string, number>; count: number }>({ total: 0, byCategory: {}, count: 0 });
  const [places, setPlaces] = useState<Place[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [favorites, setFavorites] = useState<MomentFavoriteMap>({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Dreamy memory transition — zoom + fade like memories coming into focus
  const enterOpacity = useSharedValue(1);
  const enterScale = useSharedValue(1);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      try {
        const [t, moms, exps, expSum, plcs, grp, favs] = await Promise.all([
          getTripById(tripId),
          getMoments(tripId),
          getExpenses(tripId),
          getExpenseSummary(tripId),
          getSavedPlaces(tripId),
          getGroupMembers(tripId),
          getMomentFavorites(tripId),
        ]);
        if (t) setTrip(t);
        setMoments(moms);
        setExpenses(exps);
        setSummary(expSum);
        setPlaces(plcs);
        setMembers(grp);
        setFavorites(favs);
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  // ---------- DERIVED ----------

  const photosWithUrl = useMemo(
    () => moments.filter((m) => m.photo),
    [moments],
  );

  const heroPhoto = useMemo(() => {
    const favIds = Object.entries(favorites)
      .filter(([, f]) => f.count > 0)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([id]) => id);
    const topFav = favIds.find((id) => photosWithUrl.some((m) => m.id === id));
    const topMoment = topFav ? photosWithUrl.find((m) => m.id === topFav) : photosWithUrl[0];
    return resolvePhotoUrl(topMoment?.photo);
  }, [photosWithUrl, favorites]);

  const favoriteCount = useMemo(
    () => Object.values(favorites).filter((f) => f.count > 0).length,
    [favorites],
  );

  const dedupedPlaces = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of moments) {
      const loc = m.location?.trim();
      if (loc && !seen.has(loc.toLowerCase())) { seen.add(loc.toLowerCase()); result.push(loc); }
    }
    for (const e of expenses) {
      const loc = e.placeName?.trim();
      if (loc && !seen.has(loc.toLowerCase())) { seen.add(loc.toLowerCase()); result.push(loc); }
    }
    return result;
  }, [moments, expenses]);

  const momentsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of moments) map[m.date] = (map[m.date] ?? 0) + 1;
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }, [moments]);

  const peakDay = useMemo(() => {
    if (momentsByDay.length === 0) return undefined;
    return momentsByDay.reduce((best, d) => (d.count > best.count ? d : best), momentsByDay[0]);
  }, [momentsByDay]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(summary.byCategory);
    return entries.length > 0 ? entries.sort(([, a], [, b]) => b - a)[0][0] : undefined;
  }, [summary.byCategory]);

  const tripPersonality = useMemo(() => {
    if (!topCategory) return 'The Getaway';
    const map: Record<string, string> = { Food: 'Foodie Escape', Activity: 'Adventure Mode', Shopping: 'Retail Therapy', Transport: 'Road Trip', Accommodation: 'Luxury Stay' };
    return map[topCategory] ?? 'The Getaway';
  }, [topCategory]);

  const biggestExpense = useMemo(
    () => expenses.length > 0 ? [...expenses].sort((a, b) => b.amount - a.amount)[0] : undefined,
    [expenses],
  );

  const currency = trip?.costCurrency ?? 'PHP';
  const dailyAvg = trip && trip.nights > 0 ? summary.total / trip.nights : 0;

  // ---------- BUILD SLIDES ----------

  const slides = useMemo<SlideType[]>(() => {
    const s: SlideType[] = ['hero', 'stats'];
    if (photosWithUrl.length > 0) s.push('moments');
    if (peakDay && peakDay.count > 1) s.push('peak');
    if (summary.total > 0) s.push('spending');
    if (dedupedPlaces.length > 0) s.push('places');
    s.push('share');
    return s;
  }, [photosWithUrl.length, peakDay, summary.total, dedupedPlaces.length]);

  // ---------- MEMORY TRANSITION — dreamy zoom + fade ----------

  useEffect(() => {
    // Each new slide zooms from slightly larger and fades in — like a memory emerging
    enterScale.value = 1.08;
    enterOpacity.value = 0;
    enterScale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    enterOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [currentSlide]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ scale: enterScale.value }],
    opacity: enterOpacity.value,
  }));

  // ---------- NAVIGATION ----------

  const isLastSlide = currentSlide >= slides.length - 1;

  const goNext = useCallback(() => {
    if (currentSlide >= slides.length - 1) return;
    Haptics.selectionAsync();
    setCurrentSlide((prev) => prev + 1);
  }, [currentSlide, slides.length]);

  const goPrev = useCallback(() => {
    if (currentSlide <= 0) return;
    Haptics.selectionAsync();
    setCurrentSlide((prev) => prev - 1);
  }, [currentSlide]);

  const handleProgressComplete = useCallback(() => {
    if (currentSlide >= slides.length - 1) return;
    setCurrentSlide((prev) => prev + 1);
  }, [currentSlide, slides.length]);

  // ---------- GESTURES — tap + swipe like Instagram Stories ----------

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .enabled(!isLastSlide)
    .onEnd((e) => {
      'worklet';
      if (e.velocityX < -400 || e.translationX < -60) {
        runOnJS(goNext)();
      } else if (e.velocityX > 400 || e.translationX > 60) {
        runOnJS(goPrev)();
      }
    });

  const tapGesture = Gesture.Tap()
    .enabled(!isLastSlide)
    .onEnd((e) => {
      'worklet';
      if (e.x < SW * 0.3) {
        runOnJS(goPrev)();
      } else {
        runOnJS(goNext)();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(200)
    .enabled(!isLastSlide)
    .onStart(() => {
      'worklet';
      runOnJS(setIsPaused)(true);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(setIsPaused)(false);
    });

  const composedGesture = Gesture.Race(
    longPressGesture,
    Gesture.Exclusive(swipeGesture, tapGesture),
  );

  const handleShare = useCallback(async () => {
    if (!trip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `${trip.name} — ${moments.length} moments, ${dedupedPlaces.length} places, ${formatCurrency(summary.total, currency)} spent`,
    });
  }, [trip, moments.length, dedupedPlaces.length, summary.total, currency]);

  // ---------- RENDER SLIDE ----------

  const renderSlide = (type: SlideType) => {
    switch (type) {
      case 'hero':
        return (
          <View style={styles.slideInner}>
            {heroPhoto ? (
              <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            ) : (
              <LinearGradient colors={['#1a1510', '#0e0c0a']} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={['rgba(0,0,0,0.15)', 'transparent', 'rgba(0,0,0,0.78)']} locations={[0, 0.25, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroBottom}>
              <View style={styles.heroPillWrap}>
                <Sparkles size={11} color="#1a1410" />
                <Text style={styles.heroPill}>{tripPersonality}</Text>
              </View>
              <Text style={styles.heroTitle}>{trip?.name}</Text>
              <Text style={styles.heroSub}>{trip?.destination}</Text>
              <Text style={styles.heroDate}>
                {trip ? `${formatDatePHT(trip.startDate)} – ${formatDatePHT(trip.endDate)} · ${trip.nights} nights` : ''}
              </Text>
              {members.length > 0 && (
                <View style={styles.heroAvatars}>
                  {members.slice(0, 5).map((m, i) => (
                    <View key={m.id} style={[styles.avatar, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]}>
                      {m.profilePhoto ? (
                        <Image source={{ uri: m.profilePhoto }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInit}>{(m.name ?? '?')[0].toUpperCase()}</Text>
                      )}
                    </View>
                  ))}
                  <Text style={styles.heroMemberText}>{members.length} traveler{members.length !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </View>
        );

      case 'stats':
        return (
          <View style={[styles.slideInner, styles.slideCenter]}>
            <LinearGradient colors={[colors.accent + '15', '#0e0c0a']} style={StyleSheet.absoluteFill} />
            <Text style={styles.eyebrow}>YOUR TRIP</Text>
            <View style={styles.statsRow}>
              <StatBubble icon={<Camera size={22} color={colors.accent} />} value={moments.length} label="Moments" delay={0} />
              <StatBubble icon={<MapPin size={22} color={colors.coral} />} value={dedupedPlaces.length} label="Places" delay={80} />
            </View>
            <View style={styles.statsRow}>
              <StatBubble icon={<Heart size={22} color={colors.danger} />} value={favoriteCount} label="Favorites" delay={160} />
              <StatBubble icon={<Wallet size={22} color={colors.gold} />} value={formatCurrency(summary.total, currency)} label="Spent" delay={240} />
            </View>
          </View>
        );

      case 'moments': {
        const step = Math.max(1, Math.floor(photosWithUrl.length / 9));
        const grid: Moment[] = [];
        for (let idx = 0; idx < photosWithUrl.length && grid.length < 9; idx += step) {
          grid.push(photosWithUrl[idx]);
        }
        const remaining = Math.max(0, photosWithUrl.length - grid.length);
        return (
          <View style={[styles.slideInner, styles.slideCenter]}>
            <LinearGradient colors={['#0e0c0a', '#1a1510']} style={StyleSheet.absoluteFill} />
            <Text style={styles.eyebrow}>MOMENTS</Text>
            <Text style={styles.bigNumber}>{photosWithUrl.length}</Text>
            <Text style={styles.bigLabel}>photos captured</Text>
            <View style={styles.momentsGrid}>
              {grid.map((m, i) => {
                const uri = resolvePhotoUrl(m.photo);
                return uri ? (
                  <Animated.View key={m.id} entering={FadeIn.delay(i * 60).duration(300)}>
                    <Image source={{ uri }} style={styles.momentsThumb} contentFit="cover" transition={200} />
                  </Animated.View>
                ) : (
                  <View key={m.id} style={[styles.momentsThumb, styles.momentsPlaceholder]}>
                    <Camera size={14} color="rgba(241,235,226,0.25)" />
                  </View>
                );
              })}
              {remaining > 0 && (
                <View style={[styles.momentsThumb, styles.momentsMore]}>
                  <Text style={styles.momentsMoreText}>+{remaining}</Text>
                </View>
              )}
            </View>
          </View>
        );
      }

      case 'peak': {
        const peakPhotos = photosWithUrl.filter((m) => m.date === peakDay?.date).slice(0, 3);
        const peakUri = resolvePhotoUrl(peakPhotos[0]?.photo);
        return (
          <View style={styles.slideInner}>
            {peakUri ? (
              <Image source={{ uri: peakUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            ) : (
              <LinearGradient colors={['#1a1510', '#0e0c0a']} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFill} />
            <View style={styles.peakBottom}>
              <Text style={styles.eyebrow}>PEAK DAY</Text>
              <Text style={styles.peakNumber}>{peakDay?.count}</Text>
              <Text style={styles.peakLabel}>moments captured</Text>
              <Text style={styles.peakDate}>{peakDay ? formatDatePHT(peakDay.date) : ''}</Text>
            </View>
          </View>
        );
      }

      case 'spending':
        return (
          <View style={[styles.slideInner, styles.slideCenter]}>
            <LinearGradient colors={[colors.accent + '12', '#0e0c0a']} style={StyleSheet.absoluteFill} />
            <Text style={styles.eyebrow}>SPENDING</Text>
            <Text style={styles.spendTotal}>{formatCurrency(summary.total, currency)}</Text>
            <Text style={styles.spendSub}>{formatCurrency(dailyAvg, currency)} per day</Text>
            <View style={styles.spendBars}>
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([cat, amount], i) => {
                  const pct = Math.round((amount / summary.total) * 100);
                  return (
                    <Animated.View key={cat} entering={FadeIn.delay(i * 80).duration(250)} style={styles.spendBarRow}>
                      <View style={[styles.spendDot, { backgroundColor: CATEGORY_COLORS[cat] ?? colors.text3 }]} />
                      <Text style={styles.spendCat}>{cat}</Text>
                      <View style={styles.spendBarTrack}>
                        <View style={[styles.spendBarFill, { width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] ?? colors.accent }]} />
                      </View>
                      <Text style={styles.spendPct}>{pct}%</Text>
                    </Animated.View>
                  );
                })}
            </View>
            {biggestExpense && (
              <View style={styles.splurgeCard}>
                <Text style={styles.splurgeLabel}>Biggest splurge</Text>
                <Text style={styles.splurgeValue}>{formatCurrency(biggestExpense.amount, currency)}</Text>
                <Text style={styles.splurgeName}>{biggestExpense.placeName ?? biggestExpense.description}</Text>
              </View>
            )}
          </View>
        );

      case 'places':
        return (
          <View style={[styles.slideInner, styles.slideCenter]}>
            <LinearGradient colors={[colors.coral + '12', '#0e0c0a']} style={StyleSheet.absoluteFill} />
            <MapPin size={28} color="#d8ab7a" strokeWidth={1.5} />
            <Text style={styles.eyebrow}>PLACES VISITED</Text>
            <Text style={styles.bigNumber}>{dedupedPlaces.length}</Text>
            <View style={styles.placesRanked}>
              {dedupedPlaces.slice(0, 8).map((name, i) => (
                <Animated.View key={name} entering={FadeIn.delay(i * 60).duration(200)} style={styles.placeRow}>
                  <Text style={styles.placeRank}>{i + 1}</Text>
                  <MapPin size={13} color="#d8ab7a" />
                  <Text style={styles.placeRowText} numberOfLines={1}>{name}</Text>
                </Animated.View>
              ))}
              {dedupedPlaces.length > 8 && (
                <Text style={styles.placesOverflow}>+{dedupedPlaces.length - 8} more places</Text>
              )}
            </View>
          </View>
        );

      case 'share': {
        const resolved = photosWithUrl.filter((m) => resolvePhotoUrl(m.photo));
        const snapStep = Math.max(1, Math.floor(resolved.length / 4));
        const snapPhotos: string[] = [];
        for (let si = 0; si < resolved.length && snapPhotos.length < 4; si += snapStep) {
          const url = resolvePhotoUrl(resolved[si].photo);
          if (url) snapPhotos.push(url);
        }
        return (
          <View style={[styles.slideInner, styles.slideCenter]}>
            <LinearGradient colors={['#0e0c0a', '#1a1510']} style={StyleSheet.absoluteFill} />

            {/* Collage card */}
            <View style={styles.snapCard}>
              {snapPhotos.length > 0 && (
                <View style={styles.snapCollage}>
                  {snapPhotos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.snapPhoto} contentFit="cover" transition={200} />
                  ))}
                </View>
              )}
              <View style={styles.snapInfo}>
                {tripPersonality ? (
                  <View style={styles.snapPillRow}>
                    <Sparkles size={10} color={colors.accent} />
                    <Text style={styles.snapPillText}>{tripPersonality}</Text>
                  </View>
                ) : null}
                <Text style={styles.snapName}>{trip?.name}</Text>
                <Text style={styles.snapDate}>{trip ? `${formatDatePHT(trip.startDate)} – ${formatDatePHT(trip.endDate)}` : ''}</Text>
                <View style={styles.snapStats}>
                  <View style={styles.snapStatItem}>
                    <Text style={styles.snapStatNum}>{moments.length}</Text>
                    <Text style={styles.snapStatLabel}>moments</Text>
                  </View>
                  <View style={styles.snapDivider} />
                  <View style={styles.snapStatItem}>
                    <Text style={styles.snapStatNum}>{dedupedPlaces.length}</Text>
                    <Text style={styles.snapStatLabel}>places</Text>
                  </View>
                  <View style={styles.snapDivider} />
                  <View style={styles.snapStatItem}>
                    <Text style={styles.snapStatNum}>{formatCurrency(summary.total, currency)}</Text>
                    <Text style={styles.snapStatLabel}>spent</Text>
                  </View>
                </View>
                <Text style={styles.snapBrand}>afterstay</Text>
              </View>
            </View>

            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Share2 size={16} color="#1a1410" />
              <Text style={styles.shareBtnText}>Share Your Trip</Text>
            </Pressable>
            <Pressable style={styles.detailBtn} onPress={() => {
              router.push({ pathname: '/trip-summary', params: { tripId: tripId ?? '' } } as never);
            }}>
              <Text style={styles.detailBtnText}>View Full Summary</Text>
            </Pressable>
          </View>
        );
      }

      default:
        return null;
    }
  };

  // ---------- LOADING / EMPTY ----------

  if (loading) {
    return (
      <View style={[styles.container, styles.slideCenter]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.container, styles.slideCenter]}>
        <Text style={{ color: colors.text3, fontSize: 15 }}>Trip not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        {/* Slide content — dreamy zoom + fade on each transition */}
        <Animated.View style={[StyleSheet.absoluteFill, slideStyle]} pointerEvents="box-none">
          {renderSlide(slides[currentSlide])}
        </Animated.View>

        {/* Animated progress bars */}
        <View style={[styles.progressRow, { top: insets.top + 8 }]}>
          {slides.map((_, i) => (
            <ProgressBar
              key={i}
              index={i}
              currentSlide={currentSlide}
              isPaused={isPaused}
              duration={SLIDE_DURATION}
              onComplete={handleProgressComplete}
            />
          ))}
        </View>

        {/* Close */}
        <Pressable style={[styles.closeBtn, { top: insets.top + 26 }]} onPress={() => router.back()} hitSlop={12}>
          <X size={20} color="#fff" />
        </Pressable>

        {/* Pause indicator */}
        {isPaused && (
          <Animated.View entering={FadeIn.duration(150)} style={styles.pauseBadge}>
            <Text style={styles.pauseText}>PAUSED</Text>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

// ---------- STAT BUBBLE (staggered entrance) ----------

function StatBubble({ icon, value, label, delay }: { icon: React.ReactNode; value: string | number; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(300)} style={sbStyles.wrap}>
      {icon}
      <Text style={sbStyles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{value}</Text>
      <Text style={sbStyles.label}>{label}</Text>
    </Animated.View>
  );
}

const sbStyles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, width: (SW - 80) / 2 },
  value: { fontSize: 30, fontWeight: '800', color: '#f1ebe2', letterSpacing: -1, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '500', color: 'rgba(241,235,226,0.5)' },
});

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' as const },
    slideInner: { flex: 1, backgroundColor: '#0e0c0a' },
    slideCenter: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

    // Progress
    progressRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4, zIndex: 20 },
    closeBtn: {
      position: 'absolute', right: 16, width: 34, height: 34, borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 20,
    },
    pauseBadge: {
      position: 'absolute', alignSelf: 'center', top: '50%', marginTop: -14,
      backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 14, zIndex: 20,
    },
    pauseText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 1.5 },

    // Shared
    eyebrow: { fontSize: 11, fontWeight: '700', color: 'rgba(241,235,226,0.45)', letterSpacing: 2, marginBottom: 12 },
    bigNumber: { fontSize: 52, fontWeight: '800', color: '#f1ebe2', letterSpacing: -2 },
    bigLabel: { fontSize: 15, color: 'rgba(241,235,226,0.55)', marginBottom: 20 },

    // Hero
    heroBottom: { position: 'absolute', bottom: 60, left: 24, right: 24 },
    heroPillWrap: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(216,171,122,0.88)', paddingHorizontal: 11, paddingVertical: 5,
      borderRadius: 8, marginBottom: 12, overflow: 'hidden',
    },
    heroPill: { fontSize: 10, fontWeight: '700', color: '#1a1410', textTransform: 'uppercase', letterSpacing: 1.2 },
    heroTitle: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 3 },
    heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500', marginBottom: 3 },
    heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    heroAvatars: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
    avatar: {
      width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImg: { width: 28, height: 28, borderRadius: 14 },
    avatarInit: { fontSize: 11, fontWeight: '700', color: '#fff' },
    heroMemberText: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginLeft: 10, fontWeight: '600' },

    // Stats
    statsRow: { flexDirection: 'row', gap: 32, marginBottom: 28 },

    // Moments grid
    momentsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: SW - 56 },
    momentsThumb: {
      width: (SW - 56 - 8) / 3, aspectRatio: 1, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    },
    momentsPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    momentsMore: { alignItems: 'center', justifyContent: 'center' },
    momentsMoreText: { fontSize: 16, fontWeight: '700', color: 'rgba(241,235,226,0.55)' },

    // Peak
    peakBottom: { position: 'absolute', bottom: 80, left: 28, right: 28, alignItems: 'center' },
    peakNumber: { fontSize: 68, fontWeight: '800', color: '#fff', letterSpacing: -3 },
    peakLabel: { fontSize: 17, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    peakDate: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 },

    // Spending
    spendTotal: { fontSize: 38, fontWeight: '800', color: '#f1ebe2', letterSpacing: -1.5 },
    spendSub: { fontSize: 13, color: 'rgba(241,235,226,0.55)', marginBottom: 24 },
    spendBars: { width: '100%', gap: 11, marginBottom: 22 },
    spendBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    spendDot: { width: 8, height: 8, borderRadius: 4 },
    spendCat: { fontSize: 12, fontWeight: '600', color: 'rgba(241,235,226,0.7)', width: 90 },
    spendBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
    spendBarFill: { height: 6, borderRadius: 3 },
    spendPct: { fontSize: 12, fontWeight: '600', color: 'rgba(241,235,226,0.5)', width: 36, textAlign: 'right' },
    splurgeCard: {
      backgroundColor: 'rgba(216,171,122,0.08)', borderWidth: 1, borderColor: 'rgba(216,171,122,0.18)',
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, width: '100%', alignItems: 'center',
    },
    splurgeLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(241,235,226,0.4)', letterSpacing: 1.5, textTransform: 'uppercase' },
    splurgeValue: { fontSize: 22, fontWeight: '800', color: colors.accent, letterSpacing: -0.5, marginTop: 4 },
    splurgeName: { fontSize: 13, color: 'rgba(241,235,226,0.6)', marginTop: 2 },

    // Places
    placesRanked: { width: '100%', gap: 8, marginTop: 12 },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    placeRank: { fontSize: 14, fontWeight: '700', color: 'rgba(241,235,226,0.3)', width: 20, textAlign: 'right' },
    placeRowText: { fontSize: 14, fontWeight: '500', color: '#f1ebe2', flex: 1 },
    placesOverflow: { fontSize: 12, color: 'rgba(241,235,226,0.4)', textAlign: 'center', marginTop: 8 },

    // Share / collage
    snapCard: {
      width: SW - 56, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.border,
    },
    snapCollage: { flexDirection: 'row', flexWrap: 'wrap', height: (SW - 56) * 0.6 },
    snapPhoto: { width: '50%', height: '50%' },
    snapInfo: { padding: 18, alignItems: 'center' },
    snapPillRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(216,171,122,0.12)',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10,
    },
    snapPillText: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
    snapName: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
    snapDate: { fontSize: 12, color: colors.text3, marginTop: 3 },
    snapStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 16 },
    snapStatItem: { alignItems: 'center' },
    snapStatNum: { fontSize: 16, fontWeight: '700', color: colors.text },
    snapStatLabel: { fontSize: 10, color: colors.text3, marginTop: 2 },
    snapDivider: { width: 1, height: 20, backgroundColor: colors.border },
    snapBrand: { fontSize: 11, fontWeight: '600', color: colors.text3, letterSpacing: 1.5, marginTop: 14, textTransform: 'lowercase' },

    // CTAs
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 13,
      borderRadius: 14, marginTop: 20,
    },
    shareBtnText: { fontSize: 14, fontWeight: '700', color: '#1a1410' },
    detailBtn: {
      paddingHorizontal: 24, paddingVertical: 12, marginTop: 10,
    },
    detailBtnText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  });
