import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MapPin, RefreshCw, Search, Sparkles, X } from 'lucide-react-native';

import { useTheme, type ThemeColors } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { distanceFromHotel, distanceFromPoint } from '@/lib/distance';
import { placeAutocomplete, getPlaceLocation } from '@/lib/google-places';
import { runConciergeSearch, getSmartDefaults } from '@/lib/concierge';
import { addPlace } from '@/lib/supabase';
import { resolveCategory } from '@/components/discover/shared';
import MiniLoader from '@/components/loader/MiniLoader';
import ConciergeResultCard from './ConciergeResultCard';
import type { GroupMember, PlaceVote, ConciergeWhat, ConciergeWhen, ConciergeResultPlace } from '@/lib/types';

// ── Constants ───────────────────────────────────────────────────────

type Step = 'what' | 'when' | 'who' | 'loading' | 'results';

const WHAT_OPTIONS: { id: ConciergeWhat; label: string; emoji: string }[] = [
  { id: 'food', label: 'Food', emoji: '\uD83C\uDF5C' },
  { id: 'coffee', label: 'Coffee', emoji: '\u2615' },
  { id: 'activity', label: 'Activity', emoji: '\uD83C\uDF0A' },
  { id: 'nightlife', label: 'Nightlife', emoji: '\uD83C\uDF79' },
  { id: 'wellness', label: 'Wellness', emoji: '\uD83E\uDDD8' },
  { id: 'explore', label: 'Explore', emoji: '\uD83D\uDDFA\uFE0F' },
];

const WHEN_OPTIONS: { id: ConciergeWhen; label: string }[] = [
  { id: 'now', label: 'Right now' },
  { id: 'later_today', label: 'Later today' },
  { id: 'tomorrow', label: 'Tomorrow' },
];

// ── Props ───────────────────────────────────────────────────────────

interface AIConciergeProps {
  tripId: string | null;
  tripDest: string;
  tripCoords: { lat: number; lng: number } | null;
  originCoords?: { lat: number; lng: number } | null;
  originLabel?: string;
  tripHotel: string;
  tripGroupSize: number;
  tripMembers: GroupMember[];
  tripBudget: number;
  tripBudgetCurrency: string;
  savedNames: Set<string>;
  travelMode: 'walk' | 'car';
  onSavePlace: (name: string) => void;
  onOpenDetail: (placeId: string | undefined, name: string) => void;
}

// ── Component ───────────────────────────────────────────────────────

