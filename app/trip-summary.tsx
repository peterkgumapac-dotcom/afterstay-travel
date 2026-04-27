import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  ChevronRight,
  FolderOpen,
  Heart,
  ImagePlus,
  MapPin,
  Play,
  Receipt,
  Share2,
  Star,
  Tag,
  Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import StatPill from '@/components/summary/StatPill';
import CategoryBar from '@/components/summary/CategoryBar';
import PlaceRow from '@/components/summary/PlaceRow';
import type { PlaceSource } from '@/components/summary/PlaceRow';
import HeroSection from '@/components/summary/HeroSection';
import SuperlativeCard from '@/components/summary/SuperlativeCard';
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
  resolvePhotoUrl,
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
  const [placesExpanded, setPlacesExpanded] = useState(false);
  const [savedExpanded, setSavedExpanded] = useState(false);

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

    // Only count places from photos and receipts — real visited locations
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
    return Array.from(seen.values());
  }, [moments, expenses]);

  const savedPlaces = useMemo(() => {
    const seen = new Set<string>();
    return places.filter((p) => {
      if (!p.saved) return false;
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [places]);

  const topExpenses = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [expenses],
  );

  const receiptPlaces = useMemo(() => {
    // Filter out OCR noise that isn't a real place name
    const NOISE_WORDS = ['cash voucher', 'receipt', 'invoice', 'total', 'change', 'vat', 'tax', 'subtotal', 'discount'];
    const set = new Set<string>();
    for (const e of expenses) {
      if (!e.placeName) continue;
      const lower = e.placeName.toLowerCase().trim();
      if (lower.length < 3) continue;
      if (NOISE_WORDS.some((w) => lower === w || lower.includes(w))) continue;
      set.add(e.placeName);
    }
    return Array.from(set);
  }, [expenses]);

  const currency = trip?.costCurrency ?? 'PHP';

  // ---------- SUPERLATIVES (derived from existing data) ----------

  const heroPhoto = useMemo(() => {
    // Pick most-favorited moment with a photo, or fall back to first photo
    const withPhotos = moments.filter((m) => resolvePhotoUrl(m.photo));
    const favIds = Object.entries(favorites)
      .filter(([, f]) => f.count > 0)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([id]) => id);
    const topFav = favIds.find((id) => withPhotos.some((m) => m.id === id));
    if (topFav) return resolvePhotoUrl(withPhotos.find((m) => m.id === topFav)?.photo);
    return resolvePhotoUrl(withPhotos[0]?.photo);
  }, [moments, favorites]);

  const topCategory = useMemo(() => {
    const entries = Object.entries(summary.byCategory);
    if (entries.length === 0) return undefined;
    return entries.sort(([, a], [, b]) => b - a)[0][0];
  }, [summary.byCategory]);

  const tripPersonality = useMemo(() => {
    if (!topCategory) return undefined;
    const map: Record<string, string> = {
      Food: 'Foodie Escape',
      Activity: 'Adventure Mode',
      Shopping: 'Retail Therapy',
      Transport: 'Road Trip',
      Accommodation: 'Luxury Stay',
    };
    return map[topCategory] ?? 'The Getaway';
  }, [topCategory]);

  const peakDay = useMemo(() => {
    if (momentsByDay.length === 0) return undefined;
    return momentsByDay.reduce((best, d) => (d.count > best.count ? d : best), momentsByDay[0]);
  }, [momentsByDay]);

  const biggestExpense = useMemo(() => {
    if (expenses.length === 0) return undefined;
    return [...expenses].sort((a, b) => b.amount - a.amount)[0];
  }, [expenses]);

  const topLocation = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const m of moments) {
      const loc = m.location?.trim();
      if (loc) freq[loc] = (freq[loc] ?? 0) + 1;
    }
    const entries = Object.entries(freq);
    if (entries.length === 0) return undefined;
    const [name, count] = entries.sort(([, a], [, b]) => b - a)[0];
    return { name, count };
  }, [moments]);

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ==================== 1. HERO ==================== */}
        <HeroSection
          photoUrl={heroPhoto}
          tripName={trip.name}
          destination={trip.destination ?? ''}
          dateLabel={dateLabel}
          nights={trip.nights}
          members={members}
          personality={tripPersonality}
          colors={colors}
          onBack={() => router.back()}
        />

        {/* ==================== 2. STATS STRIP ==================== */}
        <View style={styles.statsGrid}>
          <StatPill icon={<Camera size={18} color={colors.accent} />} value={totalMoments} label="Moments" colors={colors} />
          <StatPill icon={<MapPin size={18} color={colors.coral} />} value={dedupedPlaces.length} label="Places" colors={colors} />
          <StatPill icon={<Heart size={18} color={colors.danger} />} value={favoriteCount} label="Favorites" colors={colors} />
          <StatPill icon={<Wallet size={18} color={colors.gold} />} value={formatCurrency(summary.total, currency)} label="Spent" colors={colors} />
        </View>

        {/* ==================== 3. ACTION ROW ==================== */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handlePlayReel} activeOpacity={0.7}>
            <Play size={16} color={colors.text} fill={colors.text} />
            <Text style={styles.actionLabel}>Play Reel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleAddMoment} activeOpacity={0.7}>
            <ImagePlus size={16} color={colors.text} />
            <Text style={styles.actionLabel}>Add Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
            <Share2 size={16} color={colors.text} />
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== 4. MOMENTS ==================== */}
        {moments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Moments</Text>
              <TouchableOpacity onPress={handlePlayReel} style={styles.viewAllBtn} activeOpacity={0.7}>
                <Text style={styles.viewAllText}>View All</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {(() => {
              const photosWithUrl = moments.filter((m) => resolvePhotoUrl(m.photo));
              const step = Math.max(1, Math.floor(photosWithUrl.length / 11));
              const gridPhotos: Moment[] = [];
              for (let idx = 0; idx < photosWithUrl.length && gridPhotos.length < 11; idx += step) {
                gridPhotos.push(photosWithUrl[idx]);
              }
              const remaining = Math.max(0, photosWithUrl.length - gridPhotos.length);
              return (
                <View style={styles.photoGrid}>
                  {gridPhotos.map((m) => (
                    <Image key={m.id} source={{ uri: resolvePhotoUrl(m.photo)! }} style={styles.gridThumb} resizeMode="cover" />
                  ))}
                  {remaining > 0 && (
                    <TouchableOpacity style={styles.gridMore} onPress={handlePlayReel} activeOpacity={0.7}>
                      <Text style={styles.gridMoreText}>+{remaining}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            {topTags.length > 0 && (
              <View style={styles.tagsRow}>
                {topTags.map(({ tag, count }) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag} ({count})</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ==================== 5. SUPERLATIVES ==================== */}
        {(peakDay || biggestExpense || topLocation) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your trip in numbers</Text>
            <View style={styles.superlativeGrid}>
              {peakDay && (
                <SuperlativeCard
                  icon={<Camera size={16} color={colors.accent} />}
                  label="Peak Day"
                  value={`${peakDay.count} moments`}
                  subtitle={formatDatePHT(peakDay.date)}
                  colors={colors}
                />
              )}
              {topLocation && (
                <SuperlativeCard
                  icon={<MapPin size={16} color={colors.coral} />}
                  label="Top Spot"
                  value={topLocation.name}
                  subtitle={`${topLocation.count} photo${topLocation.count !== 1 ? 's' : ''}`}
                  colors={colors}
                />
              )}
            </View>
            {biggestExpense && (
              <View style={styles.superlativeGrid}>
                <SuperlativeCard
                  icon={<Wallet size={16} color={colors.gold} />}
                  label="Biggest Splurge"
                  value={formatCurrency(biggestExpense.amount, currency)}
                  subtitle={biggestExpense.placeName ?? biggestExpense.description}
                  colors={colors}
                />
                {topCategory && (
                  <SuperlativeCard
                    icon={<Tag size={16} color={colors.accent} />}
                    label="Top Category"
                    value={topCategory}
                    subtitle={`${Math.round(((summary.byCategory[topCategory] ?? 0) / summary.total) * 100)}% of spending`}
                    colors={colors}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* ==================== 6. SPENDING ==================== */}
        {summary.total > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending</Text>
            <View style={styles.spendCard}>
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
          </View>
        )}

        {/* ==================== 7. PLACES VISITED ==================== */}
        {dedupedPlaces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Places visited · {dedupedPlaces.length}</Text>
              {dedupedPlaces.length > 5 && (
                <TouchableOpacity onPress={() => setPlacesExpanded(!placesExpanded)} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>{placesExpanded ? 'Show less' : 'Show all'}</Text>
                  <ChevronRight size={14} color={colors.accent} style={placesExpanded ? { transform: [{ rotate: '90deg' }] } : undefined} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.placesList}>
              {(placesExpanded ? dedupedPlaces : dedupedPlaces.slice(0, 5)).map((p) => (
                <PlaceRow key={p.name} name={p.name} category={p.category} source={p.source} colors={colors} />
              ))}
            </View>
          </View>
        )}

        {/* ==================== 8. SAVED FOR NEXT TIME ==================== */}
        {savedPlaces.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Saved for next time · {savedPlaces.length}</Text>
              {savedPlaces.length > 5 && (
                <TouchableOpacity onPress={() => setSavedExpanded(!savedExpanded)} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>{savedExpanded ? 'Show less' : 'Show all'}</Text>
                  <ChevronRight size={14} color={colors.accent} style={savedExpanded ? { transform: [{ rotate: '90deg' }] } : undefined} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.placesList}>
              {(savedExpanded ? savedPlaces : savedPlaces.slice(0, 5)).map((p) => (
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

        {/* ==================== 9. GROUP ALBUMS ==================== */}
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

        {/* ==================== 10. RECEIPT INSIGHTS ==================== */}
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

        {/* ==================== 11. SHARE CTA ==================== */}
        <TouchableOpacity style={styles.shareCta} onPress={handleShare} activeOpacity={0.7}>
          <Share2 size={18} color={colors.bg} />
          <Text style={styles.shareCtaText}>Share Your Trip</Text>
        </TouchableOpacity>

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
      paddingTop: 0,
    },

    // Stats grid
    statsGrid: {
      flexDirection: 'row',
      gap: 8,
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
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },

    // Photo grid — 3 columns
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 3,
      marginBottom: 16,
    },
    gridThumb: {
      width: (SCREEN_W - 40 - 6) / 3,
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: colors.card2,
    },
    gridMore: {
      width: (SCREEN_W - 40 - 6) / 3,
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridMoreText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text2,
    },

    // Superlatives
    superlativeGrid: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },

    // Spending
    spendCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
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

    // Share CTA
    shareCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      borderRadius: 16,
      marginBottom: 8,
    },
    shareCtaText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.bg,
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
