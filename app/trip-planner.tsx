import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Calendar, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AfterStayLoader from '@/components/AfterStayLoader';
import AIRecommendationCard from '@/components/AIRecommendationCard';
import Select from '@/components/Select';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { generateItinerary, generateRecommendations } from '@/lib/anthropic';
import { enrichRecommendations } from '@/lib/google-places';
import type { ItineraryDay, ItineraryActivity, PlannerPace } from '@/lib/anthropic';
import { addPlace } from '@/lib/supabase';
import type { AIRecommendation, PlaceCategory } from '@/lib/types';

const FIRST_TIME = ['First visit', 'Been before', 'Local-ish'] as const;
type FirstTime = (typeof FIRST_TIME)[number];

const INTERESTS: { key: string; label: string; emoji: string }[] = [
  { key: 'Food & Drink', label: 'Food & Drink', emoji: '\uD83C\uDF7D' },
  { key: 'Coffee', label: 'Coffee', emoji: '\u2615' },
  { key: 'Beach & Water', label: 'Beach & Water', emoji: '\uD83C\uDFD6' },
  { key: 'Nightlife', label: 'Nightlife', emoji: '\uD83C\uDF89' },
  { key: 'Family-friendly', label: 'Family-friendly', emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67' },
  { key: 'Nature & Outdoors', label: 'Nature & Outdoors', emoji: '\uD83C\uDF3F' },
  { key: 'Culture & History', label: 'Culture & History', emoji: '\uD83C\uDFDB' },
  { key: 'Shopping', label: 'Shopping', emoji: '\uD83D\uDECD' },
  { key: 'Wellness', label: 'Wellness', emoji: '\uD83D\uDC86' },
];

const ITINERARY_PACES: { key: PlannerPace; label: string; desc: string; emoji: string }[] = [
  { key: 'packed', label: 'Packed', desc: 'Morning to night, every day', emoji: '\uD83D\uDD25' },
  { key: 'relaxed', label: 'Relaxed', desc: '2-3 activities/day', emoji: '\uD83C\uDF3A' },
  { key: 'moderate', label: 'Moderate', desc: '3-4 activities/day', emoji: '\uD83C\uDFB2' },
];

const CATEGORY_MAP: Record<string, PlaceCategory> = {
  'Eat': 'Eat',
  'Coffee': 'Coffee',
  'Do': 'Do',
  'Nature': 'Nature',
  'Essentials': 'Essentials',
  'Nightlife': 'Nightlife',
  'Wellness': 'Wellness',
  'Culture': 'Culture',
  'Transport': 'Transport',
};

type PlannerTab = 'recommendations' | 'itinerary';
type Step = 'questions' | 'loading' | 'results';

export default function TripPlannerModal() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const [tab, setTab] = useState<PlannerTab>('recommendations');
  const [step, setStep] = useState<Step>('questions');
  const [firstTime, setFirstTime] = useState<FirstTime>('First visit');
  const [interests, setInterests] = useState<string[]>([]);
  const [recs, setRecs] = useState<(AIRecommendation & { photoUri?: string | null; googleMapsUri?: string | null; googlePlaceId?: string | null; totalRatings?: number; lat?: number; lng?: number })[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [itineraryPace, setItineraryPace] = useState<PlannerPace>('relaxed');
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);
  const [error, setError] = useState<string>();

  const toggleInterest = (key: string) => {
    setInterests(list =>
      list.includes(key) ? list.filter(i => i !== key) : [...list, key]
    );
  };

  const generate = async () => {
    if (interests.length === 0) {
      Alert.alert('Pick at least one interest');
      return;
    }
    setStep('loading');
    setError(undefined);
    try {
      if (tab === 'recommendations') {
        const results = await generateRecommendations({ firstTime, interests });
        const enriched = await enrichRecommendations(results);
        setRecs(enriched);
      } else {
        const days = await generateItinerary({ scope: 'whole', pace: itineraryPace, interests });
        setItinerary(days);
      }
      setStep('results');
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
      setStep('questions');
    }
  };

  const save = async (rec: AIRecommendation & { photoUri?: string | null; googleMapsUri?: string | null; googlePlaceId?: string | null; totalRatings?: number; lat?: number; lng?: number }) => {
    const id = `${rec.name}::${rec.category}`;
    if (savedIds.has(id)) return;
    const cat = CATEGORY_MAP[rec.category] ?? 'Do';
    try {
      await addPlace({
        name: rec.name,
        category: cat,
        distance: rec.distance,
        notes: rec.reason,
        priceEstimate: rec.price_estimate,
        rating: rec.rating,
        source: 'Suggested',
        vote: 'Pending',
        photoUrl: rec.photoUri ?? undefined,
        googlePlaceId: rec.googlePlaceId ?? undefined,
        googleMapsUri: rec.googleMapsUri ?? undefined,
        totalRatings: rec.totalRatings ?? undefined,
        latitude: rec.lat ?? undefined,
        longitude: rec.lng ?? undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedIds(s => new Set(s).add(id));
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    }
  };

  // ── Loading ────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <AfterStayLoader />
    );
  }

  // ── Results: Recommendations ───────────────────────────
  if (step === 'results' && tab === 'recommendations') {
    const grouped: Record<string, typeof recs> = {};
    for (const r of recs) {
      grouped[r.category] = grouped[r.category] ?? [];
      grouped[r.category].push(r);
    }
    return (
      <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your picks</Text>
        <Text style={styles.sub}>Tap save to add to your trip board.</Text>

        {Object.entries(grouped).map(([cat, items]) => (
          <View key={cat} style={{ gap: spacing.sm }}>
            <Text style={styles.groupTitle}>{cat}</Text>
            {items.map((r, i) => (
              <AIRecommendationCard
                key={`${cat}-${i}`}
                rec={r}
                saved={savedIds.has(`${r.name}::${r.category}`)}
                onSave={() => save(r)}
                photoUri={r.photoUri}
                googleMapsUri={r.googleMapsUri}
              />
            ))}
          </View>
        ))}

        <Pressable onPress={() => setStep('questions')} style={styles.againBtn}>
          <Text style={styles.againText}>Start over</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.doneBtn}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Results: Itinerary ─────────────────────────────────
  if (step === 'results' && tab === 'itinerary') {
    return (
      <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Itinerary</Text>
        <Text style={styles.sub}>{itineraryPace} pace — {itinerary.length} days</Text>

        {itinerary.map((day) => (
          <View key={day.day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Calendar size={14} color={colors.green2} />
              <Text style={styles.dayTitle}>Day {day.day}</Text>
              <Text style={styles.dayDate}>{day.date}</Text>
            </View>
            <Text style={styles.dayTheme}>{day.theme}</Text>

            {/* Structured activity cards */}
            {(day.activities ?? []).map((act: ItineraryActivity, i: number) => (
              <View key={`${day.day}-${i}`} style={styles.daySection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.daySectionLabel}>{act.timeSlot}</Text>
                  <Text style={{ fontSize: 10, color: colors.text3 }}>{act.duration} · {act.cost}</Text>
                </View>
                <Text style={styles.daySectionText}>{act.name}</Text>
                <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>{act.description}</Text>
                {act.tip ? (
                  <View style={styles.tipRow}>
                    <Text style={styles.tipText}>{act.tip}</Text>
                  </View>
                ) : null}
              </View>
            ))}

            {/* Legacy fallback */}
            {!(day.activities?.length) && (day as any).morning && (
              <>
                <View style={styles.daySection}>
                  <Text style={styles.daySectionLabel}>Morning</Text>
                  <Text style={styles.daySectionText}>{(day as any).morning}</Text>
                </View>
                <View style={styles.daySection}>
                  <Text style={styles.daySectionLabel}>Afternoon</Text>
                  <Text style={styles.daySectionText}>{(day as any).afternoon}</Text>
                </View>
                <View style={styles.daySection}>
                  <Text style={styles.daySectionLabel}>Evening</Text>
                  <Text style={styles.daySectionText}>{(day as any).evening}</Text>
                </View>
              </>
            )}
          </View>
        ))}

        <Pressable onPress={() => setStep('questions')} style={styles.againBtn}>
          <Text style={styles.againText}>Start over</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.doneBtn}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Questions ──────────────────────────────────────────
  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Build your picks</Text>
      <Text style={styles.sub}>Tell us a bit about your trip.</Text>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab('recommendations')}
          style={[styles.tabBtn, tab === 'recommendations' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === 'recommendations' && styles.tabTextActive]}>
            Recommendations
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('itinerary')}
          style={[styles.tabBtn, tab === 'itinerary' && styles.tabBtnActive]}
        >
          <Text style={[styles.tabText, tab === 'itinerary' && styles.tabTextActive]}>
            Itinerary
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: spacing.md }}>
        <Select<FirstTime>
          label="First time in Boracay?"
          options={FIRST_TIME}
          value={firstTime}
          onChange={setFirstTime}
        />

        <View>
          <Text style={styles.label}>What are you into?</Text>
          <View style={styles.interestGrid}>
            {INTERESTS.map(i => {
              const active = interests.includes(i.key);
              return (
                <Pressable
                  key={i.key}
                  onPress={() => toggleInterest(i.key)}
                  style={({ pressed }) => [
                    styles.interestTile,
                    active ? styles.interestTileActive : null,
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                >
                  <Text style={styles.emoji}>{i.emoji}</Text>
                  <Text style={[styles.interestText, active ? { color: colors.green2 } : null]}>
                    {i.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Pace selector */}
        {tab === 'itinerary' && (
          <View>
            <Text style={styles.label}>Pace</Text>
            <View style={{ gap: spacing.sm }}>
              {ITINERARY_PACES.map((m) => {
                const active = itineraryPace === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => setItineraryPace(m.key)}
                    style={[styles.modeCard, active && styles.modeCardActive]}
                  >
                    <Text style={styles.modeEmoji}>{m.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modeLabel, active && { color: colors.green2 }]}>
                        {m.label}
                      </Text>
                      <Text style={styles.modeDesc}>{m.desc}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable
        onPress={generate}
        style={({ pressed }) => [styles.generateBtn, pressed ? { opacity: 0.8 } : null]}
      >
        <Sparkles size={16} color={colors.white} />
        <Text style={styles.generateText}>
          {tab === 'itinerary' ? 'Generate Itinerary' : 'Generate Recommendations'}
        </Text>
      </Pressable>

      <Text style={styles.note}>
Powered by AfterStay — your personal travel companion.
      </Text>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: colors.text2, fontSize: 13, marginTop: -spacing.sm },
  label: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },

  // Tab toggle
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },

  // Interests
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  interestTile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  interestTileActive: {
    backgroundColor: colors.green + '22',
    borderColor: colors.green,
  },
  emoji: { fontSize: 22 },
  interestText: { color: colors.text, fontSize: 12, fontWeight: '600' },

  // Itinerary mode cards
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  modeCardActive: {
    backgroundColor: colors.green + '18',
    borderColor: colors.green,
  },
  modeEmoji: { fontSize: 24 },
  modeLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  modeDesc: { color: colors.text2, fontSize: 12, marginTop: 2 },

  // Generate
  generateBtn: {
    backgroundColor: colors.purple,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  generateText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  loadingTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.md },
  loadingSub: { color: colors.text2, fontSize: 13 },

  // Results
  groupTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  err: { color: colors.red, fontSize: 13 },
  note: { color: colors.text3, fontSize: 11, textAlign: 'center' },
  againBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  againText: { color: colors.text2, fontSize: 14 },
  doneBtn: { backgroundColor: colors.card, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  doneText: { color: colors.text, fontWeight: '700', fontSize: 14 },

  // Itinerary day cards
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayTitle: {
    color: colors.green2,
    fontSize: 14,
    fontWeight: '800',
  },
  dayDate: {
    color: colors.text2,
    fontSize: 12,
  },
  dayTheme: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  daySection: {
    gap: 2,
  },
  daySectionLabel: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daySectionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  tipRow: {
    marginTop: spacing.xs,
    backgroundColor: colors.green + '14',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  tipText: {
    color: colors.green2,
    fontSize: 12,
    lineHeight: 16,
  },
});
