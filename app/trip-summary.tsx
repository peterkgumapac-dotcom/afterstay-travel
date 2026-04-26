import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  Camera,
  FolderOpen,
  Heart,
  ImagePlus,
  MapPin,
  Play,
  Receipt,
  Share2,
  Star,
  Tag,
  Upload,
  Users,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import StatPill from '@/components/summary/StatPill';
import CategoryBar from '@/components/summary/CategoryBar';
import PlaceRow from '@/components/summary/PlaceRow';
import type { PlaceSource } from '@/components/summary/PlaceRow';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import {
  getTripById,
  getMoments,
  getExpenses,
  getExpenseSummary,
  getSavedPlaces,
  getGroupMembers,
  getMomentFavorites,
  getAlbums,
} from '@/lib/supabase';
import type { MomentFavoriteMap } from '@/lib/supabase';
import { formatCurrency, formatDatePHT } from '@/lib/utils';
import type { Album, Expense, GroupMember, Moment, Place, Trip } from '@/lib/types';

// ---------- CONSTANTS ----------

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#d8ab7a',
  Transport: '#d17858',
  Activity: '#d9a441',
  Accommodation: '#b89478',
  Shopping: '#c49460',
  Other: '#857d70',
};

interface DerivedPlace {
  name: string;
  category?: string;
  source: PlaceSource;
}

// ---------- SCREEN ----------

