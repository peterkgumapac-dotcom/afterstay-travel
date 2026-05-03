import { useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Alert,
  Dimensions,
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
  Moon,
  Plus,
  TreePalm,
  X,
} from 'lucide-react-native';

import ProfileRow from './ProfileRow';
import { TripCollage } from '@/components/trip/TripCollage';
import { AnimatedPressable } from '@/components/shared/AnimatedPressable';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { archiveTrip, discardDraftTrip, softDeleteTrip } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { GroupMember, Moment, Place, Trip } from '@/lib/types';
import type { QuickTrip } from '@/lib/quickTripTypes';
import type { LifetimeStats } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const { width: SCREEN_W } = Dimensions.get('window');
const ALBUM_W = SCREEN_W - 56;
const ALBUM_H = Math.round(ALBUM_W * 0.65);
const HOME_TRIP_ALBUM_LIMIT = 3;
const HOME_QUICK_TRIP_ALBUM_LIMIT = 2;
const HOME_COLLAGE_PHOTO_LIMIT = 6;

const COUNTRY_FLAGS: Record<string, string> = {
  JP: '\u{1F1EF}\u{1F1F5}', VN: '\u{1F1FB}\u{1F1F3}', PH: '\u{1F1F5}\u{1F1ED}',
  TH: '\u{1F1F9}\u{1F1ED}', SG: '\u{1F1F8}\u{1F1EC}', US: '\u{1F1FA}\u{1F1F8}',
  KR: '\u{1F1F0}\u{1F1F7}', ID: '\u{1F1EE}\u{1F1E9}',
};

interface ReturningUserHomeProps {
  userName: string;
  userId?: string;
  userHandle?: string;
  avatarUrl?: string;
  notificationCount: number;
  pastTrips: Trip[];
  draftTrips: Trip[];
  upcomingTrips?: Trip[];
  activeTrips?: Trip[];
  quickTrips: QuickTrip[];
  lifetimeStats: LifetimeStats | null;
  recentMoments?: Moment[];
  recentMembers?: GroupMember[];
  savedPlaces?: Place[];
  onPlanTrip: () => void;
  onTripPress: (tripId: string) => void;
  onDraftTripPress: (tripId: string) => void;
  onUpcomingTripPress?: (tripId: string) => void;
  onArchiveDraft?: (tripId: string) => void;
  onQuickTripPress: (id: string) => void;
  onAddQuickTrip: () => void;
  onAddMoment?: () => void;
  onBellPress: () => void;
  onSeeAllTrips: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** True when stale data is being revalidated in the background. */
  isStale?: boolean;
  /** Daily tracker strip rendered from home.tsx */
  dailyTrackerSlot?: React.ReactNode;
}

