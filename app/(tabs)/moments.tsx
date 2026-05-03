import { useRouter } from 'expo-router';
import { ChevronDown, Zap } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentsTab } from '@/components/moments/MomentsTab';
import { BentoLayout } from '@/components/moments/BentoLayout';
import { PhotoCarousel } from '@/components/moments/PhotoCarousel';
import type { MomentDisplay } from '@/components/moments/types';
import { useTheme } from '@/constants/ThemeContext';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { getAllTripsPromise, getAllTripsCached } from '@/hooks/useTrips';
import { getQuickTrips, getQuickTripPhotos } from '@/lib/quickTrips';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';
import type { QuickTrip, QuickTripPhoto } from '@/lib/quickTripTypes';
import { TabErrorBoundary } from '@/components/shared/TabErrorBoundary';
const ExploreMomentsFeed = React.lazy(() => import('@/components/discover/ExploreMomentsFeed'));

type ThemeColors = ReturnType<typeof useTheme>['colors'];
const TAB_LOAD_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), TAB_LOAD_TIMEOUT_MS);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, () => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export default function MomentsScreenWithBoundary() {
  return (
    <TabErrorBoundary name="Moments">
      <MomentsScreen />
    </TabErrorBoundary>
  );
}

function MomentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { activeTrip: segActiveTrip, pastTrips: segPastTrips, isTestMode } = useUserSegment();
  const [extraActiveTrip, setExtraActiveTrip] = useState<Trip | null>(null);
  const [extraPastTrips, setExtraPastTrips] = useState<Trip[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(!isTestMode);
  const activeTrip = segActiveTrip ?? extraActiveTrip;
  const pastTrips = segPastTrips.length > 0 ? segPastTrips : extraPastTrips;

  const [quickTrips, setQuickTrips] = useState<QuickTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<'trip' | 'quick'>('trip');
  const [showPicker, setShowPicker] = useState(false);

  // Quick trip photo state
  const [qtPhotos, setQtPhotos] = useState<QuickTripPhoto[]>([]);
  const [qtCarouselVisible, setQtCarouselVisible] = useState(false);
  const [qtCarouselIndex, setQtCarouselIndex] = useState(0);

  // Fetch trips + quick trips. Moments cannot rely only on UserSegmentContext here,
  // because brand-new accounts often hydrate trip state a beat later than the tab.
  useEffect(() => {
    if (isTestMode) {
      setLoadingTrips(false);
      return;
    }
    let cancelled = false;

    const applyTrips = (all: Trip[]) => {
      const visible = all.filter((tr) => !tr.deletedAt && !tr.archivedAt);
      const active = visible.find((tr) => !tr.isDraft && (tr.status === 'Active' || tr.status === 'Planning')) ?? null;
      const completed = visible.filter((tr) => tr.status === 'Completed');
      if (cancelled) return;
      setExtraActiveTrip(active);
      setExtraPastTrips(completed);
      if (!segActiveTrip && active) {
        setSelectedTripId((prev) => prev ?? active.id);
        setSelectedType('trip');
      } else if (completed.length > 0) {
        setSelectedTripId((prev) => prev ?? completed[0].id);
        setSelectedType('trip');
      }
    };

    const cachedAll = getAllTripsCached();
    if (cachedAll) {
      applyTrips(cachedAll);
    } else {
      setLoadingTrips(true);
    }

    withTimeout(getAllTripsPromise(true), [] as Trip[])
      .then((trips) => {
        applyTrips(trips);
        if (!cancelled) setLoadingTrips(false);
      }, () => {
        if (!cancelled) setLoadingTrips(false);
      });

    // Always fetch quick trips
    withTimeout(getQuickTrips(), [] as QuickTrip[])
      .then((trips) => { if (!cancelled) setQuickTrips(trips); })

    return () => { cancelled = true; };
  }, [isTestMode, segActiveTrip]);

  useEffect(() => {
    if (activeTrip) {
      setSelectedTripId(activeTrip.id);
      setSelectedType('trip');
    } else if (pastTrips.length > 0) {
      setSelectedTripId((prev) => prev ?? pastTrips[0].id);
      setSelectedType('trip');
    }
  }, [activeTrip, pastTrips]);

  // Fetch photos when a quick trip is selected
  useEffect(() => {
    if (selectedType === 'quick' && selectedTripId) {
      getQuickTripPhotos(selectedTripId).then(setQtPhotos).catch(() => setQtPhotos([]));
    }
  }, [selectedType, selectedTripId]);

  const selectedTrip = useMemo(() => {
    if (selectedType === 'quick') {
      return quickTrips.find((qt) => qt.id === selectedTripId);
    }
    if (activeTrip && selectedTripId === activeTrip.id) return activeTrip;
    return pastTrips.find((t) => t.id === selectedTripId);
  }, [activeTrip, pastTrips, quickTrips, selectedTripId, selectedType]);

  const selectedLabel = selectedType === 'quick'
    ? (selectedTrip as QuickTrip | undefined)?.title ?? 'Select trip'
    : (selectedTrip as Trip | undefined)?.destination ?? (selectedTrip as Trip | undefined)?.name ?? 'Select trip';

  const selectedDates = selectedType === 'quick'
    ? (selectedTrip as QuickTrip | undefined)?.occurredAt ? formatDatePHT((selectedTrip as QuickTrip).occurredAt) : ''
    : selectedTrip ? `${formatDatePHT((selectedTrip as Trip).startDate)} – ${formatDatePHT((selectedTrip as Trip).endDate)}` : '';

  const hasPicker = activeTrip === null && (pastTrips.length > 0 || quickTrips.length > 0);
  const waitingForTrips = loadingTrips && activeTrip === null && pastTrips.length === 0 && quickTrips.length === 0;
  const hasAny = activeTrip !== null || pastTrips.length > 0 || quickTrips.length > 0;

  // Quick trip moment displays for BentoLayout
  const qtMomentDisplays: MomentDisplay[] = useMemo(() =>
    qtPhotos.map((p) => ({
      id: p.id,
      photo: p.photoUrl,
      caption: '',
      date: p.exifTakenAt ?? (selectedTrip as QuickTrip | undefined)?.occurredAt ?? '',
      location: (selectedTrip as QuickTrip | undefined)?.placeName ?? '',
      tags: [],
      visibility: 'shared' as const,
    })),
    [qtPhotos, selectedTrip],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Moments</Text>
      </View>

      {/* Trip picker */}
      <>
      {hasPicker && (
        <View style={styles.pickerWrap}>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowPicker(!showPicker)}
            activeOpacity={0.7}
          >
            {selectedType === 'quick' && <Zap size={14} color={colors.accent} />}
            <Text style={styles.pickerLabel} numberOfLines={1}>{selectedLabel}</Text>
            <Text style={styles.pickerDates}>{selectedDates}</Text>
            <ChevronDown size={16} color={colors.text3} />
          </TouchableOpacity>

          {showPicker && (
            <View style={styles.pickerDropdown}>
              {/* Regular trips */}
              {pastTrips.length > 0 && (
                <View style={styles.pickerSection}>
                  <Text style={styles.pickerSectionLabel}>TRIPS</Text>
                </View>
              )}
              {pastTrips.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerRow, t.id === selectedTripId && selectedType === 'trip' && styles.pickerRowActive]}
                  onPress={() => {
                    setSelectedTripId(t.id);
                    setSelectedType('trip');
                    setShowPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerRowText, t.id === selectedTripId && selectedType === 'trip' && styles.pickerRowTextActive]}>
                    {t.destination ?? t.name}
                  </Text>
                  <Text style={styles.pickerRowDates}>
                    {formatDatePHT(t.startDate)} – {formatDatePHT(t.endDate)}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Quick trips */}
              {quickTrips.length > 0 && (
                <View style={styles.pickerSection}>
                  <Zap size={10} color={colors.accent} />
                  <Text style={styles.pickerSectionLabel}>QUICK TRIPS</Text>
                </View>
              )}
              {quickTrips.map((qt) => (
                <TouchableOpacity
                  key={qt.id}
                  style={[styles.pickerRow, qt.id === selectedTripId && selectedType === 'quick' && styles.pickerRowActive]}
                  onPress={() => {
                    setSelectedTripId(qt.id);
                    setSelectedType('quick');
                    setShowPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerRowText, qt.id === selectedTripId && selectedType === 'quick' && styles.pickerRowTextActive]}>
                    {qt.title}
                  </Text>
                  <Text style={styles.pickerRowDates}>
                    {formatDatePHT(qt.occurredAt)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {waitingForTrips && (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading your memories...</Text>
        </View>
      )}

      {/* No trips — inspiration + explore feed */}
      {!waitingForTrips && !hasAny && (
        <View style={{ flex: 1 }}>
          {/* Inspiration CTA */}
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Your travel memories start here</Text>
            <Text style={styles.emptyText}>
              Plan a trip to start building your photo gallery, or browse what other travelers are sharing.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.accent, borderRadius: 12 }}
                onPress={() => router.push('/onboarding')}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Plan a Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                onPress={() => router.push('/quick-trip-create' as never)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Quick Trip</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Explore feed — see what others are sharing */}
          <View style={{ flex: 1, marginTop: 8 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3 }}>
                EXPLORE
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                See what travelers are sharing
              </Text>
            </View>
            <React.Suspense fallback={<View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: colors.text3 }}>Loading...</Text></View>}>
              <ExploreMomentsFeed />
            </React.Suspense>
          </View>
        </View>
      )}

      {/* Regular trip moments */}
      {selectedTripId && selectedType === 'trip' && <MomentsTab tripId={selectedTripId} />}

      {/* Quick trip photo album */}
      {selectedTripId && selectedType === 'quick' && (
        <View style={{ flex: 1 }}>
          {qtMomentDisplays.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No photos in this quick trip</Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
              <BentoLayout
                items={qtMomentDisplays}
                onOpen={(m) => {
                  const idx = qtMomentDisplays.findIndex((d) => d.id === m.id);
                  setQtCarouselIndex(idx >= 0 ? idx : 0);
                  setQtCarouselVisible(true);
                }}
                selectedIds={new Set()}
                onToggleSelect={() => {}}
                selectMode={false}
                onLongPress={() => {}}
              />
            </ScrollView>
          )}

          <Modal
            visible={qtCarouselVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setQtCarouselVisible(false)}
          >
            <PhotoCarousel
              moments={qtMomentDisplays}
              initialIndex={qtCarouselIndex}
              people={{}}
              onClose={() => setQtCarouselVisible(false)}
            />
          </Modal>
        </View>
      )}
      </>
    </View>
  );
}


const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    // Trip picker
    pickerWrap: {
      paddingHorizontal: 16, marginBottom: 8, zIndex: 10,
    },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    pickerLabel: {
      flex: 1, fontSize: 14, fontWeight: '600', color: colors.text,
    },
    pickerDates: {
      fontSize: 11, color: colors.text3,
    },
    pickerDropdown: {
      marginTop: 4, backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
      maxHeight: 320,
    },
    pickerSection: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: colors.bg3,
    },
    pickerSectionLabel: {
      fontSize: 10, fontWeight: '700', color: colors.text3,
      letterSpacing: 1.2, textTransform: 'uppercase',
    },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    pickerRowActive: {
      backgroundColor: colors.accentBg,
    },
    pickerRowText: {
      fontSize: 14, fontWeight: '600', color: colors.text,
    },
    pickerRowTextActive: {
      color: colors.accent,
    },
    pickerRowDates: {
      fontSize: 11, color: colors.text3,
    },

    // Empty
    emptyWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8,
    },
    emptyText: {
      fontSize: 13, color: colors.text3, textAlign: 'center', lineHeight: 20,
    },
  });