export default function TripSummaryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ total: number; byCategory: Record<string, number>; count: number }>({
    total: 0,
    byCategory: {},
    count: 0,
  });
  const [places, setPlaces] = useState<Place[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [favorites, setFavorites] = useState<MomentFavoriteMap>({});
  const [albums, setAlbums] = useState<Album[]>([]);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const [t, moms, exps, expSum, plcs, grp, favs, albs] = await Promise.all([
        getTripById(tripId),
        getMoments(tripId),
        getExpenses(tripId),
        getExpenseSummary(tripId),
        getSavedPlaces(tripId),
        getGroupMembers(tripId),
        getMomentFavorites(tripId),
        getAlbums(tripId).catch(() => [] as Album[]),
      ]);
      if (t) setTrip(t);
      setMoments(moms);
      setExpenses(exps);
      setSummary(expSum);
      setPlaces(plcs);
      setMembers(grp);
      setFavorites(favs);
      setAlbums(albs);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  // ---------- DERIVED ----------

  const totalMoments = moments.length;
  const favoriteCount = useMemo(
    () => Object.values(favorites).filter((f) => f.count > 0).length,
    [favorites],
  );

  const momentsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of moments) {
      const day = m.date ?? 'Unknown';
      map[day] = (map[day] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [moments]);

  const topTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const m of moments) {
      for (const tag of m.tags ?? []) {
        freq[tag] = (freq[tag] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));
  }, [moments]);

  const maxDayCount = useMemo(
    () => Math.max(1, ...momentsByDay.map((d) => d.count)),
    [momentsByDay],
  );

  const dailyAvg = trip && trip.nights > 0 ? summary.total / trip.nights : 0;
  const receiptCount = expenses.filter((e) => e.photo).length;

  const dedupedPlaces = useMemo(() => {
    const seen = new Map<string, DerivedPlace>();

    for (const m of moments) {
      const loc = m.location?.trim();
      if (loc) {
        const key = loc.toLowerCase();
        if (!seen.has(key)) seen.set(key, { name: loc, source: 'moment' });
      }
    }
    for (const e of expenses) {
      const loc = e.placeName?.trim();
      if (loc) {
        const key = loc.toLowerCase();
        if (!seen.has(key)) seen.set(key, { name: loc, source: 'expense' });
      }
    }
    for (const p of places) {
      const key = p.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, { name: p.name, category: p.category, source: 'discover' });
    }
    return Array.from(seen.values());
  }, [moments, expenses, places]);

  const savedPlaces = useMemo(() => places.filter((p) => p.saved), [places]);

  const topExpenses = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [expenses],
  );

  const receiptPlaces = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) {
      if (e.placeName) set.add(e.placeName);
    }
    return Array.from(set);
  }, [expenses]);

  const currency = trip?.costCurrency ?? 'PHP';

  // ---------- ACTIONS ----------

  const handlePlayReel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/moments-slideshow', params: { tripId } } as never);
  };

  const handleShare = async () => {
    if (!trip) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `${trip.name} — ${totalMoments} moments, ${dedupedPlaces.length} places, ${formatCurrency(summary.total, currency)} spent`,
    });
  };

  const handleAddMoment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/add-moment', params: { tripId } } as never);
  };

  const handleOpenAlbum = (albumId: string, name: string, momentCount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/album-detail',
      params: { albumId, name, momentCount: String(momentCount) },
    } as never);
  };

  // ---------- RENDER ----------

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Trip not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const dateLabel = `${formatDatePHT(trip.startDate)} – ${formatDatePHT(trip.endDate)}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow} activeOpacity={0.7}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        {/* ==================== HERO ==================== */}
        <View style={styles.heroSection}>
          <Text style={styles.heroName}>{trip.name}</Text>
          <View style={styles.heroDateRow}>
            <Calendar size={13} color={colors.text3} />
            <Text style={styles.heroDate}>{dateLabel} · {trip.nights} nights</Text>
          </View>
          {members.length > 0 && (
            <View style={styles.heroDateRow}>
              <Users size={13} color={colors.text3} />
              <Text style={styles.heroDate}>{members.length} travelers</Text>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatPill
            icon={<Camera size={18} color={colors.accent} />}
            value={totalMoments}
            label="Moments"
            colors={colors}
          />
          <StatPill
            icon={<MapPin size={18} color={colors.coral} />}
            value={dedupedPlaces.length}
            label="Places"
            colors={colors}
          />
          <StatPill
            icon={<Heart size={18} color={colors.danger} />}
            value={favoriteCount}
            label="Favorites"
            colors={colors}
          />
          <StatPill
            icon={<Wallet size={18} color={colors.gold} />}
            value={formatCurrency(summary.total, currency)}
            label="Spent"
            colors={colors}
          />
        </View>

        {/* ==================== ACTION ROW ==================== */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handlePlayReel} activeOpacity={0.7}>
            <Play size={16} color={colors.text} fill={colors.text} />
            <Text style={styles.actionLabel}>Play Reel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAddMoment} activeOpacity={0.7}>
            <ImagePlus size={16} color={colors.text} />
            <Text style={styles.actionLabel}>Share Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Share2 size={16} color={colors.text} />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== GROUP ALBUMS ==================== */}
        {albums.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Albums</Text>
            <View style={styles.albumList}>
              {albums.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={styles.albumRow}
                  activeOpacity={0.7}
                  onPress={() => handleOpenAlbum(a.id, a.name, a.momentCount)}
                >
                  <View style={styles.albumIconWrap}>
                    <FolderOpen size={18} color={colors.accent} />
                  </View>
                  <View style={styles.albumInfo}>
                    <Text style={styles.albumName} numberOfLines={1}>{a.name}</Text>
                    <Text style={styles.albumMeta}>
                      {a.momentCount} photo{a.momentCount !== 1 ? 's' : ''}
                      {a.memberCount > 0 ? ` · ${a.memberCount} member${a.memberCount !== 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <Camera size={14} color={colors.text3} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ==================== SPENDING ==================== */}
        {summary.total > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending</Text>
            <View style={styles.spendingHeader}>
              <View>
                <Text style={styles.spendTotal}>{formatCurrency(summary.total, currency)}</Text>
                <Text style={styles.spendSub}>total spent</Text>
              </View>
              <View style={styles.spendAvgWrap}>
                <Text style={styles.spendAvg}>{formatCurrency(dailyAvg, currency)}</Text>
                <Text style={styles.spendSub}>per day</Text>
              </View>
            </View>

            <View style={styles.categoryBars}>
              {Object.entries(summary.byCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amount]) => (
                  <CategoryBar
                    key={cat}
                    label={cat}
                    amount={amount}
                    total={summary.total}
                    color={CATEGORY_COLORS[cat] ?? colors.text3}
                    currency={currency}
                    colors={colors}
                  />
                ))}
            </View>

            {receiptCount > 0 && (
              <View style={styles.receiptPill}>
                <Receipt size={13} color={colors.accent} />
                <Text style={styles.receiptText}>
                  {receiptCount} receipt{receiptCount !== 1 ? 's' : ''} scanned
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ==================== MOMENTS ==================== */}
        {moments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moments</Text>

            {/* By-day bar chart */}
            <View style={styles.dayChart}>
              {momentsByDay.map(({ date, count }) => (
                <View key={date} style={styles.dayCol}>
                  <View style={styles.dayBarTrack}>
                    <View
                      style={[
                        styles.dayBarFill,
                        { height: `${(count / maxDayCount) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayLabel}>{formatDatePHT(date)}</Text>
                  <Text style={styles.dayCount}>{count}</Text>
                </View>
              ))}
            </View>

            {/* Top tags */}
            {topTags.length > 0 && (
              <View style={styles.tagsRow}>
                <Tag size={13} color={colors.text3} />
                {topTags.map(({ tag, count }) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag} ({count})</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ==================== PLACES ==================== */}
        {dedupedPlaces.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Places visited</Text>
            <View style={styles.placesList}>
              {dedupedPlaces.slice(0, 15).map((p) => (
                <PlaceRow
                  key={p.name}
                  name={p.name}
                  category={p.category}
                  source={p.source}
                  colors={colors}
                />
              ))}
              {dedupedPlaces.length > 15 && (
                <Text style={styles.moreText}>
                  +{dedupedPlaces.length - 15} more places
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ==================== DISCOVER SAVED ==================== */}
        {savedPlaces.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Saved for next time</Text>
            <View style={styles.placesList}>
              {savedPlaces.slice(0, 10).map((p) => (
                <View key={p.id} style={styles.savedRow}>
                  <Star size={14} color={colors.accent} fill={colors.accent} />
                  <Text style={styles.savedName} numberOfLines={1}>{p.name}</Text>
                  <View style={styles.savedCatPill}>
                    <Text style={styles.savedCatText}>{p.category}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ==================== OCR INSIGHTS ==================== */}
        {(receiptCount > 0 || receiptPlaces.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt insights</Text>

            {receiptPlaces.length > 0 && (
              <View style={styles.ocrBlock}>
                <Text style={styles.ocrLabel}>Places from receipts</Text>
                <View style={styles.ocrChips}>
                  {receiptPlaces.map((name) => (
                    <View key={name} style={styles.ocrChip}>
                      <Text style={styles.ocrChipText}>{name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {topExpenses.length > 0 && (
              <View style={styles.ocrBlock}>
                <Text style={styles.ocrLabel}>Top expenses</Text>
                {topExpenses.map((e) => (
                  <View key={e.id} style={styles.ocrRow}>
                    <Text style={styles.ocrDesc} numberOfLines={1}>{e.description}</Text>
                    <Text style={styles.ocrAmt}>{formatCurrency(e.amount, currency)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    emptyText: {
      fontSize: 15,
      color: colors.text3,
    },
    backBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.card,
    },
    backBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    backRow: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },

    // Hero
    heroSection: {
      marginBottom: 20,
    },
    heroName: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.8,
      marginBottom: 8,
    },
    heroDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    heroDate: {
      fontSize: 13,
      color: colors.text3,
    },

    // Stats grid
    statsGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },

    // Action row
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 28,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionBtnDisabled: {
      opacity: 0.5,
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },

    // Sections
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text3,
      textTransform: 'uppercase',
      letterSpacing: 1.6,
      marginBottom: 14,
    },

    // Spending
    spendingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 18,
      paddingHorizontal: 4,
    },
    spendTotal: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    spendAvgWrap: {
      alignItems: 'flex-end',
    },
    spendAvg: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.accent,
    },
    spendSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    categoryBars: {
      gap: 2,
      marginBottom: 14,
    },
    receiptPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
    },
    receiptText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.accent,
    },

    // Moments by-day chart
    dayChart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 120,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    dayCol: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    dayBarTrack: {
      flex: 1,
      width: '100%',
      borderRadius: 6,
      backgroundColor: colors.card2,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    dayBarFill: {
      width: '100%',
      borderRadius: 6,
      backgroundColor: colors.accent,
      minHeight: 4,
    },
    dayLabel: {
      fontSize: 9,
      color: colors.text3,
      fontWeight: '500',
    },
    dayCount: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },

    // Tags
    tagsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    tagPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tagText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text2,
    },

    // Places
    placesList: {
      gap: 8,
    },
    moreText: {
      fontSize: 12,
      color: colors.text3,
      textAlign: 'center',
      marginTop: 8,
    },

    // Saved places
    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    savedName: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    savedCatPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.card2,
    },
    savedCatText: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.text3,
    },

    // OCR insights
    ocrBlock: {
      marginBottom: 16,
    },
    ocrLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text2,
      marginBottom: 8,
    },
    ocrChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    ocrChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ocrChipText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text,
    },
    ocrRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
    },
    ocrDesc: {
      flex: 1,
      fontSize: 12,
      color: colors.text2,
      marginRight: 12,
    },
    ocrAmt: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },

    // Albums
    albumList: {
      gap: 8,
    },
    albumRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    albumIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    albumInfo: {
      flex: 1,
      minWidth: 0,
    },
    albumName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    albumMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
  });
