import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Heart,
  MapPin,
  Share2,
  Wallet,
  X,
} from 'lucide-react-native';

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
const AVATAR_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#8a5a2b', '#7e9f5b'];

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#d8ab7a',
  Transport: '#d17858',
  Activity: '#d9a441',
  Accommodation: '#b89478',
  Shopping: '#c49460',
  Other: '#857d70',
};

// ---------- SLIDE TYPES ----------

interface SlideData {
  type: 'hero' | 'stats' | 'moments' | 'peak' | 'spending' | 'places' | 'share';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

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
  const autoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // ---------- BUILD SLIDES (adaptive) ----------

  const slides = useMemo<SlideData[]>(() => {
    const s: SlideData[] = [{ type: 'hero' }];
    s.push({ type: 'stats' });
    if (photosWithUrl.length > 0) s.push({ type: 'moments' });
    if (peakDay && peakDay.count > 1) s.push({ type: 'peak' });
    if (summary.total > 0) s.push({ type: 'spending' });
    if (dedupedPlaces.length > 0) s.push({ type: 'places' });
    s.push({ type: 'share' });
    return s;
  }, [photosWithUrl.length, peakDay, summary.total, dedupedPlaces.length]);

  // ---------- NAVIGATION ----------

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev >= slides.length - 1) {
        router.back();
        return prev;
      }
      Haptics.selectionAsync();
      return prev + 1;
    });
  }, [slides.length, router]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => {
      if (prev <= 0) return 0;
      Haptics.selectionAsync();
      return prev - 1;
    });
  }, []);

  const handleTap = useCallback((x: number) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (x < SW * 0.3) goPrev();
    else goNext();
  }, [goPrev, goNext]);

  const handleShare = useCallback(async () => {
    if (!trip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `${trip.name} — ${moments.length} moments, ${dedupedPlaces.length} places, ${formatCurrency(summary.total, currency)} spent`,
    });
  }, [trip, moments.length, dedupedPlaces.length, summary.total, currency]);

  // ---------- RENDER SLIDE ----------

  const renderSlide = (slide: SlideData) => {
    switch (slide.type) {
      case 'hero':
        return (
          <View style={styles.slideInner}>
            {heroPhoto && <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroBottom}>
              <Text style={styles.heroPill}>{tripPersonality}</Text>
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
            <Text style={styles.statsEyebrow}>YOUR TRIP</Text>
            <View style={styles.statsBig}>
              <View style={styles.statItem}>
                <Camera size={24} color={colors.accent} />
                <Text style={styles.statNumber}>{moments.length}</Text>
                <Text style={styles.statLabel}>Moments</Text>
              </View>
              <View style={styles.statItem}>
                <MapPin size={24} color={colors.coral} />
                <Text style={styles.statNumber}>{dedupedPlaces.length}</Text>
                <Text style={styles.statLabel}>Places</Text>
              </View>
            </View>
            <View style={styles.statsBig}>
              <View style={styles.statItem}>
                <Heart size={24} color={colors.danger} />
                <Text style={styles.statNumber}>{favoriteCount}</Text>
                <Text style={styles.statLabel}>Favorites</Text>
              </View>
              <View style={styles.statItem}>
                <Wallet size={24} color={colors.gold} />
                <Text style={styles.statNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(summary.total, currency)}</Text>
                <Text style={styles.statLabel}>Spent</Text>
              </View>
            </View>
          </View>
        );

      case 'moments': {
        // Spread photos evenly across the trip — pick every Nth photo for variety
        const step = Math.max(1, Math.floor(photosWithUrl.length / 11));
        const grid: Moment[] = [];
        for (let idx = 0; idx < photosWithUrl.length && grid.length < 11; idx += step) {
          grid.push(photosWithUrl[idx]);
        }
        const remaining = Math.max(0, photosWithUrl.length - grid.length);
        return (
          <View style={[styles.slideInner, styles.slideCenter]}>
            <LinearGradient colors={['#0e0c0a', '#1a1510']} style={StyleSheet.absoluteFill} />
            <Text style={styles.momentsEyebrow}>MOMENTS</Text>
            <Text style={styles.momentsCount}>{photosWithUrl.length}</Text>
            <Text style={styles.momentsLabel}>photos captured</Text>
            <View style={styles.momentsGrid}>
              {grid.map((m) => {
                const uri = resolvePhotoUrl(m.photo);
                return uri ? (
                  <Image key={m.id} source={{ uri }} style={styles.momentsThumb} />
                ) : (
                  <View key={m.id} style={[styles.momentsThumb, styles.momentsPlaceholder]}>
                    <Camera size={16} color="rgba(241,235,226,0.3)" />
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
        return (
          <View style={styles.slideInner}>
            {peakPhotos[0] && <Image source={{ uri: resolvePhotoUrl(peakPhotos[0].photo)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={styles.peakBottom}>
              <Text style={styles.peakEyebrow}>PEAK DAY</Text>
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
            <Text style={styles.spendEyebrow}>SPENDING</Text>
            <Text style={styles.spendTotal}>{formatCurrency(summary.total, currency)}</Text>
            <Text style={styles.spendSub}>{formatCurrency(dailyAvg, currency)} per day</Text>
            <View style={styles.spendBars}>
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 4)
                .map(([cat, amount]) => {
                  const pct = Math.round((amount / summary.total) * 100);
                  return (
                    <View key={cat} style={styles.spendBarRow}>
                      <View style={[styles.spendDot, { backgroundColor: CATEGORY_COLORS[cat] ?? colors.text3 }]} />
                      <Text style={styles.spendCat}>{cat}</Text>
                      <View style={styles.spendBarTrack}>
                        <View style={[styles.spendBarFill, { width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] ?? colors.accent }]} />
                      </View>
                      <Text style={styles.spendPct}>{pct}%</Text>
                    </View>
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
            <Text style={styles.placesEyebrow}>PLACES VISITED</Text>
            <Text style={styles.placesCount}>{dedupedPlaces.length}</Text>
            <View style={styles.placesRanked}>
              {dedupedPlaces.slice(0, 8).map((name, i) => (
                <View key={name} style={styles.placeRow}>
                  <Text style={styles.placeRank}>{i + 1}</Text>
                  <MapPin size={14} color="#d8ab7a" />
                  <Text style={styles.placeRowText} numberOfLines={1}>{name}</Text>
                </View>
              ))}
              {dedupedPlaces.length > 8 && (
                <Text style={styles.placesOverflow}>+{dedupedPlaces.length - 8} more places</Text>
              )}
            </View>
          </View>
        );

      case 'share': {
        // Spread 4 photos evenly across the trip for variety
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

            {/* Trip snapshot card */}
            <View style={styles.snapCard}>
              {/* Photo collage — 2×2 grid */}
              {snapPhotos.length > 0 && (
                <View style={styles.snapCollage}>
                  {snapPhotos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.snapPhoto} resizeMode="cover" />
                  ))}
                </View>
              )}

              {/* Trip info overlay */}
              <View style={styles.snapInfo}>
                {tripPersonality ? (
                  <View style={styles.snapPill}>
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
              <Share2 size={18} color="#1a1410" />
              <Text style={styles.shareBtnText}>Share Your Trip</Text>
            </Pressable>
            <Pressable style={styles.detailBtn} onPress={() => router.replace({ pathname: '/trip-summary', params: { tripId: tripId ?? '' } } as never)}>
              <Text style={styles.detailBtnText}>View Full Summary</Text>
            </Pressable>
          </View>
        );
      }

      default:
        return null;
    }
  };

  // ---------- LOADING ----------

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

  const slide = slides[currentSlide];

  const isShareSlide = slide.type === 'share';

  return (
    <View style={styles.container}>
      {isShareSlide ? (
        <Animated.View key={currentSlide} entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill}>
          {renderSlide(slide)}
        </Animated.View>
      ) : (
        <Pressable style={StyleSheet.absoluteFill} onPress={(e) => handleTap(e.nativeEvent.locationX)}>
          <Animated.View key={currentSlide} entering={FadeIn.duration(250)} style={StyleSheet.absoluteFill}>
            {renderSlide(slide)}
          </Animated.View>
        </Pressable>
      )}

      {/* Progress bar */}
      <View style={[styles.progressRow, { top: insets.top + 8 }]}>
        {slides.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <View style={[styles.progressFill, i <= currentSlide && styles.progressActive]} />
          </View>
        ))}
      </View>

      {/* Close button */}
      <Pressable style={[styles.closeBtn, { top: insets.top + 28 }]} onPress={() => router.back()} hitSlop={12}>
        <X size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    slideInner: {
      flex: 1,
      backgroundColor: '#0e0c0a',
    },
    slideCenter: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },

    // Progress bar
    progressRow: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      gap: 4,
      zIndex: 20,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: 'transparent',
    },
    progressActive: {
      backgroundColor: '#fff',
    },
    closeBtn: {
      position: 'absolute',
      right: 16,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    },

    // Hero slide
    heroBottom: {
      position: 'absolute',
      bottom: 60,
      left: 24,
      right: 24,
    },
    heroPill: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(216,171,122,0.85)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
      fontSize: 11,
      fontWeight: '700',
      color: '#1a1410',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 12,
      overflow: 'hidden',
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -1,
      marginBottom: 4,
    },
    heroSub: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '500',
      marginBottom: 4,
    },
    heroDate: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.65)',
    },
    heroAvatars: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 30, height: 30, borderRadius: 15 },
    avatarInit: { fontSize: 12, fontWeight: '700', color: '#fff' },
    heroMemberText: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      marginLeft: 10,
      fontWeight: '600',
    },

    // Stats slide
    statsEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(241,235,226,0.5)',
      letterSpacing: 2,
      marginBottom: 32,
    },
    statsBig: {
      flexDirection: 'row',
      gap: 40,
      marginBottom: 28,
    },
    statItem: {
      alignItems: 'center',
      gap: 8,
    },
    statNumber: {
      fontSize: 32,
      fontWeight: '800',
      color: '#f1ebe2',
      letterSpacing: -1,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: 'rgba(241,235,226,0.5)',
    },

    // Moments slide
    momentsEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(241,235,226,0.5)',
      letterSpacing: 2,
      marginBottom: 8,
    },
    momentsCount: {
      fontSize: 56,
      fontWeight: '800',
      color: '#f1ebe2',
      letterSpacing: -2,
    },
    momentsLabel: {
      fontSize: 16,
      color: 'rgba(241,235,226,0.6)',
      marginBottom: 20,
    },
    momentsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      width: SW - 48,
    },
    momentsThumb: {
      width: (SW - 48 - 12) / 4,
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
    },
    momentsPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    momentsMore: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    momentsMoreText: {
      fontSize: 16,
      fontWeight: '700',
      color: 'rgba(241,235,226,0.6)',
    },

    // Peak day slide
    peakBottom: {
      position: 'absolute',
      bottom: 80,
      left: 28,
      right: 28,
      alignItems: 'center',
    },
    peakEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.6)',
      letterSpacing: 2,
      marginBottom: 8,
    },
    peakNumber: {
      fontSize: 72,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -3,
    },
    peakLabel: {
      fontSize: 18,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '500',
    },
    peakDate: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.55)',
      marginTop: 6,
    },

    // Spending slide
    spendEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(241,235,226,0.5)',
      letterSpacing: 2,
      marginBottom: 12,
    },
    spendTotal: {
      fontSize: 40,
      fontWeight: '800',
      color: '#f1ebe2',
      letterSpacing: -1.5,
    },
    spendSub: {
      fontSize: 14,
      color: 'rgba(241,235,226,0.6)',
      marginBottom: 28,
    },
    spendBars: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    spendBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    spendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    spendCat: {
      fontSize: 13,
      fontWeight: '600',
      color: '#f1ebe2',
      width: 90,
    },
    spendBarTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden',
    },
    spendBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    spendPct: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(241,235,226,0.6)',
      width: 32,
      textAlign: 'right',
    },
    splurgeCard: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      padding: 16,
      width: '100%',
      alignItems: 'center',
    },
    splurgeLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: 'rgba(241,235,226,0.45)',
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      marginBottom: 4,
    },
    splurgeValue: {
      fontSize: 22,
      fontWeight: '800',
      color: '#d8ab7a',
      letterSpacing: -0.5,
    },
    splurgeName: {
      fontSize: 13,
      color: 'rgba(241,235,226,0.6)',
      marginTop: 2,
    },

    // Places slide
    placesEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(241,235,226,0.5)',
      letterSpacing: 2,
      marginBottom: 8,
    },
    placesCount: {
      fontSize: 56,
      fontWeight: '800',
      color: '#f1ebe2',
      letterSpacing: -2,
      marginBottom: 24,
    },
    placesRanked: {
      width: '100%',
      gap: 6,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    placeRank: {
      fontSize: 13,
      fontWeight: '700',
      color: 'rgba(241,235,226,0.3)',
      width: 18,
      textAlign: 'center',
    },
    placeRowText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: '#f1ebe2',
    },
    placesOverflow: {
      fontSize: 13,
      color: 'rgba(241,235,226,0.4)',
      textAlign: 'center',
      marginTop: 8,
    },

    // Snapshot card
    snapCard: {
      width: SW * 0.82,
      backgroundColor: '#1a1714',
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 24,
      borderWidth: 1,
      borderColor: 'rgba(216,171,122,0.2)',
    },
    snapCollage: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      height: SW * 0.42,
    },
    snapPhoto: {
      width: '50%',
      height: '50%',
    },
    snapInfo: {
      padding: 18,
      alignItems: 'center',
    },
    snapPill: {
      backgroundColor: 'rgba(216,171,122,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: 8,
    },
    snapPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#d8ab7a',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    snapName: {
      fontSize: 20,
      fontWeight: '800',
      color: '#f1ebe2',
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 4,
    },
    snapDate: {
      fontSize: 12,
      color: 'rgba(241,235,226,0.5)',
      marginBottom: 16,
    },
    snapStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 14,
    },
    snapStatItem: {
      alignItems: 'center',
    },
    snapStatNum: {
      fontSize: 18,
      fontWeight: '800',
      color: '#f1ebe2',
      letterSpacing: -0.3,
    },
    snapStatLabel: {
      fontSize: 10,
      color: 'rgba(241,235,226,0.45)',
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    snapDivider: {
      width: 1,
      height: 24,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    snapBrand: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(216,171,122,0.5)',
      letterSpacing: 1,
    },

    // Share actions
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(216,171,122,0.95)',
      paddingHorizontal: 28,
      paddingVertical: 16,
      borderRadius: 16,
      marginBottom: 14,
    },
    shareBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#1a1410',
    },
    detailBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    detailBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
    },
  });
