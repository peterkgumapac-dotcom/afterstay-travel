import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Bookmark,
  Calendar,
  Camera,
  ChevronRight,
  Compass,
  FilePen,
  Globe,
  MapPin,
  Moon,
  Plus,
  TreePalm,
} from 'lucide-react-native';

import ProfileRow from './ProfileRow';
import QuickTripRow from '@/components/quick-trips/QuickTripRow';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { formatDatePHT } from '@/lib/utils';
import type { Moment, Place, Trip } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';
import type { LifetimeStats } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const COUNTRY_FLAGS: Record<string, string> = {
  JP: '\u{1F1EF}\u{1F1F5}', VN: '\u{1F1FB}\u{1F1F3}', PH: '\u{1F1F5}\u{1F1ED}',
  TH: '\u{1F1F9}\u{1F1ED}', SG: '\u{1F1F8}\u{1F1EC}', US: '\u{1F1FA}\u{1F1F8}',
  KR: '\u{1F1F0}\u{1F1F7}', ID: '\u{1F1EE}\u{1F1E9}',
};

interface ReturningUserHomeProps {
  userName: string;
  userHandle?: string;
  avatarUrl?: string;
  notificationCount: number;
  pastTrips: Trip[];
  draftTrips: Trip[];
  quickTrips: QuickTrip[];
  lifetimeStats: LifetimeStats | null;
  recentMoments?: Moment[];
  savedPlaces?: Place[];
  onPlanTrip: () => void;
  onTripPress: (tripId: string) => void;
  onDraftTripPress: (tripId: string) => void;
  onQuickTripPress: (id: string) => void;
  onAddQuickTrip: () => void;
  onAddMoment?: () => void;
  onBellPress: () => void;
  onSeeAllTrips: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function ReturningUserHome({
  userName,
  avatarUrl,
  notificationCount,
  pastTrips,
  draftTrips,
  quickTrips,
  lifetimeStats,
  recentMoments = [],
  savedPlaces = [],
  onPlanTrip,
  onTripPress,
  onDraftTripPress,
  onQuickTripPress,
  onAddQuickTrip,
  onAddMoment,
  onBellPress,
  onSeeAllTrips,
  refreshing = false,
  onRefresh,
}: ReturningUserHomeProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => getStyles(colors), [colors]);
  const firstName = userName.split(' ')[0] || 'Traveler';
  const recentTrips = pastTrips.slice(0, 3);
  const hasDrafts = draftTrips.length > 0;
  const hasUpcoming = draftTrips.some((t) => t.status === 'Planning');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ProfileRow
        userName={userName}
        avatarUrl={avatarUrl}
        notificationCount={notificationCount}
        onBellPress={onBellPress}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentLt} />
        ) : undefined}
      >
        {/* ── 1. WELCOME ── */}
        <Animated.View entering={FadeInDown.duration(400).springify()} style={s.welcomeSection}>
          <Text style={s.welcomeKicker}>WELCOME BACK</Text>
          <Text style={s.welcomeTitle}>What are you up to?</Text>
        </Animated.View>

        {/* ── 2. QUICK ACTIONS ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={s.actionsRow}>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={onAddMoment} activeOpacity={0.7}>
            <Camera size={18} color="#fff" />
            <Text style={s.actionBtnPrimaryText}>Quick{'\n'}Moments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.7}>
            <Compass size={16} color={colors.text} />
            <Text style={s.actionBtnText}>Browse{'\n'}Places</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={onPlanTrip} activeOpacity={0.7}>
            <TreePalm size={16} color={colors.text} />
            <Text style={s.actionBtnText}>Plan a{'\n'}Trip</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── 3. RECENT MOMENTS CAROUSEL ── */}
        {recentMoments.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>RECENT MOMENTS</Text>
              <TouchableOpacity onPress={onSeeAllTrips} style={s.seeAllBtn}>
                <Text style={s.seeAllText}>All</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.momentScroll}>
              {recentMoments.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={s.momentCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    const tripId = pastTrips[0]?.id;
                    if (tripId) onTripPress(tripId);
                  }}
                >
                  <Image source={{ uri: m.photo! }} style={s.momentImage} />
                  <View style={s.momentOverlay}>
                    <Text style={s.momentPlace} numberOfLines={1}>
                      {m.location || pastTrips[0]?.destination || ''}
                    </Text>
                    <Text style={s.momentDay}>
                      {formatDatePHT(m.date)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── 4. YOUR TRIPS ── */}
        {recentTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>YOUR TRIPS</Text>
              {pastTrips.length > 3 && (
                <TouchableOpacity onPress={onSeeAllTrips} style={s.seeAllBtn}>
                  <Text style={s.seeAllText}>Library</Text>
                  <ChevronRight size={14} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
            <View style={s.tripsList}>
              {recentTrips.map((t, idx) => {
                const nights = t.nights > 0 ? t.nights : (t.totalNights ?? 0);
                const flag = COUNTRY_FLAGS[t.countryCode ?? ''] ?? '\u{1F30D}';
                // Use first moment photo as fallback thumbnail
                const thumbUrl = t.heroImageUrl || (idx === 0 && recentMoments[0]?.photo) || undefined;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={s.tripCard}
                    onPress={() => onTripPress(t.id)}
                    activeOpacity={0.7}
                  >
                    {thumbUrl ? (
                      <Image source={{ uri: thumbUrl }} style={s.tripThumb} />
                    ) : (
                      <View style={[s.tripThumb, s.tripThumbFallback]}>
                        <Text style={s.tripThumbEmoji}>{flag}</Text>
                      </View>
                    )}
                    <View style={s.tripInfo}>
                      <Text style={s.tripDest} numberOfLines={1}>
                        {t.destination ?? t.name}
                        <Text style={s.tripCountry}> {t.country ?? ''}</Text>
                      </Text>
                      <Text style={s.tripMeta}>
                        {formatDatePHT(t.startDate)} {'\u2013'} {formatDatePHT(t.endDate)} {'\u00B7'} {nights} nights
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── 5. DRAFTS ── */}
        {hasDrafts && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>{`DRAFTS \u00B7 ${draftTrips.length}`}</Text>
            </View>
            <View style={s.tripsList}>
              {draftTrips.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={s.draftRow}
                  onPress={() => onDraftTripPress(t.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.draftIcon}>
                    <FilePen size={18} color={colors.accent} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.draftTitle} numberOfLines={1}>{t.destination ?? t.name}</Text>
                    <Text style={s.draftDates}>{formatDatePHT(t.startDate)} {'\u2013'} {formatDatePHT(t.endDate)}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.text3} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── 6. SAVED FOR NEXT TIME ── */}
        {savedPlaces.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>SAVED FOR NEXT TIME</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.savedScroll}>
              {savedPlaces.slice(0, 8).map((p) => (
                <View key={p.id} style={s.savedCard}>
                  <View style={s.savedCatRow}>
                    <Bookmark size={12} color={colors.accent} />
                    <View style={s.savedCatPill}>
                      <Text style={s.savedCatText}>{p.category}</Text>
                    </View>
                  </View>
                  <Text style={s.savedName} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.savedLocation} numberOfLines={1}>
                    {pastTrips[0]?.destination ?? ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── 7. NO UPCOMING TRIPS CTA ── */}
        {!hasUpcoming && (
          <Animated.View entering={FadeInDown.delay(280).duration(400)} style={s.ctaCard}>
            <Calendar size={28} color={colors.text3} strokeWidth={1.5} />
            <Text style={s.ctaTitle}>No upcoming trips</Text>
            <Text style={s.ctaSub}>The next adventure starts with an idea.</Text>
            <TouchableOpacity style={s.ctaBtn} onPress={onPlanTrip} activeOpacity={0.7}>
              <TreePalm size={16} color="#fff" />
              <Text style={s.ctaBtnText}>Start Planning</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: spacing.lg },

    // Welcome
    welcomeSection: { paddingTop: spacing.xl, marginBottom: spacing.lg },
    welcomeKicker: {
      fontSize: 10, fontWeight: '600', color: colors.text3,
      letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4,
    },
    welcomeTitle: {
      fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5,
    },

    // Quick actions
    actionsRow: {
      flexDirection: 'row', gap: 10, marginBottom: 24,
    },
    actionBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 16, borderRadius: 16,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    },
    actionBtnPrimary: {
      backgroundColor: colors.accent, borderColor: colors.accent,
    },
    actionBtnText: {
      fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center', lineHeight: 16,
    },
    actionBtnPrimaryText: {
      fontSize: 12, fontWeight: '600', color: '#fff', textAlign: 'center', lineHeight: 16,
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionKicker: {
      fontSize: 10, fontWeight: '700', color: colors.text3,
      letterSpacing: 1.4, textTransform: 'uppercase',
    },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    seeAllText: { fontSize: 13, fontWeight: '600', color: colors.accent },

    // Moments carousel
    momentScroll: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, marginBottom: 24 },
    momentCard: {
      width: 140, height: 180, borderRadius: 16, overflow: 'hidden', marginRight: 10,
    },
    momentImage: { width: '100%', height: '100%' },
    momentOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 10, paddingVertical: 8,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    momentPlace: { fontSize: 12, fontWeight: '700', color: '#fff' },
    momentDay: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

    // Trips
    tripsList: { gap: 8, marginBottom: 24 },
    tripCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 14,
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    tripThumb: { width: 48, height: 48, borderRadius: 14 },
    tripThumbFallback: {
      backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center',
    },
    tripThumbEmoji: { fontSize: 22 },
    tripInfo: { flex: 1, minWidth: 0 },
    tripDest: { fontSize: 15, fontWeight: '700', color: colors.text },
    tripCountry: { fontSize: 13, fontWeight: '400', color: colors.text3 },
    tripMeta: { fontSize: 11, color: colors.text3, marginTop: 2 },

    // Drafts
    draftRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 14,
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.accentBorder, borderStyle: 'dashed',
    },
    draftIcon: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentBg,
      alignItems: 'center', justifyContent: 'center',
    },
    draftTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    draftDates: { fontSize: 11, color: colors.text3, marginTop: 2 },

    // Saved places
    savedScroll: { marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, marginBottom: 24 },
    savedCard: {
      width: 160, paddingVertical: 14, paddingHorizontal: 14,
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, marginRight: 10,
    },
    savedCatRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    savedCatPill: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.card2,
    },
    savedCatText: { fontSize: 10, fontWeight: '600', color: colors.text3 },
    savedName: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 2 },
    savedLocation: { fontSize: 11, color: colors.text3 },

    // No upcoming CTA
    ctaCard: {
      alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24,
      borderRadius: 18, borderWidth: 1.5, borderColor: colors.accentBorder,
      borderStyle: 'dashed', marginBottom: 24,
    },
    ctaTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    ctaSub: { fontSize: 13, color: colors.text3, marginTop: 4, textAlign: 'center' },
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14,
      backgroundColor: colors.accent, marginTop: 16,
    },
    ctaBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