export default function AIConcierge({
  tripId,
  tripDest,
  tripCoords,
  originCoords,
  originLabel,
  tripHotel,
  tripGroupSize,
  tripMembers,
  tripBudget,
  tripBudgetCurrency,
  savedNames,
  travelMode,
  onSavePlace,
  onOpenDetail,
}: AIConciergeProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const defaults = useMemo(() => getSmartDefaults(), []);

  // Flow state
  const [step, setStep] = useState<Step>('what');
  const [what, setWhat] = useState<ConciergeWhat | string>(defaults.suggestedWhat);
  const [freeform, setFreeform] = useState('');
  const [when, setWhen] = useState<ConciergeWhen>('now');
  const [who, setWho] = useState<'just_me' | 'everyone'>('everyone');
  const [results, setResults] = useState<ConciergeResultPlace[]>([]);
  const [error, setError] = useState<string | null>(null);

  // No-trip destination search
  const [destQuery, setDestQuery] = useState('');
  const [destSuggestions, setDestSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchLabel, setSearchLabel] = useState('');
  const destTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveCoords = tripCoords ?? originCoords ?? searchCoords;
  const effectiveDest = tripDest || originLabel || searchLabel;
  const isGroup = tripMembers.length >= 2;

  // ── Handlers ────────────────────────────────────────────────────

  const selectWhat = useCallback((id: ConciergeWhat) => {
    setWhat(id);
    setFreeform('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('when');
  }, []);

  const submitFreeform = useCallback(() => {
    if (!freeform.trim()) return;
    setWhat(freeform.trim());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('when');
  }, [freeform]);

  const selectWhen = useCallback((id: ConciergeWhen) => {
    setWhen(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isGroup) {
      setStep('who');
    } else {
      triggerSearch(what, id, 1);
    }
  }, [isGroup, what]);

  const selectWho = useCallback((choice: 'just_me' | 'everyone') => {
    setWho(choice);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const count = choice === 'everyone' ? tripGroupSize : 1;
    triggerSearch(what, when, count);
  }, [what, when, tripGroupSize]);

  const triggerSearch = useCallback(async (
    whatVal: ConciergeWhat | string,
    whenVal: ConciergeWhen,
    whoCount: number,
  ) => {
    if (!effectiveCoords) {
      setError('Set a destination to get suggestions.');
      setStep('what');
      return;
    }

    setStep('loading');
    setError(null);
    try {
      const places = await runConciergeSearch({
        what: whatVal,
        when: whenVal,
        whoCount,
        destination: effectiveDest,
        hotelName: tripHotel || undefined,
        coords: effectiveCoords,
        budget: tripBudget || undefined,
        budgetCurrency: tripBudgetCurrency,
      });
      setResults(places);
      setStep('results');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setStep('what');
    }
  }, [effectiveCoords, effectiveDest, tripHotel, tripBudget, tripBudgetCurrency]);

  const startOver = useCallback(() => {
    setStep('what');
    setWhat(defaults.suggestedWhat);
    setFreeform('');
    setWhen('now');
    setWho('everyone');
    setResults([]);
    setError(null);
  }, [defaults.suggestedWhat]);

  // ── No-trip destination search ──────────────────────────────────

  const handleDestInput = useCallback((text: string) => {
    setDestQuery(text);
    if (destTimer.current) clearTimeout(destTimer.current);
    if (!text.trim()) { setDestSuggestions([]); return; }
    destTimer.current = setTimeout(async () => {
      try {
        const res = await placeAutocomplete(text);
        setDestSuggestions(res.slice(0, 4));
      } catch { setDestSuggestions([]); }
    }, 400);
  }, []);

  const selectDest = useCallback(async (placeId: string, label: string) => {
    setDestSuggestions([]);
    setDestQuery(label.split(',')[0]);
    setSearchLabel(label.split(',')[0]);
    try {
      const loc = await getPlaceLocation(placeId);
      if (loc) setSearchCoords({ lat: loc.lat, lng: loc.lng });
    } catch { /* ignore */ }
  }, []);

  // ── Save handler (delegates to parent's toggleSave via addPlace) ─

  const handleSave = useCallback(async (name: string) => {
    if (!tripId) return;
    const place = results.find((r) => r.name === name);
    if (!place) return;
    try {
      await addPlace({
        tripId,
        name: place.name,
        category: resolveCategory(place.types ?? []),
        distance: '',
        rating: place.rating,
        source: 'Suggested',
        vote: 'Pending' as PlaceVote,
        photoUrl: place.photoUrl,
        googlePlaceId: place.placeId,
        latitude: place.lat,
        longitude: place.lng,
        totalRatings: place.totalRatings,
        saved: true,
      });
      onSavePlace(name);
    } catch { /* ignore */ }
  }, [tripId, results, onSavePlace]);

  // ── Distance helper ─────────────────────────────────────────────

  const getDistKm = useCallback((lat?: number, lng?: number): number => {
    if (lat == null || lng == null) return 0;
    if (effectiveCoords) {
      return distanceFromPoint(effectiveCoords.lat, effectiveCoords.lng, lat, lng);
    }
    return distanceFromHotel(lat, lng);
  }, [effectiveCoords]);

  // ── Loading messages ────────────────────────────────────────────

  const loadingMsg = useMemo(() => {
    const whatLabel = WHAT_OPTIONS.find((o) => o.id === what)?.label?.toLowerCase() ?? what;
    return `Finding ${whatLabel} spots near you...`;
  }, [what]);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <View style={s.container}>
      {/* Step dots */}
      {step !== 'results' && step !== 'loading' && (
        <View style={s.dots}>
          {['what', 'when', ...(isGroup ? ['who'] : [])].map((d, i) => (
            <View
              key={d}
              style={[s.dot, step === d ? s.dotActive : s.dotInactive]}
            />
          ))}
        </View>
      )}

      {/* ─── STEP 1: WHAT ─── */}
      {step === 'what' && (
        <Animated.View entering={FadeInDown.duration(300)} style={s.stepContainer}>
          <View style={s.greetingRow}>
            <Sparkles size={18} color={colors.accent} />
            <Text style={s.greeting}>{defaults.greeting}!</Text>
          </View>
          <Text style={s.question}>What are you looking for?</Text>

          {/* No-trip: destination search */}
          {!tripCoords && (
            <View style={s.destSection}>
              <View style={s.destInputRow}>
                <MapPin size={14} color={colors.text3} />
                <TextInput
                  style={s.destInput}
                  value={destQuery}
                  onChangeText={handleDestInput}
                  placeholder="Where are you?"
                  placeholderTextColor={colors.text3}
                />
                {destQuery.length > 0 && (
                  <Pressable onPress={() => { setDestQuery(''); setSearchCoords(null); setSearchLabel(''); setDestSuggestions([]); }} hitSlop={8}>
                    <X size={14} color={colors.text3} />
                  </Pressable>
                )}
              </View>
              {destSuggestions.length > 0 && (
                <View style={s.suggestions}>
                  {destSuggestions.map((sg) => (
                    <Pressable key={sg.placeId} style={s.suggestionItem} onPress={() => selectDest(sg.placeId, sg.description)}>
                      <Text style={s.suggestionText} numberOfLines={1}>{sg.description}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Category chips */}
          <View style={s.chipGrid}>
            {WHAT_OPTIONS.map((opt) => {
              const active = what === opt.id && !freeform;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => selectWhat(opt.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.chipEmoji}>{opt.emoji}</Text>
                  <Text style={[s.chipLabel, active && s.chipLabelActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Freeform */}
          <View style={s.freeformRow}>
            <TextInput
              style={s.freeformInput}
              value={freeform}
              onChangeText={setFreeform}
              placeholder="Or type something..."
              placeholderTextColor={colors.text3}
              onSubmitEditing={submitFreeform}
              returnKeyType="search"
            />
            {freeform.trim().length > 0 && (
              <TouchableOpacity style={s.freeformGo} onPress={submitFreeform} activeOpacity={0.7}>
                <Search size={16} color={colors.bg} />
              </TouchableOpacity>
            )}
          </View>

          {error && <Text style={s.error}>{error}</Text>}
        </Animated.View>
      )}

      {/* ─── STEP 2: WHEN ─── */}
      {step === 'when' && (
        <Animated.View entering={FadeInDown.duration(300)} style={s.stepContainer}>
          <Text style={s.question}>When?</Text>
          <Text style={s.subtext}>
            {WHAT_OPTIONS.find((o) => o.id === what)?.emoji ?? '\u2728'}{' '}
            {WHAT_OPTIONS.find((o) => o.id === what)?.label ?? what}
          </Text>
          <View style={s.whenChips}>
            {WHEN_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[s.whenChip, when === opt.id && s.chipActive]}
                onPress={() => selectWhen(opt.id)}
                activeOpacity={0.7}
              >
                <Text style={[s.whenChipText, when === opt.id && s.chipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setStep('what')} style={s.backLink}>
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ─── STEP 3: WHO ─── */}
      {step === 'who' && (
        <Animated.View entering={FadeInDown.duration(300)} style={s.stepContainer}>
          <Text style={s.question}>Who's going?</Text>
          <Text style={s.subtext}>
            {WHAT_OPTIONS.find((o) => o.id === what)?.emoji ?? '\u2728'}{' '}
            {WHAT_OPTIONS.find((o) => o.id === what)?.label ?? what} {'\u00B7'}{' '}
            {WHEN_OPTIONS.find((o) => o.id === when)?.label ?? when}
          </Text>
          <View style={s.whenChips}>
            <TouchableOpacity
              style={[s.whenChip, who === 'just_me' && s.chipActive]}
              onPress={() => selectWho('just_me')}
              activeOpacity={0.7}
            >
              <Text style={[s.whenChipText, who === 'just_me' && s.chipLabelActive]}>Just me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.whenChip, who === 'everyone' && s.chipActive]}
              onPress={() => selectWho('everyone')}
              activeOpacity={0.7}
            >
              <Text style={[s.whenChipText, who === 'everyone' && s.chipLabelActive]}>Everyone ({tripGroupSize})</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setStep('when')} style={s.backLink}>
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ─── LOADING ─── */}
      {step === 'loading' && (
        <View style={s.loadingContainer}>
          <MiniLoader message={loadingMsg} />
        </View>
      )}

      {/* ─── RESULTS ─── */}
      {step === 'results' && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={s.resultsHeader}>Here's what I found</Text>
          <Text style={s.resultsSubtext}>
            {WHAT_OPTIONS.find((o) => o.id === what)?.emoji ?? '\u2728'}{' '}
            {WHAT_OPTIONS.find((o) => o.id === what)?.label ?? what} {'\u00B7'}{' '}
            {WHEN_OPTIONS.find((o) => o.id === when)?.label ?? when}
          </Text>

          {results.map((place, i) => (
            <ConciergeResultCard
              key={place.placeId ?? `${place.name}-${i}`}
              place={place}
              tripId={tripId}
              distanceKm={getDistKm(place.lat, place.lng)}
              travelMode={travelMode}
              isSaved={savedNames.has(place.name)}
              onSave={handleSave}
              onOpenDetail={onOpenDetail}
            />
          ))}

          {results.length === 0 && (
            <Text style={s.noResults}>No suggestions found. Try a different search.</Text>
          )}

          <TouchableOpacity style={s.startOver} onPress={startOver} activeOpacity={0.7}>
            <RefreshCw size={14} color={colors.accent} />
            <Text style={s.startOverText}>Start over</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },

    // Step dots
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginBottom: spacing.lg,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotActive: {
      backgroundColor: colors.accent,
    },
    dotInactive: {
      backgroundColor: colors.border,
    },

    // Steps
    stepContainer: {
      gap: spacing.lg,
    },
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    greeting: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    question: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    subtext: {
      fontSize: 14,
      color: colors.text3,
      marginTop: -8,
    },

    // What chips (2x3 grid)
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      width: '30%',
      flexGrow: 1,
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    chipActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    chipEmoji: {
      fontSize: 22,
    },
    chipLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text2,
    },
    chipLabelActive: {
      color: colors.accent,
    },

    // Freeform
    freeformRow: {
      flexDirection: 'row',
      gap: 8,
    },
    freeformInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.bg2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    freeformGo: {
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // When chips
    whenChips: {
      flexDirection: 'row',
      gap: 10,
    },
    whenChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    whenChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },

    // Back link
    backLink: {
      alignSelf: 'flex-start',
    },
    backText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text3,
    },

    // No-trip destination
    destSection: {
      gap: 4,
    },
    destInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    destInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
    suggestions: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
    },
    suggestionItem: {
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionText: {
      fontSize: 13,
      color: colors.text,
    },

    // Loading
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 48,
    },

    // Results
    resultsHeader: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    resultsSubtext: {
      fontSize: 13,
      color: colors.text3,
      marginBottom: spacing.lg,
    },
    noResults: {
      fontSize: 14,
      color: colors.text3,
      textAlign: 'center',
      paddingVertical: 24,
    },
    startOver: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 16,
      marginTop: 8,
    },
    startOverText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },

    // Error
    error: {
      fontSize: 13,
      color: colors.danger,
      textAlign: 'center',
    },
  });
