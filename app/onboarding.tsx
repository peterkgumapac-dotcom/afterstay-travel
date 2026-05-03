import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  ArrowRight,
  Bus,
  Camera,
  Car,
  CheckCircle,
  ChevronLeft,
  CircleHelp,
  FileText,
  Flame,
  Hotel,
  Landmark,
  Leaf,
  MapPin,
  Music,
  Plane,
  Ship,
  UtensilsCrossed,
  Users,
  Waves,
  Wifi,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import { cacheSet } from '@/lib/cache';
import { compressImage } from '@/lib/compressImage';
import {
  addFlight,
  createTrip,
  getFlights,
  getGroupMembers,
  getTripById,
  joinTripByCode,
  replaceTripFlights,
  saveDraftTrip,
  updateMyTripMemberPreferences,
  updateProfile,
} from '@/lib/supabase';
import { scanTripDocuments } from '@/lib/anthropic';
import { getPrimaryBookerFlights } from '@/lib/flightSharing';
import { placeAutocomplete, type AutocompleteResult } from '@/lib/google-places';
import { clearPendingInviteCode } from '@/lib/pendingInvite';
import {
  clearOnboardingScanReview,
  completeOnboarding,
  getOnboardingProgress,
  getOnboardingScanReview,
  saveOnboardingScanReview,
  setOnboardingProgress,
} from '@/lib/onboardingProgress';
import { formatDatePHT, MS_PER_DAY } from '@/lib/utils';
import type { Flight, Trip } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type Path = null | 'plan' | 'upload' | 'invited';
const SCAN_TIMEOUT_MS = 90_000;
const TRIP_SAVE_TIMEOUT_MS = 45_000;
const FLIGHT_SAVE_TIMEOUT_MS = 60_000;
const ONBOARDING_SCAN_STEPS = [
  'Preparing your files',
  'Compressing screenshots',
  'Reading booking details',
  'Checking flights and dates',
  'Saving your review',
];

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      promise.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer),
      );
    }),
  ]);
}

function scanErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/request entity too large|payload too large|body size|413/i.test(message)) {
    return 'Those screenshots are too large to scan. Try one clearer screenshot, or crop closer to the flight/hotel details.';
  }
  if (/edge function returned a non-2xx|non-2xx status|AI error/i.test(message)) {
    return 'The trip scanner hit a server error before it could read the itinerary. Please try again with one clearer screenshot.';
  }
  if (/missing auth|unauthorized|sign in/i.test(message)) {
    return 'Please sign in again, then retry the scan.';
  }
  if (/timed out/i.test(message)) {
    return message;
  }
  return message || 'Could not read your files.';
}

function hasText(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0;
}

function missingUploadScanFields(scan: { destination?: string; startDate?: string; endDate?: string }) {
  const missing: string[] = [];
  if (!hasText(scan.destination)) missing.push('destination');
  if (!hasText(scan.startDate)) missing.push('start date');
  if (!hasText(scan.endDate)) missing.push('end date');
  return missing;
}

function getUsableScannedFlights(scan: { flights?: any[] }) {
  return (scan.flights ?? []).filter((flight) => hasText(flight.flightNumber));
}

function hasAnyReadableTripDetails(scan: {
  destination?: string;
  startDate?: string;
  endDate?: string;
  accommodation?: string;
  address?: string;
  flights?: any[];
}) {
  return (
    hasText(scan.destination) ||
    hasText(scan.startDate) ||
    hasText(scan.endDate) ||
    hasText(scan.accommodation) ||
    hasText(scan.address) ||
    getUsableScannedFlights(scan).length > 0
  );
}

function looksLikeMultiDayScan(scan: { startDate?: string; endDate?: string }) {
  return hasText(scan.startDate) && hasText(scan.endDate) && scan.startDate !== scan.endDate;
}

function airportCode(value?: string) {
  if (!value) return '';
  return value.match(/\(([A-Z]{3})\)/i)?.[1]?.toUpperCase() ?? value.match(/\b[A-Z]{3}\b/i)?.[0]?.toUpperCase() ?? '';
}

function normalizeScanFlights<
  T extends { flights?: any[]; startDate?: string; endDate?: string; destination?: string },
>(scan: T): T {
  if (!scan.flights?.length) return scan;
  const sorted = [...scan.flights].sort(
    (a, b) =>
      new Date(a.departTime || 8640000000000000).getTime() - new Date(b.departTime || 8640000000000000).getTime(),
  );
  const routeKey = (f: any) =>
    `${airportCode(f.from) || String(f.from ?? '').toLowerCase()}-${airportCode(f.to) || String(f.to ?? '').toLowerCase()}`;
  const reverseKey = (f: any) =>
    `${airportCode(f.to) || String(f.to ?? '').toLowerCase()}-${airportCode(f.from) || String(f.from ?? '').toLowerCase()}`;
  const normalized = sorted.map((flight, index) => {
    let direction = /return|inbound|back|homebound/i.test(flight.direction ?? '') ? 'Return' : 'Outbound';
    const departDay = flight.departTime?.slice?.(0, 10);
    if (scan.startDate && departDay === scan.startDate) direction = 'Outbound';
    if (scan.endDate && departDay === scan.endDate) direction = 'Return';
    if (sorted.slice(0, index).some((other) => routeKey(other) === reverseKey(flight))) direction = 'Return';
    return { ...flight, direction };
  });
  const returnCount = normalized.filter((f) => f.direction === 'Return').length;
  if (normalized.length >= 2 && returnCount === 0) {
    normalized[0] = { ...normalized[0], direction: 'Outbound' };
    normalized[normalized.length - 1] = { ...normalized[normalized.length - 1], direction: 'Return' };
  }
  return { ...scan, flights: normalized };
}

function planDatesFromWhen(when?: string): { startDate: string; endDate: string } {
  const today = new Date();
  let start: Date;
  switch (when) {
    case 'This month':
      start = new Date(today.getTime() + 14 * MS_PER_DAY);
      break;
    case 'Next month':
      start = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      break;
    case 'In 2–3 months':
      start = new Date(today.getTime() + 75 * MS_PER_DAY);
      break;
    case 'Later this year':
      start = new Date(today.getFullYear(), Math.min(today.getMonth() + 4, 11), 15);
      break;
    default:
      start = new Date(today.getTime() + 60 * MS_PER_DAY);
  }
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(start.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10),
  };
}

// ── Shared components ────────────────────────────────────────────────

