import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, BookOpen, Calendar, Lock, MapPin, Plane,
  Sparkles, Star, TrendingUp, Users, Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { formatDatePHT } from '@/lib/utils';
import {
  finalizeTripMemory,
  getProfile,
  getTripMemory,
  getMoments,
  saveTripMemoryDraft,
} from '@/lib/supabase';
import { generateTripMemory } from '@/lib/anthropic';
import { buildTripMemoryData } from '@/lib/tripMemoryBuilder';
import type { Moment, TripMemory, UserTier } from '@/lib/types';

type Phase = 'loading' | 'generating' | 'ready' | 'error';

export default function TripMemoryScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [memory, setMemory] = useState<TripMemory | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [tier, setTier] = useState<UserTier>('free');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const heroPhoto = useMemo(() => {
    if (!memory?.heroMomentId) return null;
    return moments.find((m) => m.id === memory.heroMomentId)?.photo ?? null;
  }, [memory, moments]);

  const featuredPhotos = useMemo(() => {
    if (!memory?.featuredMomentIds.length) return [];
    return memory.featuredMomentIds
      .map((id) => moments.find((m) => m.id === id)?.photo)
      .filter((p): p is string => !!p)
      .slice(0, 10);
  }, [memory, moments]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Get user tier
      const profile = await getProfile(user.id);
      setTier(profile?.tier ?? 'free');

      // Check for existing memory
      const tid = tripId ?? '';
      if (tid) {
        const existing = await getTripMemory(tid);
        if (existing) {
          setMemory(existing);
          const m = await getMoments(tid).catch(() => []);
          setMoments(m);
          setPhase('ready');
          return;
        }
      }

      // Build data + generate
      setPhase('generating');
      const data = await buildTripMemoryData(tid);
      const m = await getMoments(tid).catch(() => []);
      setMoments(m);

      const ai = await generateTripMemory({
        destination: data.snapshot.destination,
        startDate: data.snapshot.startDate,
        endDate: data.snapshot.endDate,
        nights: data.snapshot.nights,
        accommodation: data.snapshot.accommodation,
        memberNames: data.snapshot.memberNames,
        moments: data.momentsForAI,
        places: data.placesForAI,
        expenses: data.expensesForAI,
        flights: data.flightsForAI,
      });

      // Save as draft
      const memoryId = await saveTripMemoryDraft({
        tripId: data.tripId,
        userId: user.id,
        narrative: ai.narrative,
        dayHighlights: ai.dayHighlights,
        statsCard: ai.statsCard,
        vibeAnalysis: ai.vibeAnalysis,
        tripSnapshot: data.snapshot,
        expenseSummary: data.expenseSummary,
        placesSummary: data.placesSummary,
        flightSummary: data.flightSummary,
        heroMomentId: data.heroMomentId,
        featuredMomentIds: data.featuredMomentIds,
        status: 'draft',
      });

      const saved = await getTripMemory(data.tripId);
      setMemory(saved);
      setPhase('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate trip memory');
      setPhase('error');
    }
  }, [user?.id, tripId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!memory || tier !== 'premium') {
      Alert.alert('Premium Feature', 'Upgrade to Premium to save your Trip Memory forever.');
      return;
    }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await finalizeTripMemory(memory.id);
      setMemory({ ...memory, status: 'saved', savedAt: new Date().toISOString() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save memory');
    } finally {
      setSaving(false);
    }
  };

  // --- Loading / Generating states ---
  if (phase === 'loading' || phase === 'generating') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>
            {phase === 'generating' ? 'Creating your trip memory...' : 'Loading...'}
          </Text>
          {phase === 'generating' && (
            <Text style={s.loadingSub}>This may take a moment</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error' || !memory) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Trip Memory</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.centerWrap}>
          <Text style={s.errorText}>{error ?? 'Something went wrong'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const snap = memory.tripSnapshot;
  const stats = memory.statsCard;
  const vibe = memory.vibeAnalysis;
  const expenses = memory.expenseSummary;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Trip Memory</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.heroWrap}>
          {heroPhoto ? (
            <Image source={{ uri: heroPhoto }} style={s.heroImage} />
          ) : (
            <View style={[s.heroImage, { backgroundColor: colors.card2 }]} />
          )}
          <View style={s.heroOverlay}>
            <Text style={s.heroDestination}>{snap.destination}</Text>
            <Text style={s.heroDates}>
              {formatDatePHT(snap.startDate)} – {formatDatePHT(snap.endDate)} · {snap.nights} nights
            </Text>
          </View>
        </View>

        {/* Vibe pill */}
        {vibe.dominantMood ? (
          <View style={s.vibeRow}>
            <View style={s.vibePill}>
              <Sparkles size={12} color={colors.accent} />
              <Text style={s.vibeText}>{vibe.dominantMood}</Text>
            </View>
            {vibe.topTags.map((tag) => (
              <View key={tag} style={s.tagPill}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Narrative */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <BookOpen size={14} color={colors.accent} />
            <Text style={s.cardHeaderText}>Your Story</Text>
          </View>
          <Text style={s.narrative}>{memory.narrative}</Text>
        </View>

        {/* Vibe description */}
        {vibe.vibeDescription ? (
          <Text style={s.vibeDesc}>"{vibe.vibeDescription}"</Text>
        ) : null}

        {/* Stats card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <TrendingUp size={14} color={colors.accent} />
            <Text style={s.cardHeaderText}>Trip Stats</Text>
          </View>
          <View style={s.statsGrid}>
            {stats.mostPhotographedSpot ? (
              <StatItem label="Most Photographed" value={stats.mostPhotographedSpot} colors={colors} />
            ) : null}
            {stats.favoriteFood ? (
              <StatItem label="Favorite Food" value={stats.favoriteFood} colors={colors} />
            ) : null}
            {stats.busiestDay ? (
              <StatItem label="Busiest Day" value={stats.busiestDay} colors={colors} />
            ) : null}
            {stats.topTag ? (
              <StatItem label="Top Vibe" value={stats.topTag} colors={colors} />
            ) : null}
            <StatItem label="Photos" value={String(stats.totalPhotos)} colors={colors} />
            <StatItem label="Places" value={String(stats.totalPlacesVisited)} colors={colors} />
          </View>
        </View>

        {/* Day-by-day highlights */}
        {memory.dayHighlights.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Calendar size={14} color={colors.accent} />
              <Text style={s.cardHeaderText}>Day by Day</Text>
            </View>
            {memory.dayHighlights.map((dh, i) => (
              <View key={dh.day} style={[s.dayRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={s.dayLabel}>{formatDatePHT(dh.day)}</Text>
                <Text style={s.daySummary}>{dh.summary}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Featured photos */}
        {featuredPhotos.length > 0 && (
          <View>
            <Text style={s.sectionLabel}>HIGHLIGHTS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
              {featuredPhotos.map((url, i) => (
                <Image key={`${url}-${i}`} source={{ uri: url }} style={s.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Places visited */}
        {memory.placesSummary.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <MapPin size={14} color={colors.accent} />
              <Text style={s.cardHeaderText}>Places Visited</Text>
            </View>
            {memory.placesSummary.slice(0, 8).map((p, i) => (
              <View key={`${p.name}-${i}`} style={[s.placeRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={s.placeName}>{p.name}</Text>
                <Text style={s.placeCategory}>{p.category}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Expense summary */}
        {expenses.total > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Wallet size={14} color={colors.accent} />
              <Text style={s.cardHeaderText}>Budget Summary</Text>
            </View>
            <Text style={s.expenseTotal}>
              {expenses.currency} {expenses.total.toLocaleString()}
            </Text>
            <Text style={s.expenseSub}>
              {expenses.currency} {expenses.dailyAverage.toLocaleString()}/day avg
            </Text>
            {expenses.biggestSplurge && (
              <Text style={s.expenseSub}>
                Biggest: {expenses.biggestSplurge.description} ({expenses.currency} {expenses.biggestSplurge.amount.toLocaleString()})
              </Text>
            )}
          </View>
        )}

        {/* Travelers */}
        {snap.memberNames.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Users size={14} color={colors.accent} />
              <Text style={s.cardHeaderText}>Travelers</Text>
            </View>
            <Text style={s.travelersText}>{snap.memberNames.join(' · ')}</Text>
          </View>
        )}

        {/* Flights */}
        {memory.flightSummary.length > 0 && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Plane size={14} color={colors.accent} />
              <Text style={s.cardHeaderText}>Flights</Text>
            </View>
            {memory.flightSummary.map((f, i) => (
              <View key={`${f.flightNumber}-${i}`} style={[s.flightRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={s.flightLabel}>{f.direction}</Text>
                <Text style={s.flightDetail}>{f.airline} {f.flightNumber} · {f.from} → {f.to}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <View style={s.bottomBar}>
        {memory.status === 'saved' ? (
          <View style={s.savedBadge}>
            <Star size={16} color={colors.accent} fill={colors.accent} />
            <Text style={s.savedText}>Saved · {memory.savedAt ? formatDatePHT(memory.savedAt) : ''}</Text>
          </View>
        ) : tier === 'premium' ? (
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.7} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <>
                <Star size={16} color={colors.bg} />
                <Text style={s.saveBtnText}>Save Memory</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.upgradeBtn} onPress={() => Alert.alert('Premium', 'Upgrade to save Trip Memories. Coming soon!')} activeOpacity={0.7}>
            <Lock size={16} color={colors.text2} />
            <Text style={s.upgradeBtnText}>Upgrade to Save</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function StatItem({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  return (
    <View style={{ width: '48%', marginBottom: 12 }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.text3, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  // Loading
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingText: { fontSize: 15, fontWeight: '600', color: c.text, marginTop: 16 },
  loadingSub: { fontSize: 12, color: c.text3, marginTop: 4 },
  errorText: { fontSize: 14, color: c.danger, textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: c.text },

  // Hero
  heroWrap: { borderRadius: 22, overflow: 'hidden', marginBottom: 16, height: 220 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroDestination: { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  heroDates: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Vibe
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  vibePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder,
  },
  vibeText: { fontSize: 12, fontWeight: '600', color: c.accent },
  tagPill: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
  },
  tagText: { fontSize: 11, fontWeight: '500', color: c.text2 },

  // Card
  card: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: c.border, marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardHeaderText: { fontSize: 10, fontWeight: '600', color: c.text3, letterSpacing: 1.6, textTransform: 'uppercase' },

  // Narrative
  narrative: { fontSize: 14, fontWeight: '400', color: c.text, lineHeight: 22, letterSpacing: -0.1 },
  vibeDesc: { fontSize: 13, fontStyle: 'italic', color: c.text2, textAlign: 'center', marginBottom: 16, paddingHorizontal: 8 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },

  // Section label
  sectionLabel: { fontSize: 10, fontWeight: '600', color: c.text3, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 },

  // Day highlights
  dayRow: { paddingVertical: 10 },
  dayLabel: { fontSize: 11, fontWeight: '700', color: c.accent, marginBottom: 3 },
  daySummary: { fontSize: 13, color: c.text, lineHeight: 19 },

  // Photos
  photoStrip: { gap: 8, paddingBottom: 14 },
  photoThumb: { width: 100, height: 100, borderRadius: 12, backgroundColor: c.card2 },

  // Places
  placeRow: { paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeName: { fontSize: 14, fontWeight: '500', color: c.text },
  placeCategory: { fontSize: 11, fontWeight: '500', color: c.text3 },

  // Expenses
  expenseTotal: { fontSize: 28, fontWeight: '500', color: c.text, letterSpacing: -0.3, marginBottom: 2 },
  expenseSub: { fontSize: 12, color: c.text3, marginTop: 2 },

  // Travelers
  travelersText: { fontSize: 14, color: c.text, lineHeight: 20 },

  // Flights
  flightRow: { paddingVertical: 8 },
  flightLabel: { fontSize: 10, fontWeight: '600', color: c.accent, letterSpacing: 1.2, textTransform: 'uppercase' },
  flightDetail: { fontSize: 13, color: c.text, marginTop: 2 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: c.border,
    backgroundColor: c.bg,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.accent, borderRadius: 16, paddingVertical: 14,
    ...Platform.select({
      ios: { shadowColor: c.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: c.bg },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: c.card, borderRadius: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: c.border,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '600', color: c.text2 },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  savedText: { fontSize: 14, fontWeight: '600', color: c.accent },
});