export default function ReturningUserHome({
  userName,
  userId,
  avatarUrl,
  notificationCount,
  pastTrips,
  draftTrips,
  upcomingTrips = [],
  activeTrips = [],
  quickTrips,
  savedPlaces = [],
  onPlanTrip,
  onTripPress,
  onDraftTripPress,
  onUpcomingTripPress,
  onArchiveDraft,
  onQuickTripPress,
  onAddMoment,
  onBellPress,
  onSeeAllTrips,
  refreshing = false,
  onRefresh,
  isStale = false,
  dailyTrackerSlot,
}: ReturningUserHomeProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const s = useMemo(() => getStyles(colors), [colors]);
  const hasDrafts = draftTrips.length > 0;
  const hasUpcoming = activeTrips.length > 0 || upcomingTrips.length > 0 || draftTrips.some((t) => t.status === 'Planning');

  // All trips combined for the album strip (active first, then upcoming, then past)
  const allRecentTrips = useMemo(() => {
    const all = [
      ...activeTrips,
      ...upcomingTrips,
      ...pastTrips,
    ].filter((t) => !t.deletedAt && !t.isDraft);
    // Dedupe by id
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [activeTrips, upcomingTrips, pastTrips]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ProfileRow
        userName={userName}
        userId={userId}
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
        {/* Stale-while-revalidate indicator */}
        {isStale && !refreshing && (
          <View style={s.staleBar}>
            <Text style={s.staleText}>Updating…</Text>
          </View>
        )}
        {/* ── 1. WELCOME ── */}
        <Animated.View entering={FadeInDown.duration(350)} style={s.welcomeSection}>
          <Text style={s.welcomeKicker}>WELCOME BACK</Text>
          <Text style={s.welcomeTitle}>What are you up to?</Text>
        </Animated.View>

        {/* ── 1b. RESUME DRAFT NUDGE ── */}
        {draftTrips.length > 0 && (() => {
          const draft = draftTrips[0];
          return (
            <Animated.View entering={FadeInDown.delay(60).duration(400)} style={s.resumeCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.resumeTitle}>Continue planning?</Text>
                <Text style={s.resumeDest} numberOfLines={1}>
                  {draft.destination ?? draft.name}
                </Text>
              </View>
              <View style={s.resumeBtns}>
                <TouchableOpacity
                  style={s.resumeBtn}
                  onPress={() => onDraftTripPress(draft.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.resumeBtnText}>Resume</Text>
                </TouchableOpacity>
                {draft.isDraft ? (
                  <TouchableOpacity
                    style={s.discardBtn}
                    onPress={async () => {
                      try {
                        await discardDraftTrip(draft.id);
                        onRefresh?.();
                      } catch {
                        Alert.alert('Error', 'Something went wrong. Please try again.');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.discardBtnText}>Discard</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.discardBtn}
                    onPress={async () => {
                      try {
                        if (onArchiveDraft) {
                          onArchiveDraft(draft.id);
                        } else {
                          await archiveTrip(draft.id);
                          onRefresh?.();
                        }
                      } catch {
                        Alert.alert('Error', 'Something went wrong. Please try again.');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.discardBtnText}>Archive</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          );
        })()}

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
          {hasDrafts ? (
            <TouchableOpacity
              style={[s.actionBtn, s.actionBtnAccent]}
              onPress={() => onDraftTripPress(draftTrips[0].id)}
              activeOpacity={0.7}
            >
              <TreePalm size={16} color={colors.accent} />
              <Text style={s.actionBtnAccentText}>Continue{'\n'}Planning</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.actionBtn} onPress={onPlanTrip} activeOpacity={0.7}>
              <TreePalm size={16} color={colors.text} />
              <Text style={s.actionBtnText}>Plan a{'\n'}Trip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/join-trip' as never)} activeOpacity={0.7}>
            <Plus size={16} color={colors.text} />
            <Text style={s.actionBtnText}>Join a{'\n'}Trip</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── 2b. DAILY TRACKER ── */}
        {dailyTrackerSlot}

        {/* ── 2c. PLANNING-ONLY HERO ── */}
        {allRecentTrips.length === 0 && quickTrips.length === 0 && draftTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)} style={s.planningHero}>
            <Text style={s.planningEmoji}>{'\u{2708}\u{FE0F}'}</Text>
            <Text style={s.planningTitle}>Your first trip is taking shape</Text>
            <Text style={s.planningSub}>
              Finish planning to unlock budget tracking, packing lists, and group coordination.
            </Text>
          </Animated.View>
        )}

        {/* ── 3. RECENT TRIPS ── */}
        {allRecentTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>{`MY TRIPS \u00B7 ${allRecentTrips.length}`}</Text>
              <TouchableOpacity onPress={onSeeAllTrips} style={s.seeAllBtn}>
                <Text style={s.seeAllText}>All</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.albumScroll} contentContainerStyle={s.albumScrollContent}>
              {allRecentTrips.slice(0, HOME_TRIP_ALBUM_LIMIT).map((t) => {
                const nights = t.nights > 0 ? t.nights : (t.totalNights ?? 0);
                return (
                  <AnimatedPressable
                    key={t.id}
                    style={s.albumCard}
                    onPress={() => onTripPress(t.id)}
                    onLongPress={() => {
                      Alert.alert(
                        t.destination ?? t.name ?? 'Trip',
                        'What would you like to do?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Archive',
                            onPress: async () => {
                              try { await archiveTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
                            },
                          },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try { await softDeleteTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <TripCollage
                      tripId={t.id}
                      width={ALBUM_W}
                      height={ALBUM_H}
                      animated={false}
                      maxPhotos={HOME_COLLAGE_PHOTO_LIMIT}
                    />
                    <View style={s.albumOverlay} />
                    {t.status === 'Active' && <View style={[s.albumDot, { backgroundColor: colors.success }]} />}
                    {t.isDraft && <View style={s.albumBadge}><Text style={s.albumBadgeText}>Draft</Text></View>}
                    <View style={s.albumInfo}>
                      <Text style={s.albumDest} numberOfLines={1}>{t.destination ?? t.name}</Text>
                      <Text style={s.albumDates} numberOfLines={1}>
                        {formatDatePHT(t.startDate)} {'\u2013'} {formatDatePHT(t.endDate)}
                      </Text>
                      {nights > 0 && (
                        <View style={s.albumMetaRow}>
                          <Moon size={10} color="rgba(255,255,255,0.7)" />
                          <Text style={s.albumMetaText}>{nights}n</Text>
                        </View>
                      )}
                    </View>
                  </AnimatedPressable>
                );
              })}
              {/* Quick trips inline with a badge */}
              {quickTrips.slice(0, HOME_QUICK_TRIP_ALBUM_LIMIT).map((qt) => (
                <AnimatedPressable
                  key={`qt-${qt.id}`}
                  style={s.albumCard}
                  onPress={() => onQuickTripPress(qt.id)}
                  onLongPress={() => {
                    Alert.alert(
                      qt.placeName || qt.title || 'Quick Trip',
                      'What would you like to do?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => onQuickTripPress(qt.id),
                        },
                      ],
                    );
                  }}
                >
                  <TripCollage
                    quickTripId={qt.id}
                    width={ALBUM_W}
                    height={ALBUM_H}
                    animated={false}
                    maxPhotos={HOME_COLLAGE_PHOTO_LIMIT}
                  />
                  <View style={s.albumOverlay} />
                  <View style={s.albumBadge}><Text style={s.albumBadgeText}>Quick Trip</Text></View>
                  <View style={s.albumInfo}>
                    <Text style={s.albumDest} numberOfLines={1}>{qt.placeName || qt.title}</Text>
                    <Text style={s.albumDates} numberOfLines={1}>
                      {formatDatePHT(qt.createdAt)}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── 4. UPCOMING TRIPS ── */}
        {upcomingTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>{`UPCOMING \u00B7 ${upcomingTrips.length}`}</Text>
              <TouchableOpacity onPress={onSeeAllTrips} style={s.seeAllBtn}>
                <Text style={s.seeAllText}>My Trips</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View style={s.tripsList}>
              {upcomingTrips.slice(0, 3).map((t) => {
                const nights = t.nights > 0 ? t.nights : (t.totalNights ?? 0);
                const flag = COUNTRY_FLAGS[t.countryCode ?? ''];
                return (
                  <Pressable
                    key={t.id}
                    style={s.tripCard}
                    onPress={() => onUpcomingTripPress?.(t.id)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Alert.alert(
                        t.destination ?? t.name ?? 'Trip',
                        'What would you like to do?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Archive',
                            onPress: async () => {
                              try { await archiveTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
                            },
                          },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try { await softDeleteTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
                            },
                          },
                        ],
                      );
                    }}
                    delayLongPress={400}
                  >
                    <View style={[s.tripThumb, s.tripThumbFallback]}>
                      {flag ? (
                        <Text style={s.tripThumbEmoji}>{flag}</Text>
                      ) : (
                        <Globe size={20} color={colors.text3} />
                      )}
                    </View>
                    <View style={s.tripInfo}>
                      <Text style={s.tripDest} numberOfLines={1}>
                        {t.destination ?? t.name}
                      </Text>
                      <Text style={s.tripMeta}>
                        {formatDatePHT(t.startDate)} {'\u2013'} {formatDatePHT(t.endDate)} {'\u00B7'} {nights} nights
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Alert.alert(
                          t.destination ?? t.name ?? 'Trip',
                          'What would you like to do?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Archive', onPress: async () => { try { await archiveTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); } } },
                            { text: 'Delete', style: 'destructive', onPress: async () => { try { await softDeleteTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); } } },
                          ],
                        );
                      }}
                      hitSlop={10}
                      style={s.tripDeleteBtn}
                    >
                      <X size={16} color={colors.text3} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── 4b. ACTIVE TRIPS ── */}
        {activeTrips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(170).duration(400)}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionKicker}>{`ACTIVE \u00B7 ${activeTrips.length}`}</Text>
              <TouchableOpacity onPress={onSeeAllTrips} style={s.seeAllBtn}>
                <Text style={s.seeAllText}>My Trips</Text>
                <ChevronRight size={14} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View style={s.tripsList}>
              {activeTrips.slice(0, 3).map((t) => {
                const nights = t.nights > 0 ? t.nights : (t.totalNights ?? 0);
                const flag = COUNTRY_FLAGS[t.countryCode ?? ''];
                return (
                  <Pressable
                    key={t.id}
                    style={[s.tripCard, { borderColor: colors.accentBorder }]}
                    onPress={() => onUpcomingTripPress?.(t.id)}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      Alert.alert(
                        t.destination ?? t.name ?? 'Trip',
                        'What would you like to do?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Archive',
                            onPress: async () => {
                              try { await archiveTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
                            },
                          },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try { await softDeleteTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); }
                            },
                          },
                        ],
                      );
                    }}
                    delayLongPress={400}
                  >
                    <View style={[s.tripThumb, s.tripThumbFallback, { backgroundColor: colors.accentBg }]}>
                      {flag ? (
                        <Text style={s.tripThumbEmoji}>{flag}</Text>
                      ) : (
                        <Globe size={20} color={colors.accent} />
                      )}
                    </View>
                    <View style={s.tripInfo}>
                      <Text style={[s.tripDest, { color: colors.accent }]} numberOfLines={1}>
                        {t.destination ?? t.name}
                      </Text>
                      <Text style={s.tripMeta}>
                        {formatDatePHT(t.startDate)} {'\u2013'} {formatDatePHT(t.endDate)} {'\u00B7'} {nights} nights
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Alert.alert(
                          t.destination ?? t.name ?? 'Trip',
                          'What would you like to do?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Archive', onPress: async () => { try { await archiveTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); } } },
                            { text: 'Delete', style: 'destructive', onPress: async () => { try { await softDeleteTrip(t.id); onRefresh?.(); } catch { Alert.alert('Error', 'Something went wrong. Please try again.'); } } },
                          ],
                        );
                      }}
                      hitSlop={10}
                      style={s.tripDeleteBtn}
                    >
                      <X size={16} color={colors.text3} />
                    </Pressable>
                  </Pressable>
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
                  onLongPress={() => {
                    Alert.alert(
                      t.destination ?? t.name ?? 'Draft trip',
                      'What would you like to do with this draft?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Archive',
                          onPress: async () => {
                            try {
                              await archiveTrip(t.id);
                              onRefresh?.();
                            } catch {
                              Alert.alert('Error', 'Something went wrong. Please try again.');
                            }
                          },
                        },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await discardDraftTrip(t.id);
                              onRefresh?.();
                            } catch {
                              Alert.alert('Error', 'Something went wrong. Please try again.');
                            }
                          },
                        },
                      ],
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <View style={s.draftIcon}>
                    <FilePen size={18} color={colors.accent} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.draftTitle} numberOfLines={1}>{t.destination ?? t.name}</Text>
                    <Text style={s.draftDates}>{formatDatePHT(t.startDate)} {'\u2013'} {formatDatePHT(t.endDate)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Delete draft?',
                        'This draft trip will be permanently removed.',
                        [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await discardDraftTrip(t.id);
                                onRefresh?.();
                              } catch {
                                Alert.alert('Error', 'Something went wrong. Please try again.');
                              }
                            },
                          },
                        ],
                      );
                    }}
                    hitSlop={8}
                    style={s.draftDeleteBtn}
                  >
                    <X size={16} color={colors.text3} />
                  </TouchableOpacity>
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
        {!hasUpcoming && allRecentTrips.length === 0 && quickTrips.length === 0 && (
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

    // Stale-while-revalidate indicator
    staleBar: {
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
    },
    staleText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
    },

    // Welcome
    welcomeSection: { paddingTop: spacing.xl, marginBottom: spacing.lg },
    welcomeKicker: {
      fontSize: 10, fontWeight: '600', color: colors.text3,
      letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 4,
    },
    welcomeTitle: {
      fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5,
    },

    // Resume draft nudge
    resumeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      marginBottom: 16,
      backgroundColor: colors.accentBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    resumeTitle: {
      fontSize: 14, fontWeight: '700', color: colors.accent, marginBottom: 2,
    },
    resumeDest: {
      fontSize: 13, color: colors.text2,
    },
    planningHero: {
      marginHorizontal: 16, padding: 20, borderRadius: 16,
      backgroundColor: colors.accentBg, borderWidth: 1, borderColor: colors.accentBorder,
      alignItems: 'center', gap: 8,
    },
    planningEmoji: { fontSize: 32 },
    planningTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
    planningSub: { fontSize: 13, color: colors.text2, textAlign: 'center', lineHeight: 19 },
    resumeBtns: {
      flexDirection: 'row', gap: 8,
    },
    resumeBtn: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12,
      backgroundColor: colors.accent,
    },
    resumeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    discardBtn: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
    },
    discardBtnText: { fontSize: 13, fontWeight: '600', color: colors.text3 },

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
    actionBtnAccent: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    actionBtnAccentText: {
      fontSize: 12, fontWeight: '600', color: colors.accent, textAlign: 'center', lineHeight: 16,
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
    sectionAction: {
      fontSize: 12, fontWeight: '600', color: colors.accent,
    },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    seeAllText: { fontSize: 13, fontWeight: '600', color: colors.accent },

    // Trip album cards
    albumScroll: { marginHorizontal: -spacing.lg, marginBottom: 24 },
    albumScrollContent: { paddingHorizontal: spacing.lg, gap: 10 },
    albumCard: {
      width: ALBUM_W, height: ALBUM_H, borderRadius: 16, overflow: 'hidden',
      backgroundColor: colors.card,
    },
    albumCardBg: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
    },
    albumOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    albumDot: {
      position: 'absolute', top: 10, right: 10,
      width: 8, height: 8, borderRadius: 4,
      borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)',
    },
    albumBadge: {
      position: 'absolute', top: 10, left: 10,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    albumBadgeText: {
      fontSize: 9, fontWeight: '700', color: '#fff',
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    albumInfo: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: 12, backgroundColor: 'rgba(0,0,0,0.4)',
    },
    albumDest: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
    albumDates: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    albumMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    albumMetaText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

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
    tripDeleteBtn: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: colors.card2, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },

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
    draftDeleteBtn: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center' as const, justifyContent: 'center' as const,
      marginLeft: 4,
    },

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