function BrandRow({ step, of, colors }: { step?: number; of?: number; colors: ThemeColors }) {
  return (
    <View style={shared.brandRow}>
      <Text style={[shared.brandText, { color: colors.text2 }]}>
        after<Text style={{ color: colors.accent, fontStyle: 'italic', fontWeight: '500' }}>stay</Text>
      </Text>
      {step && of ? (
        <View style={shared.dots}>
          {Array.from({ length: of }, (_, i) => (
            <View
              key={i}
              style={[
                shared.dot,
                {
                  width: i + 1 === step ? 18 : 6,
                  backgroundColor: i < step ? colors.accent : colors.border2,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Header({
  onBack,
  kicker,
  title,
  sub,
  colors,
}: {
  onBack?: () => void;
  kicker?: string;
  title: string;
  sub?: string;
  colors: ThemeColors;
}) {
  return (
    <View style={shared.header}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={shared.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={16} color={colors.text3} strokeWidth={2} />
          <Text style={[shared.backText, { color: colors.text3 }]}>Back</Text>
        </TouchableOpacity>
      )}
      {kicker && <Text style={[shared.kicker, { color: colors.accent }]}>{kicker}</Text>}
      <Text style={[shared.title, { color: colors.text }]}>{title}</Text>
      {sub && <Text style={[shared.sub, { color: colors.text2 }]}>{sub}</Text>}
    </View>
  );
}

function PrimaryBtn({
  children,
  onPress,
  disabled,
  colors,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        shared.primaryBtn,
        {
          backgroundColor: disabled ? colors.card2 : colors.black,
          borderColor: disabled ? colors.border : colors.black,
        },
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[shared.primaryText, { color: disabled ? colors.text3 : colors.onBlack }]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

function GhostBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={shared.ghostBtn} activeOpacity={0.7}>
      <Text style={[shared.ghostText, { color: colors.text2 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: ThemeColors }) {
  return <Text style={[shared.fieldLabel, { color: colors.text3 }]}>{label}</Text>;
}

function Input({
  value,
  onChange,
  placeholder,
  prefix,
  colors,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix?: string;
  colors: ThemeColors;
  autoFocus?: boolean;
}) {
  return (
    <View style={[shared.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {prefix && (
        <Text style={[shared.inputPrefix, { color: colors.text2, borderRightColor: colors.border }]}>{prefix}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text3}
        style={[shared.input, { color: colors.text }]}
        autoFocus={autoFocus}
      />
    </View>
  );
}

// ── Path Picker (root) ───────────────────────────────────────────────

function PathPicker({
  onPick,
  onBack,
  onSkip,
  name,
  colors,
}: {
  onPick: (p: Exclude<Path, null>) => void;
  onBack?: () => void;
  onSkip: () => void;
  name: string;
  colors: ThemeColors;
}) {
  const paths = [
    {
      id: 'upload' as const,
      kicker: 'A',
      label: "I've already booked",
      sub: "Drop in your confirmation screenshots — we'll read them and set up your trip.",
      icon: FileText,
    },
    {
      id: 'invited' as const,
      kicker: 'B',
      label: 'Someone invited me',
      sub: 'Trip details are already waiting. Just enter your invite code.',
      icon: Users,
    },
    {
      id: 'plan' as const,
      kicker: 'C',
      label: 'Plan a new trip',
      sub: "Tell us where you're dreaming of. We'll shape it into days.",
      icon: Plane,
    },
  ];

  return (
    <ScrollView contentContainerStyle={shared.scrollContent}>
      <BrandRow colors={colors} />
      <Header
        onBack={onBack}
        kicker={`Welcome, ${name}`}
        title="How do you want to start?"
        sub="You can always add another trip later. This is just how you'd like to begin."
        colors={colors}
      />
      <View style={shared.cards}>
        {paths.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.duration(400).delay(150 + i * 80)}>
            <TouchableOpacity
              style={[shared.pathCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPick(p.id);
              }}
              activeOpacity={0.85}
            >
              <View style={[shared.pathIcon, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
                <p.icon size={26} color={colors.accent} strokeWidth={1.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[shared.pathKicker, { color: colors.accent }]}>Option {p.kicker}</Text>
                <Text style={[shared.pathLabel, { color: colors.text }]}>{p.label}</Text>
                <Text style={[shared.pathSub, { color: colors.text2 }]}>{p.sub}</Text>
              </View>
              <View style={[shared.pathArrow, { backgroundColor: colors.card2, borderColor: colors.border }]}>
                <ArrowRight size={12} color={colors.text2} strokeWidth={2} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
      <Text style={[shared.hint, { color: colors.text3 }]}>
        Already booked? Start with <Text style={{ color: colors.accent, fontWeight: '600' }}>I've already booked</Text>{' '}
        — we'll read your confirmation and set everything up.
      </Text>
      <TouchableOpacity onPress={onSkip} style={shared.skipBtn} activeOpacity={0.7}>
        <Text style={[shared.skipText, { color: colors.text3 }]}>Skip for now</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Branch A: Plan a trip ────────────────────────────────────────────

function PlanFlow({
  onBack,
  onDone,
  colors,
}: {
  onBack: () => void;
  onDone: (data: any) => void;
  colors: ThemeColors;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [dest, setDest] = useState('');
  const [vibes, setVibes] = useState<string[]>([]);
  const [transport, setTransport] = useState<string | undefined>(undefined);
  const [when, setWhen] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [destSuggestions, setDestSuggestions] = useState<AutocompleteResult[]>([]);
  const [destSearching, setDestSearching] = useState(false);
  const destTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDestinationChange = useCallback((text: string) => {
    setDest(text);
    if (destTimer.current) clearTimeout(destTimer.current);
    if (text.trim().length < 2) {
      setDestSuggestions([]);
      setDestSearching(false);
      return;
    }
    destTimer.current = setTimeout(async () => {
      setDestSearching(true);
      try {
        const results = await placeAutocomplete(text);
        const trimmed = text.trim();
        const next = results.slice(0, 5);
        setDestSuggestions(
          next.length > 0 ? next : [{ placeId: `manual:${trimmed}`, description: `Use "${trimmed}"` }],
        );
      } catch {
        const trimmed = text.trim();
        setDestSuggestions([{ placeId: `manual:${trimmed}`, description: `Use "${trimmed}"` }]);
      } finally {
        setDestSearching(false);
      }
    }, 300);
  }, []);

  const selectDestination = useCallback((suggestion: AutocompleteResult) => {
    Keyboard.dismiss();
    const destination = suggestion.placeId.startsWith('manual:')
      ? suggestion.description.replace(/^Use\s+"/, '').replace(/"$/, '')
      : suggestion.description;
    setDest(destination);
    setDestSuggestions([]);
  }, []);

  useEffect(() => {
    setOnboardingProgress(
      {
        stage: 'planning_started',
        path: 'plan',
        meta: { step },
      },
      user?.id,
    ).catch(() => {});
  }, [step, user?.id]);

  const handleBackOut = useCallback(async () => {
    if (dest.trim()) {
      try {
        const draftId = await saveDraftTrip({
          destination: dest.trim(),
          transport: transport === 'unknown' ? undefined : transport,
          vibes: vibes.length > 0 ? vibes : undefined,
          when: when || undefined,
          travelers,
        });
        await cacheSet('draft:trip_id', draftId);
        await cacheSet(user?.id ? `onboarding_complete:${user.id}` : 'onboarding_complete', true);
        await setOnboardingProgress(
          {
            stage: 'planning_draft',
            path: 'plan',
            tripId: draftId,
            meta: { destination: dest.trim(), step },
          },
          user?.id,
        );
        if (user?.id) await updateProfile(user.id, { onboardedAt: new Date().toISOString() }).catch(() => {});
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home' as never);
        return;
      } catch (e: any) {
        Alert.alert('Could not save draft', e?.message ?? 'Your progress was not saved. You can try again later.');
      }
    }
    onBack();
  }, [dest, vibes, transport, when, travelers, step, onBack, router, user?.id]);

  const TRANSPORT: { id: string; label: string; Icon: typeof Plane; sub: string }[] = [
    { id: 'plane', label: 'Flying', Icon: Plane, sub: 'Taking a flight' },
    { id: 'car', label: 'Driving', Icon: Car, sub: 'Road trip or rental' },
    { id: 'bus', label: 'Bus / Coach', Icon: Bus, sub: 'Bus or coach' },
    { id: 'ferry', label: 'Ferry / Boat', Icon: Ship, sub: 'By sea' },
    { id: 'unknown', label: 'Not sure yet', Icon: CircleHelp, sub: "I'll figure it out later" },
  ];

  const VIBES: { id: string; label: string; Icon: typeof Plane }[] = [
    { id: 'beach', label: 'Beach & water', Icon: Waves },
    { id: 'food', label: 'Food-first', Icon: UtensilsCrossed },
    { id: 'culture', label: 'Culture & arts', Icon: Landmark },
    { id: 'nature', label: 'Nature & hikes', Icon: Leaf },
    { id: 'chill', label: 'Slow & restful', Icon: Flame },
    { id: 'party', label: 'Nightlife', Icon: Music },
  ];
  const WHEN = ['This month', 'Next month', 'In 2–3 months', 'Later this year', 'Flexible'];
  const DESTS = ['Boracay', 'Tokyo', 'Bali', 'Lisbon', 'Hoi An'];

  if (step === 0) {
    return (
      <ScrollView contentContainerStyle={shared.scrollContent} keyboardShouldPersistTaps="handled">
        <BrandRow step={1} of={4} colors={colors} />
        <Header
          onBack={handleBackOut}
          kicker="Plan — 1 of 4"
          title="Where are you dreaming of?"
          sub="A city, country, or just a feeling."
          colors={colors}
        />
        <View style={shared.section}>
          <FieldLabel label="Destination" colors={colors} />
          <Input
            value={dest}
            onChange={handleDestinationChange}
            placeholder="Lisbon, Kyoto, somewhere warm…"
            colors={colors}
            autoFocus
          />
          {destSearching && destSuggestions.length === 0 && (
            <View style={[shared.searchingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[shared.searchingText, { color: colors.text3 }]}>Searching destinations...</Text>
            </View>
          )}
          {destSuggestions.length > 0 && (
            <View style={[shared.suggestionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {destSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.placeId}
                  onPress={() => selectDestination(suggestion)}
                  style={[shared.suggestionRow, { borderBottomColor: colors.border }]}
                  activeOpacity={0.75}
                >
                  <MapPin size={14} color={colors.accent} strokeWidth={1.8} />
                  <Text style={[shared.suggestionText, { color: colors.text2 }]} numberOfLines={1}>
                    {suggestion.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={shared.chipRow}>
            {DESTS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => {
                  Keyboard.dismiss();
                  setDest(s);
                  setDestSuggestions([]);
                }}
                style={[
                  shared.chip,
                  {
                    backgroundColor: dest === s ? colors.accentBg : colors.card,
                    borderColor: dest === s ? colors.accentBorder : colors.border,
                  },
                ]}
              >
                <Text style={[shared.chipText, { color: dest === s ? colors.accent : colors.text2 }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <PrimaryBtn onPress={() => setStep(1)} disabled={!dest.trim()} colors={colors}>
            <Text style={[shared.primaryText, { color: !dest.trim() ? colors.text3 : colors.onBlack }]}>Continue</Text>
            <ArrowRight size={14} color={!dest.trim() ? colors.text3 : colors.onBlack} strokeWidth={2} />
          </PrimaryBtn>
        </View>
      </ScrollView>
    );
  }

  if (step === 1) {
    return (
      <ScrollView contentContainerStyle={shared.scrollContent} keyboardShouldPersistTaps="handled">
        <BrandRow step={2} of={4} colors={colors} />
        <Header
          onBack={() => setStep(0)}
          kicker="Plan — 2 of 4"
          title="What's the shape of this trip?"
          sub="Pick whatever feels right. Multi-select is fine."
          colors={colors}
        />
        <View style={shared.section}>
          <View style={shared.vibeGrid}>
            {VIBES.map((v) => {
              const on = vibes.includes(v.id);
              return (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => setVibes((vs) => (vs.includes(v.id) ? vs.filter((x) => x !== v.id) : [...vs, v.id]))}
                  style={[
                    shared.vibeCard,
                    {
                      backgroundColor: on ? colors.accentBg : colors.card,
                      borderColor: on ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <v.Icon size={22} color={on ? colors.accent : colors.text2} strokeWidth={1.8} />
                  <Text style={[shared.vibeLabel, { color: on ? colors.accent : colors.text }]}>{v.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <PrimaryBtn onPress={() => setStep(2)} disabled={vibes.length === 0} colors={colors}>
            <Text style={[shared.primaryText, { color: vibes.length === 0 ? colors.text3 : colors.onBlack }]}>
              Continue
            </Text>
            <ArrowRight size={14} color={vibes.length === 0 ? colors.text3 : colors.onBlack} strokeWidth={2} />
          </PrimaryBtn>
          <GhostBtn label="Skip — I'll decide later" onPress={() => setStep(2)} />
        </View>
      </ScrollView>
    );
  }

  if (step === 2) {
    return (
      <ScrollView contentContainerStyle={shared.scrollContent} keyboardShouldPersistTaps="handled">
        <BrandRow step={3} of={4} colors={colors} />
        <Header
          onBack={() => setStep(1)}
          kicker="Plan — 3 of 4"
          title="How are you getting there?"
          sub="This helps us show the right features for your trip."
          colors={colors}
        />
        <View style={shared.section}>
          {TRANSPORT.map((t) => {
            const on = transport === t.id;
            return (
              <TouchableOpacity
                key={t.id || 'unsure'}
                onPress={() => setTransport(t.id)}
                style={[
                  shared.optionBtn,
                  {
                    backgroundColor: on ? colors.accentBg : colors.card,
                    borderColor: on ? colors.accent : colors.border,
                    flexDirection: 'row',
                    gap: 12,
                  },
                ]}
              >
                <t.Icon size={20} color={on ? colors.accent : colors.text2} strokeWidth={1.8} />
                <View style={{ flex: 1 }}>
                  <Text style={[shared.optionText, { color: on ? colors.accent : colors.text }]}>{t.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.text3, marginTop: 1 }}>{t.sub}</Text>
                </View>
                {on && <CheckCircle size={16} color={colors.accent} strokeWidth={2} />}
              </TouchableOpacity>
            );
          })}
          <PrimaryBtn onPress={() => setStep(3)} disabled={false} colors={colors}>
            <Text style={[shared.primaryText, { color: colors.onBlack }]}>Continue</Text>
            <ArrowRight size={14} color={colors.onBlack} strokeWidth={2} />
          </PrimaryBtn>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={shared.scrollContent} keyboardShouldPersistTaps="handled">
      <BrandRow step={4} of={4} colors={colors} />
      <Header
        onBack={() => setStep(2)}
        kicker="Plan — 4 of 4"
        title="When, and with whom?"
        sub="Rough dates work. You can refine everything later."
        colors={colors}
      />
      <View style={shared.section}>
        <FieldLabel label="Approximate dates" colors={colors} />
        {WHEN.map((opt) => {
          const on = when === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => setWhen(opt)}
              style={[
                shared.optionBtn,
                {
                  backgroundColor: on ? colors.accentBg : colors.card,
                  borderColor: on ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[shared.optionText, { color: on ? colors.accent : colors.text }]}>{opt}</Text>
              {on && <CheckCircle size={16} color={colors.accent} strokeWidth={2} />}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 14 }} />
        <FieldLabel label="Travelers" colors={colors} />
        <View style={[shared.stepperRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View>
            <Text style={[shared.stepperValue, { color: colors.text }]}>
              {travelers} {travelers === 1 ? 'person' : 'people'}
            </Text>
            <Text style={[shared.stepperHint, { color: colors.text3 }]}>Including you</Text>
          </View>
          <View style={shared.stepperBtns}>
            <TouchableOpacity
              onPress={() => setTravelers(Math.max(1, travelers - 1))}
              style={[shared.stepperBtn, { backgroundColor: colors.card2, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTravelers(travelers + 1)}
              style={[shared.stepperBtn, { backgroundColor: colors.card2, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 14 }} />
        <PrimaryBtn
          onPress={() => onDone({ kind: 'plan', dest, vibes, transport, when, travelers })}
          disabled={!when}
          colors={colors}
        >
          <Text style={[shared.primaryText, { color: !when ? colors.text3 : colors.onBlack }]}>Draft my trip</Text>
          <ArrowRight size={14} color={!when ? colors.text3 : colors.onBlack} strokeWidth={2} />
        </PrimaryBtn>
        <Text style={[shared.footnote, { color: colors.text3 }]}>
          We'll sketch a starting itinerary you can reshape.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Branch B: Upload bookings ────────────────────────────────────────

function UploadFlow({
  onBack,
  onDone,
  colors,
}: {
  onBack: () => void;
  onDone: (data: any) => void;
  colors: ThemeColors;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0.1);
  const [scanStage, setScanStage] = useState(ONBOARDING_SCAN_STEPS[0]);
  const [scanned, setScanned] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [progress, savedScan] = await Promise.all([
        getOnboardingProgress(user?.id),
        getOnboardingScanReview<any>(user?.id),
      ]);
      if (cancelled) return;
      if (progress?.stage === 'upload_review' && savedScan) {
        setScanned(savedScan);
        setStep(1);
        return;
      }
      await setOnboardingProgress({ stage: 'upload_started', path: 'upload' }, user?.id);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const CHECKLIST = [
    { icon: Plane, title: 'Flight confirmations', sub: 'Booking emails, boarding passes.' },
    { icon: Hotel, title: 'Hotel bookings', sub: 'From Agoda, Booking, Airbnb, direct.' },
    { icon: FileText, title: 'Activity vouchers', sub: 'Tours, restaurants. Optional.', optional: true },
  ];

  const pickImages = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Photo Library Access', 'Please enable photo library access in Settings.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
        ]);
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 3,
    });
    if (!res.canceled && res.assets.length > 0) {
      setImages(res.assets.map((a) => a.uri));
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanProgress(0.1);
    setScanStage(ONBOARDING_SCAN_STEPS[0]);
    try {
      const prepared: { base64: string; mimeType: string }[] = [];
      for (let index = 0; index < images.length; index += 1) {
        setScanStage(images.length > 1 ? `Compressing file ${index + 1} of ${images.length}` : ONBOARDING_SCAN_STEPS[1]);
        setScanProgress(0.18 + (index / Math.max(images.length, 1)) * 0.24);
        const compressed = await compressImage(images[index], 1000, 0.6);
        const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: 'base64' as any });
        prepared.push({ base64, mimeType: 'image/jpeg' });
      }
      setScanStage('Checking image size');
      setScanProgress(0.48);
      const estimatedBytes = prepared.reduce((sum, img) => sum + Math.ceil(img.base64.length * 0.75), 0);
      if (estimatedBytes > 4_500_000) {
        throw new Error('Payload too large for trip scan');
      }
      setScanStage(ONBOARDING_SCAN_STEPS[2]);
      setScanProgress(0.58);
      const result = normalizeScanFlights(
        await withTimeout(
          scanTripDocuments(prepared),
          SCAN_TIMEOUT_MS,
          'Scanning timed out. Try one clearer screenshot, or crop closer to the itinerary.',
        ),
      );
      setScanStage(ONBOARDING_SCAN_STEPS[3]);
      setScanProgress(0.82);
      if (!hasAnyReadableTripDetails(result)) {
        throw new Error(
          'Could not read enough trip details. Try a clearer full-page screenshot with the route, dates, and flight numbers visible.',
        );
      }
      setScanStage(ONBOARDING_SCAN_STEPS[4]);
      setScanProgress(0.92);
      await saveOnboardingScanReview(result, user?.id);
      await setOnboardingProgress({ stage: 'upload_review', path: 'upload' }, user?.id);
      setScanned(result);
      setScanProgress(1);
      setScanning(false);
      setStep(1); // Show review screen
    } catch (e: any) {
      Alert.alert('Scan failed', scanErrorMessage(e));
      setScanProgress(0.1);
      setScanStage(ONBOARDING_SCAN_STEPS[0]);
      setScanning(false);
    }
  };

  if (scanning) {
    return (
      <View style={[shared.centered, { backgroundColor: colors.bg }]}>
        <View style={[shared.scanCircle, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
        <Text style={[shared.scanText, { color: colors.text }]}>Reading your bookings...</Text>
        <Text style={[shared.scanSub, { color: colors.text3 }]}>{scanStage}</Text>
        <View style={[shared.scanProgressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              shared.scanProgressFill,
              { backgroundColor: colors.accent, width: `${Math.round(Math.min(1, scanProgress) * 100)}%` },
            ]}
          />
        </View>
        <Text style={[shared.scanPercent, { color: colors.text3 }]}>
          {Math.round(Math.min(1, scanProgress) * 100)}%
        </Text>
      </View>
    );
  }

  // Step 1 — review scanned results (must be before step 0 return)
  if (step === 1 && scanned) {
    const flightsFound = scanned.flights ?? [];
    const usableFlights = getUsableScannedFlights(scanned);
    const missing = missingUploadScanFields(scanned);
    const createFromScan = () => {
      if (missing.length > 0) {
        Alert.alert(
          'Missing trip details',
          `The scan is missing ${missing.join(', ')}. Rescan with the full booking visible before creating this trip.`,
          [
            {
              text: 'Rescan',
              onPress: () => {
                clearOnboardingScanReview(user?.id).catch(() => {});
                setOnboardingProgress({ stage: 'upload_started', path: 'upload' }, user?.id).catch(() => {});
                setStep(0);
                setScanned(null);
              },
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        return;
      }
      if (usableFlights.length === 0) {
        Alert.alert(
          'No flights found',
          'This scan did not detect any flight segments. If your booking has outbound or return flights, rescan before creating the trip.',
          [
            {
              text: 'Rescan',
              onPress: () => {
                clearOnboardingScanReview(user?.id).catch(() => {});
                setOnboardingProgress({ stage: 'upload_started', path: 'upload' }, user?.id).catch(() => {});
                setStep(0);
                setScanned(null);
              },
            },
            {
              text: 'Create without flights',
              style: 'destructive',
              onPress: () => onDone({ kind: 'upload', scanned }),
            },
          ],
        );
        return;
      }
      if (usableFlights.length === 1 && looksLikeMultiDayScan(scanned)) {
        Alert.alert(
          'Only one flight found',
          'This looks like a multi-day trip, but the scan found only one flight. If your booking has a return flight, rescan before creating the trip.',
          [
            {
              text: 'Rescan',
              onPress: () => {
                clearOnboardingScanReview(user?.id).catch(() => {});
                setOnboardingProgress({ stage: 'upload_started', path: 'upload' }, user?.id).catch(() => {});
                setStep(0);
                setScanned(null);
              },
            },
            { text: 'Create one-way', style: 'destructive', onPress: () => onDone({ kind: 'upload', scanned }) },
          ],
        );
        return;
      }
      onDone({ kind: 'upload', scanned });
    };
    const rows = [
      { label: 'Destination', val: scanned.destination },
      {
        label: 'Dates',
        val:
          scanned.startDate && scanned.endDate
            ? `${formatDatePHT(scanned.startDate)} – ${formatDatePHT(scanned.endDate)}`
            : 'Not found',
      },
      scanned.accommodation ? { label: 'Hotel', val: scanned.accommodation } : null,
      scanned.address ? { label: 'Address', val: scanned.address } : null,
      scanned.checkIn ? { label: 'Check-in', val: scanned.checkIn } : null,
      scanned.checkOut ? { label: 'Check-out', val: scanned.checkOut } : null,
      scanned.roomType ? { label: 'Room', val: scanned.roomType } : null,
      scanned.bookingRef ? { label: 'Booking ref', val: scanned.bookingRef } : null,
      scanned.cost != null
        ? { label: 'Cost', val: `${scanned.costCurrency ?? 'PHP'} ${scanned.cost.toLocaleString()}` }
        : null,
      scanned.members?.length ? { label: 'Travelers', val: scanned.members.join(', ') } : null,
    ].filter(Boolean) as { label: string; val: string }[];

    return (
      <ScrollView contentContainerStyle={shared.scrollContent}>
        <BrandRow step={2} of={2} colors={colors} />
        <Header
          onBack={() => {
            clearOnboardingScanReview(user?.id).catch(() => {});
            setOnboardingProgress({ stage: 'upload_started', path: 'upload' }, user?.id).catch(() => {});
            setStep(0);
            setScanned(null);
          }}
          kicker="Upload — 2 of 2"
          title="Here's what we found."
          sub="Review the details we extracted from your screenshots."
          colors={colors}
        />
        <View style={shared.section}>
          <View style={[shared.infoList, { borderColor: colors.border }]}>
            {rows.map((r, i) => (
              <View
                key={i}
                style={[shared.infoRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[shared.infoLabel, { color: colors.text }]}>{r.label}</Text>
                  <Text style={[shared.infoVal, { color: colors.text3 }]}>{r.val}</Text>
                </View>
                <CheckCircle size={14} color={colors.accent} strokeWidth={2} />
              </View>
            ))}
          </View>

          {missing.length > 0 ? (
            <View style={[shared.checkItem, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
              <View style={[shared.checkIcon, { backgroundColor: colors.card, borderColor: colors.accentBorder }]}>
                <FileText size={16} color={colors.accent} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[shared.checkTitle, { color: colors.text }]}>Trip details are incomplete</Text>
                <Text style={[shared.checkSub, { color: colors.text2 }]}>
                  Rescan with the {missing.join(', ')} visible before creating this trip.
                </Text>
              </View>
            </View>
          ) : null}

          {flightsFound.length > 0 ? (
            <>
              <FieldLabel label="Flights found" colors={colors} />
              {flightsFound.map((f: any, i: number) => (
                <View key={i} style={[shared.checkItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View
                    style={[shared.checkIcon, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}
                  >
                    <Plane size={16} color={colors.accent} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[shared.checkTitle, { color: colors.text }]}>
                      {f.airline ?? ''} {f.flightNumber}
                    </Text>
                    <Text style={[shared.checkSub, { color: colors.text2 }]}>
                      {f.from} → {f.to} · {f.direction}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={[shared.checkItem, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
              <View style={[shared.checkIcon, { backgroundColor: colors.card, borderColor: colors.accentBorder }]}>
                <Plane size={16} color={colors.accent} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[shared.checkTitle, { color: colors.text }]}>No flights found</Text>
                <Text style={[shared.checkSub, { color: colors.text2 }]}>
                  If this is a round trip, rescan with the full flight details visible.
                </Text>
              </View>
            </View>
          )}

          <PrimaryBtn onPress={createFromScan} colors={colors}>
            <Text style={[shared.primaryText, { color: colors.onBlack }]}>Create my trip</Text>
            <ArrowRight size={14} color={colors.onBlack} strokeWidth={2} />
          </PrimaryBtn>
          <GhostBtn
            label="Rescan"
            onPress={() => {
              clearOnboardingScanReview(user?.id).catch(() => {});
              setOnboardingProgress({ stage: 'upload_started', path: 'upload' }, user?.id).catch(() => {});
              setStep(0);
              setScanned(null);
              setImages([]);
            }}
          />
        </View>
      </ScrollView>
    );
  }

  // Step 0 — upload guide + file picker
  return (
    <ScrollView contentContainerStyle={shared.scrollContent}>
      <BrandRow step={1} of={2} colors={colors} />
      <Header
        onBack={onBack}
        kicker="Upload — 1 of 2"
        title="Send us your confirmations."
        sub="Screenshots or PDFs — anything with the details."
        colors={colors}
      />
      <View style={shared.section}>
        <FieldLabel label="What helps most" colors={colors} />
        {CHECKLIST.map((c, i) => (
          <View key={i} style={[shared.checkItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[shared.checkIcon, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
              <c.icon size={16} color={colors.accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[shared.checkTitle, { color: colors.text }]}>
                {c.title}
                {c.optional && <Text style={[shared.optionalTag, { color: colors.text3 }]}> Optional</Text>}
              </Text>
              <Text style={[shared.checkSub, { color: colors.text2 }]}>{c.sub}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={pickImages}
          style={[shared.dropzone, { borderColor: colors.border2, backgroundColor: colors.card2 }]}
        >
          <View style={[shared.dropzoneIcon, { backgroundColor: colors.card, borderColor: colors.accentBorder }]}>
            <Camera size={22} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text style={[shared.dropzoneTitle, { color: colors.text }]}>Add screenshots or PDFs</Text>
          <Text style={[shared.dropzoneSub, { color: colors.text3 }]}>
            {images.length > 0
              ? `${images.length} file${images.length > 1 ? 's' : ''} selected`
              : 'Tap to pick from Photos'}
          </Text>
        </TouchableOpacity>

        <PrimaryBtn onPress={handleScan} disabled={images.length === 0} colors={colors}>
          <Text style={[shared.primaryText, { color: images.length === 0 ? colors.text3 : colors.onBlack }]}>
            {images.length > 0 ? 'Read my files' : 'Pick files first'}
          </Text>
          <ArrowRight size={14} color={images.length === 0 ? colors.text3 : colors.onBlack} strokeWidth={2} />
        </PrimaryBtn>
        <GhostBtn label="I'll upload later" onPress={onBack} />
      </View>
    </ScrollView>
  );
}

// ── Branch C: Invited to a trip ──────────────────────────────────────

function InvitedFlow({
  onBack,
  onDone,
  colors,
}: {
  onBack: () => void;
  onDone: (data: any) => void;
  colors: ThemeColors;
}) {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState('');
  const [tripInfo, setTripInfo] = useState<Trip | null>(null);
  const [joining, setJoining] = useState(false);
  const [flightNum, setFlightNum] = useState('');
  const [airline, setAirline] = useState('');
  const [checkedBag, setCheckedBag] = useState<boolean | null>(null);
  const [sharesStay, setSharesStay] = useState(true);
  const [flightMode, setFlightMode] = useState<'same' | 'different' | 'later'>('later');
  const [groupFlights, setGroupFlights] = useState<Flight[]>([]);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [bookingRef, setBookingRef] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [primaryBookerName, setPrimaryBookerName] = useState<string | null>(null);
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? '';

  const AIRLINES = ['Philippine Airlines', 'Cebu Pacific', 'AirAsia', 'Other'];
  const primaryBookerFlights = useMemo(
    () => getPrimaryBookerFlights(groupFlights, primaryBookerName),
    [groupFlights, primaryBookerName],
  );
  const selectedGroupFlight = primaryBookerFlights.find((f) => f.id === selectedFlightId) ?? primaryBookerFlights[0];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await getOnboardingProgress(user?.id);
      if (cancelled) return;
      if (progress?.stage === 'invited_joined_needs_details' && progress.tripId) {
        const [trip, flights, members] = await Promise.all([
          getTripById(progress.tripId),
          getFlights(progress.tripId).catch(() => [] as Flight[]),
          getGroupMembers(progress.tripId).catch(() => []),
        ]);
        if (cancelled || !trip) return;
        const primary = members.find((member) => member.role === 'Primary');
        const primaryFlights = getPrimaryBookerFlights(flights, primary?.name);
        setTripInfo(trip);
        setPrimaryBookerName(primary?.name ?? null);
        setGroupFlights(flights);
        setSelectedFlightId(primaryFlights[0]?.id ?? null);
        if (primaryFlights.length > 0) setFlightMode('same');
        setStep(1);
        return;
      }
      await setOnboardingProgress({ stage: 'invited_code', path: 'invited' }, user?.id);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    try {
      const result = await joinTripByCode(code.trim(), name);
      await clearPendingInviteCode(code.trim()).catch(() => {});
      setTripInfo(result.trip);
      const [flights, members] = await Promise.all([
        getFlights(result.tripId).catch(() => [] as Flight[]),
        getGroupMembers(result.tripId).catch(() => []),
      ]);
      const primary = members.find((member) => member.role === 'Primary');
      const primaryFlights = getPrimaryBookerFlights(flights, primary?.name);
      setPrimaryBookerName(primary?.name ?? null);
      setGroupFlights(flights);
      setSelectedFlightId(primaryFlights[0]?.id ?? null);
      if (primaryFlights.length > 0) setFlightMode('same');
      await setOnboardingProgress(
        {
          stage: 'invited_joined_needs_details',
          path: 'invited',
          tripId: result.tripId,
        },
        user?.id,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(1);
    } catch (e: any) {
      Alert.alert('Could not join', e?.message ?? 'Invalid or expired code');
    } finally {
      setJoining(false);
    }
  };

  if (step === 0) {
    return (
      <ScrollView contentContainerStyle={shared.scrollContent}>
        <BrandRow step={1} of={2} colors={colors} />
        <Header
          onBack={onBack}
          kicker="Invited — 1 of 2"
          title="Enter your invite code."
          sub="The trip organizer shared a 6-character code with you."
          colors={colors}
        />
        <View style={shared.section}>
          <FieldLabel label="Invite Code" colors={colors} />
          <Input
            value={code}
            onChange={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. A1B2C3"
            colors={colors}
            autoFocus
          />
          <PrimaryBtn onPress={handleJoin} disabled={code.trim().length < 4 || joining} colors={colors}>
            {joining ? (
              <ActivityIndicator color={colors.onBlack} size="small" />
            ) : (
              <>
                <Text style={[shared.primaryText, { color: code.trim().length < 4 ? colors.text3 : colors.onBlack }]}>
                  Join trip
                </Text>
                <ArrowRight size={14} color={code.trim().length < 4 ? colors.text3 : colors.onBlack} strokeWidth={2} />
              </>
            )}
          </PrimaryBtn>
        </View>
      </ScrollView>
    );
  }

  // Step 1 — show trip details + add flight
  const INFO_ROWS = tripInfo
    ? [
        { icon: Hotel, label: 'Hotel', val: tripInfo.accommodation || 'TBD' },
        { icon: MapPin, label: 'Destination', val: tripInfo.destination },
        {
          icon: Plane,
          label: 'Dates',
          val: `${formatDatePHT(tripInfo.startDate)} – ${formatDatePHT(tripInfo.endDate)}`,
        },
        { icon: Wifi, label: 'WiFi & house rules', val: 'Shared on arrival' },
      ]
    : [];

  return (
    <ScrollView contentContainerStyle={shared.scrollContent} keyboardShouldPersistTaps="handled">
      <BrandRow step={2} of={2} colors={colors} />
      <Header
        onBack={() => setStep(0)}
        kicker="Invited — 2 of 2"
        title="You're on the list."
        sub="Confirm what's shared, then add only your personal details."
        colors={colors}
      />
      <View style={shared.section}>
        {/* Trip card */}
        <View style={[shared.tripCard, { backgroundColor: colors.accentBg, borderColor: colors.accentBorder }]}>
          <Text style={[shared.tripCardLabel, { color: colors.accent }]}>SHARED TRIP</Text>
          <Text style={[shared.tripCardDest, { color: colors.text }]}>{tripInfo?.destination ?? ''}</Text>
          <Text style={[shared.tripCardDates, { color: colors.text2 }]}>
            {tripInfo ? `${formatDatePHT(tripInfo.startDate)} – ${formatDatePHT(tripInfo.endDate)}` : ''}
          </Text>
        </View>

        {/* Already set up */}
        <FieldLabel label="Already set up for you" colors={colors} />
        <View style={[shared.infoList, { borderColor: colors.border }]}>
          {INFO_ROWS.map((r, i) => (
            <View key={i} style={[shared.infoRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <r.icon size={16} color={colors.accent} strokeWidth={1.8} />
              <View style={{ flex: 1 }}>
                <Text style={[shared.infoLabel, { color: colors.text }]}>{r.label}</Text>
                <Text style={[shared.infoVal, { color: colors.text3 }]}>{r.val}</Text>
              </View>
              <CheckCircle size={14} color={colors.accent} strokeWidth={2} />
            </View>
          ))}
        </View>

        <FieldLabel label="Shared stay" colors={colors} />
        <View style={shared.bagRow}>
          {[
            { id: true, label: 'Same hotel / apartment' },
            { id: false, label: 'I have my own stay' },
          ].map((o) => (
            <TouchableOpacity
              key={String(o.id)}
              onPress={() => setSharesStay(o.id)}
              style={[
                shared.bagBtn,
                {
                  backgroundColor: sharesStay === o.id ? colors.accentBg : colors.card,
                  borderColor: sharesStay === o.id ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[shared.bagText, { color: sharesStay === o.id ? colors.accent : colors.text2 }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Flight */}
        <View style={{ height: 10 }} />
        <FieldLabel label="Flight details" colors={colors} />
        <View style={shared.bagRow}>
          {[
            ...(primaryBookerFlights.length > 0 ? [{ id: 'same' as const, label: 'Same as primary booker' }] : []),
            { id: 'different' as const, label: 'Different flight' },
            { id: 'later' as const, label: 'Add later' },
          ].map((o) => (
            <TouchableOpacity
              key={o.id}
              onPress={() => setFlightMode(o.id)}
              style={[
                shared.bagBtn,
                {
                  backgroundColor: flightMode === o.id ? colors.accentBg : colors.card,
                  borderColor: flightMode === o.id ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[shared.bagText, { color: flightMode === o.id ? colors.accent : colors.text2 }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {flightMode === 'same' && selectedGroupFlight && (
          <>
            <Text style={[shared.helperText, { color: colors.text3 }]}>
              Use the organizer's flight times and route, then add your own confirmation number or seat if you need it.
            </Text>
            <View style={shared.chipRow}>
              {primaryBookerFlights.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => setSelectedFlightId(f.id)}
                  style={[
                    shared.chip,
                    {
                      backgroundColor: selectedGroupFlight.id === f.id ? colors.accentBg : colors.card,
                      borderColor: selectedGroupFlight.id === f.id ? colors.accentBorder : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[shared.chipText, { color: selectedGroupFlight.id === f.id ? colors.accent : colors.text2 }]}
                  >
                    {f.direction} · {f.airline ? `${f.airline} ` : ''}
                    {f.flightNumber}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input
              value={bookingRef}
              onChange={setBookingRef}
              placeholder="Your confirmation number (optional)"
              colors={colors}
            />
            <Input value={seatNumber} onChange={setSeatNumber} placeholder="Seat number (optional)" colors={colors} />
          </>
        )}

        {flightMode === 'different' && (
          <>
            <View style={shared.chipRow}>
              {AIRLINES.map((a) => (
                <TouchableOpacity
                  key={a}
                  onPress={() => setAirline(a)}
                  style={[
                    shared.chip,
                    {
                      backgroundColor: airline === a ? colors.accentBg : colors.card,
                      borderColor: airline === a ? colors.accentBorder : colors.border,
                    },
                  ]}
                >
                  <Text style={[shared.chipText, { color: airline === a ? colors.accent : colors.text2 }]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input value={flightNum} onChange={setFlightNum} placeholder="5J 891" prefix="#" colors={colors} />
            <Input
              value={bookingRef}
              onChange={setBookingRef}
              placeholder="Confirmation number (optional)"
              colors={colors}
            />
            <Input value={seatNumber} onChange={setSeatNumber} placeholder="Seat number (optional)" colors={colors} />
          </>
        )}

        <FieldLabel label="Checked baggage" colors={colors} />
        <View style={shared.bagRow}>
          {[
            { id: true, label: 'Yes, checking bags' },
            { id: false, label: 'Carry-on only' },
          ].map((o) => (
            <TouchableOpacity
              key={String(o.id)}
              onPress={() => setCheckedBag(o.id)}
              style={[
                shared.bagBtn,
                {
                  backgroundColor: checkedBag === o.id ? colors.accentBg : colors.card,
                  borderColor: checkedBag === o.id ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[shared.bagText, { color: checkedBag === o.id ? colors.accent : colors.text2 }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryBtn
          onPress={() =>
            onDone({
              kind: 'invited',
              tripId: tripInfo?.id,
              sharesStay,
              flightMode,
              sharedFlight: selectedGroupFlight,
              sharedFlights: primaryBookerFlights,
              flightNum,
              airline,
              bookingRef,
              seatNumber,
              checkedBag,
            })
          }
          colors={colors}
        >
          <Text style={[shared.primaryText, { color: colors.onBlack }]}>Join the trip</Text>
          <ArrowRight size={14} color={colors.onBlack} strokeWidth={2} />
        </PrimaryBtn>
        <GhostBtn
          label="I'll add my flight later"
          onPress={() =>
            onDone({ kind: 'invited', tripId: tripInfo?.id, sharesStay, flightMode: 'later', skipped: true })
          }
        />
      </View>
    </ScrollView>
  );
}

// ── Root orchestrator ────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'traveler';

  const [path, setPath] = useState<Path>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await getOnboardingProgress(user?.id);
      if (cancelled || !progress || progress.status !== 'in_progress') return;
      if (progress.path) setPath(progress.path);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const choosePath = useCallback(
    (nextPath: Exclude<Path, null>) => {
      setPath(nextPath);
      const stage =
        nextPath === 'plan' ? 'planning_started' : nextPath === 'upload' ? 'upload_started' : 'invited_code';
      setOnboardingProgress({ stage, path: nextPath }, user?.id).catch(() => {});
    },
    [user?.id],
  );

  const backToPathPicker = useCallback(() => {
    setPath(null);
    setOnboardingProgress({ stage: 'path_picker', path: undefined }, user?.id).catch(() => {});
  }, [user?.id]);

  const finish = useCallback(
    async (payload: any) => {
      try {
        // Clear old cache before setting up new trip
        await cacheSet('trip:active', null);
        await cacheSet('trip:phase:override', null);

        if (payload.kind === 'plan') {
          const { startDate, endDate } = planDatesFromWhen(payload.when);
          await createTrip({
            name: `Trip to ${payload.dest}`,
            destination: payload.dest,
            startDate,
            endDate,
            transport: payload.transport === 'unknown' ? undefined : payload.transport || undefined,
            vibes: Array.isArray(payload.vibes) ? payload.vibes : undefined,
            members:
              payload.travelers > 1
                ? Array.from({ length: payload.travelers - 1 }, (_, i) => `Traveler ${i + 2}`)
                : undefined,
          });
        } else if (payload.kind === 'upload' && payload.scanned) {
          const s = payload.scanned;
          if (!s.destination || !s.startDate || !s.endDate) {
            Alert.alert(
              'Missing info',
              'Could not read destination or dates from your screenshots. Try again or plan manually.',
            );
            return;
          }
          const destination = s.destination?.trim();
          const startDate = s.startDate?.trim();
          const endDate = s.endDate?.trim();
          if (!destination || !startDate || !endDate) {
            Alert.alert(
              'Missing info',
              'Could not read destination or dates from your screenshots. Try again or plan manually.',
            );
            return;
          }
          const tripId = await withTimeout(
            createTrip({
              name: `Trip to ${s.destination}`,
              destination,
              startDate,
              endDate,
              members: s.members,
              accommodation: s.accommodation,
              address: s.address,
              checkIn: s.checkIn,
              checkOut: s.checkOut,
              roomType: s.roomType,
              bookingRef: s.bookingRef,
              cost: s.cost,
              costCurrency: s.costCurrency,
              transport: getUsableScannedFlights(s).length > 0 ? 'plane' : undefined,
            }),
            TRIP_SAVE_TIMEOUT_MS,
            'Creating trip timed out. Please check your connection and try again.',
          );
          // Save scanned flights in one replace operation so round-trip details
          // and rescan-safe column fallbacks are preserved.
          const scannedFlights = getUsableScannedFlights(s);
          if (scannedFlights.length > 0) {
            await withTimeout(
              replaceTripFlights(
                tripId,
                scannedFlights.map((f: any) => ({
                  direction: f.direction || 'Outbound',
                  flightNumber: f.flightNumber,
                  airline: f.airline,
                  fromCity: f.from,
                  toCity: f.to,
                  departTime: f.departTime,
                  arriveTime: f.arriveTime,
                  bookingRef: f.bookingRef,
                  passenger: f.passenger,
                })),
              ),
              FLIGHT_SAVE_TIMEOUT_MS,
              'Saving flights timed out. Please try again in a moment.',
            );
          }
          await clearOnboardingScanReview(user?.id);
        } else if (payload.kind === 'invited' && payload.tripId) {
          const stayNote = payload.sharesStay === false ? 'Own stay' : 'Same stay confirmed';
          const flightNote =
            payload.flightMode === 'same'
              ? `Same flight${Array.isArray(payload.sharedFlights) && payload.sharedFlights.length > 1 ? 's' : ''} as organizer${payload.seatNumber ? ` · seat ${payload.seatNumber}` : ''}`
              : payload.flightMode === 'different'
                ? `Different flight${payload.seatNumber ? ` · seat ${payload.seatNumber}` : ''}`
                : 'Flight later';
          await updateMyTripMemberPreferences(payload.tripId, {
            sharesAccommodation: payload.sharesStay !== false,
            travelNotes: [stayNote, flightNote].filter(Boolean).join(' · '),
          }).catch(() => {});

          if (payload.flightMode === 'same') {
            const sharedFlights =
              Array.isArray(payload.sharedFlights) && payload.sharedFlights.length > 0
                ? (payload.sharedFlights as Flight[])
                : payload.sharedFlight
                  ? [payload.sharedFlight as Flight]
                  : [];
            const failures: string[] = [];
            for (const sharedFlight of sharedFlights) {
              try {
                await addFlight({
                  tripId: payload.tripId,
                  direction: sharedFlight.direction,
                  flightNumber: sharedFlight.flightNumber,
                  airline: sharedFlight.airline || undefined,
                  fromCity: sharedFlight.from || undefined,
                  toCity: sharedFlight.to || undefined,
                  departTime: sharedFlight.departTime || undefined,
                  arriveTime: sharedFlight.arriveTime || undefined,
                  bookingRef: payload.bookingRef || undefined,
                  seatNumber: payload.seatNumber || undefined,
                  passenger: firstName,
                });
              } catch (error: any) {
                failures.push(error?.message ?? sharedFlight.flightNumber ?? 'Flight save failed');
              }
            }
            if (failures.length > 0) {
              Alert.alert(
                'Trip joined, but flight details need a retry',
                'Your shared stay choice was saved. We could not copy every flight detail, so add or rescan flights from the trip screen.',
              );
            }
          } else if (payload.flightMode === 'different' && payload.flightNum) {
            await addFlight({
              tripId: payload.tripId,
              direction: 'Outbound',
              flightNumber: payload.flightNum,
              airline: payload.airline || undefined,
              bookingRef: payload.bookingRef || undefined,
              seatNumber: payload.seatNumber || undefined,
              passenger: firstName,
            });
          }
        }

        await completeOnboarding(user?.id);
        if (user?.id) {
          await updateProfile(user.id, { onboardedAt: new Date().toISOString() }).catch(() => {});
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)/home' as never);
      } catch (e: any) {
        Alert.alert('Something went wrong', e?.message ?? 'Could not set up your trip. Please try again.');
      }
    },
    [firstName, router, user?.id],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {!path && (
          <PathPicker
            onPick={choosePath}
            onBack={() => router.back()}
            onSkip={() => {
              completeOnboarding(user?.id, true).catch(() => {});
              if (user?.id) updateProfile(user.id, { onboardedAt: new Date().toISOString() }).catch(() => {});
              router.replace('/(tabs)/home' as never);
            }}
            name={firstName}
            colors={colors}
          />
        )}
        {path === 'plan' && <PlanFlow onBack={backToPathPicker} onDone={finish} colors={colors} />}
        {path === 'upload' && <UploadFlow onBack={backToPathPicker} onDone={finish} colors={colors} />}
        {path === 'invited' && <InvitedFlow onBack={backToPathPicker} onDone={finish} colors={colors} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared styles ────────────────────────────────────────────────────

const shared = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },

  // Brand row
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 6 },
  brandText: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
  dots: { marginLeft: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { height: 6, borderRadius: 99 },

  // Header
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  backText: { fontSize: 12, fontWeight: '600' },
  kicker: { fontSize: 10, fontWeight: '600', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 28, lineHeight: 30, letterSpacing: -0.8, fontWeight: '500', marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 21, maxWidth: 320 },

  // Section
  section: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24, gap: 12 },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
  },
  primaryText: { fontSize: 14, fontWeight: '600', letterSpacing: -0.14 },
  ghostBtn: { paddingVertical: 13, alignItems: 'center' },
  ghostText: { fontSize: 13, fontWeight: '600' },

  // Fields
  fieldLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: -4 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
  },
  inputPrefix: { fontSize: 14, fontWeight: '600', paddingRight: 8, borderRightWidth: 1 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', letterSpacing: -0.15 },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: -4,
  },
  searchingText: { fontSize: 13, fontWeight: '600' },
  suggestionBox: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginTop: -4 },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '500' },

  // Path cards
  cards: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16, gap: 12 },
  pathCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18, borderWidth: 1 },
  pathIcon: { width: 64, height: 64, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pathKicker: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 3 },
  pathLabel: { fontSize: 17, lineHeight: 20, letterSpacing: -0.34, marginBottom: 4 },
  pathSub: { fontSize: 12, lineHeight: 17 },
  pathArrow: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { paddingHorizontal: 22, paddingBottom: 12, textAlign: 'center', fontSize: 11.5, lineHeight: 17 },
  helperText: { fontSize: 12, lineHeight: 17 },
  skipBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, marginBottom: 32 },
  skipText: { fontSize: 13, fontWeight: '500', letterSpacing: -0.1 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },

  // Vibes
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vibeCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  vibeEmoji: { fontSize: 22 },
  vibeLabel: { fontSize: 12.5, fontWeight: '600', letterSpacing: -0.12 },

  // Options (when/arrival)
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.13 },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepperValue: { fontSize: 13.5, fontWeight: '600' },
  stepperHint: { fontSize: 11, marginTop: 2 },
  stepperBtns: { flexDirection: 'row', gap: 8 },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footnote
  footnote: { marginTop: -4, fontSize: 11, textAlign: 'center', lineHeight: 16 },

  // Upload checklist
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  checkIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTitle: { fontSize: 13.5, fontWeight: '600', letterSpacing: -0.13 },
  checkSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  optionalTag: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },

  // Dropzone
  dropzone: { alignItems: 'center', padding: 22, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed' },
  dropzoneIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dropzoneTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.14 },
  dropzoneSub: { fontSize: 11.5, marginTop: 4 },

  // Scanning
  scanCircle: {
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  scanText: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  scanSub: { fontSize: 13, marginTop: 6 },
  scanProgressTrack: {
    width: '72%',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 22,
  },
  scanProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  scanPercent: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },

  // Trip card (invited)
  tripCard: { padding: 18, borderRadius: 18, borderWidth: 1, alignItems: 'center', gap: 4 },
  tripCardLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 4 },
  tripCardDest: { fontSize: 22, fontWeight: '500', letterSpacing: -0.44 },
  tripCardDates: { fontSize: 12.5 },

  // Info list (invited)
  infoList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontWeight: '600', letterSpacing: -0.13 },
  infoVal: { fontSize: 11.5, marginTop: 1 },

  // Baggage
  bagRow: { flexDirection: 'row', gap: 8 },
  bagBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  bagText: { fontSize: 12.5, fontWeight: '600', letterSpacing: -0.12 },
});
