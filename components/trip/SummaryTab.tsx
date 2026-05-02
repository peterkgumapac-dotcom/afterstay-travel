import React, { useMemo, useState, useCallback } from 'react';
import {
  Dimensions,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, CircleDot, Clock, Coffee, Dumbbell, Heart, MapPin, Moon, MoreHorizontal, Plus, Sparkles, User, Users, UtensilsCrossed, Wallet, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import ConstellationHero from '@/components/summary/ConstellationHero';
import HighlightsStrip from '@/components/summary/HighlightsStrip';
import PastTripRow from '@/components/summary/PastTripRow';
import QuickTripRow from '@/components/quick-trips/QuickTripRow';
import SwipeableTripCard from '@/components/SwipeableTripCard';
import EmptyState from '@/components/shared/EmptyState';
import { TripCollage } from './TripCollage';
import { GroupHeader } from './GroupHeader';
import type { PastTripDisplay, ThemeColors } from './tripConstants';
import { CATEGORY_ICON, type QuickTrip } from '@/lib/quickTripTypes';
import { formatCurrency } from '@/lib/utils';
import type { Trip } from '@/lib/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48 - 12) / 2; // 2 columns with gap
const CARD_H = CARD_W * 1.25;

const QT_ICON_MAP: Record<string, React.ElementType> = {
  Users, Heart, Coffee, User, UtensilsCrossed, Dumbbell, Sparkles,
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TopSegment = 'trips' | 'quick';
type TripFilter = 'all' | 'past' | 'upcoming' | 'drafts' | 'archived';
type TripCardStatus = 'active' | 'incoming' | 'past' | 'draft' | 'archived';

interface SummaryTabProps {
  totalMiles: number;
  totalTrips: number;
  countriesCount: number;
  totalNights: number;
  totalSpent: number;
  highlights: { icon: string; label: string; sub: string; tint: string }[];
  activeTrips: PastTripDisplay[];
  incomingTrips: PastTripDisplay[];
  pastTrips: PastTripDisplay[];
  draftTrips?: Trip[];
  archivedTrips?: Trip[];
  quickTrips?: QuickTrip[];
  colors: ThemeColors;
  onAddTrip: () => void;
  onTripPress?: (tripId: string, status?: TripCardStatus) => void;
  onQuickTripPress?: (id: string) => void;
  onAddQuickTrip?: () => void;
  onDeleteTrip?: (tripId: string) => void;
  onDeleteDraft?: (tripId: string) => void;
  onArchiveTrip?: (tripId: string) => void;
  onEditTrip?: (tripId: string) => void;
  onRestoreTrip?: (tripId: string) => void;
}

const FILTER_LABELS: Record<TripFilter, string> = {
  all: 'All',
  past: 'Past',
  upcoming: 'Upcoming',
  drafts: 'Drafts',
  archived: 'Archived',
};

function EmptyFilterState({
  filter,
  colors,
  onAction,
}: {
  filter: TripFilter;
  colors: ThemeColors;
  onAction?: () => void;
}) {
  const messages: Record<TripFilter, { title: string; subtitle: string }> = {
    all: {
      title: 'No trips yet',
      subtitle: 'Create your first trip to start tracking adventures.',
    },
    past: {
      title: 'No past trips',
      subtitle: 'Completed trips will appear here.',
    },
    upcoming: {
      title: 'No upcoming trips',
      subtitle: 'Plan something exciting — your next adventure awaits.',
    },
    drafts: {
      title: 'No drafts',
      subtitle: 'Drafts are auto-saved when you start planning.',
    },
    archived: {
      title: 'No archived trips',
      subtitle: 'Archived trips hide from main lists but stay in stats.',
    },
  };
  const msg = messages[filter];
  return (
    <View style={{ paddingVertical: 32, paddingHorizontal: 24 }}>
      <EmptyState
        icon={MapPin}
        title={msg.title}
        subtitle={msg.subtitle}
        actionLabel={filter === 'upcoming' || filter === 'all' ? 'Plan a Trip' : undefined}
        onAction={onAction}
      />
    </View>
  );
}

export function SummaryTab({
  totalMiles,
  totalTrips,
  countriesCount,
  totalNights,
  totalSpent,
  highlights,
  activeTrips,
  incomingTrips,
  pastTrips,
  draftTrips = [],
  archivedTrips = [],
  quickTrips = [],
  colors,
  onAddTrip,
  onTripPress,
  onQuickTripPress,
  onAddQuickTrip,
  onDeleteTrip,
  onDeleteDraft,
  onArchiveTrip,
  onEditTrip,
  onRestoreTrip,
}: SummaryTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [segment, setSegment] = useState<TopSegment>('trips');
  const [filter, setFilter] = useState<TripFilter>('all');
  const [actionTrip, setActionTrip] = useState<{
    tripId: string;
    dest: string;
    dates: string;
    statusLabel: string;
    isDraft: boolean;
    isArchived: boolean;
  } | null>(null);

  // Build filtered list based on active filter
  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'past':
        return pastTrips.map((t) => ({ type: 'past' as const, data: t }));
      case 'upcoming':
        return [
          ...activeTrips.map((t) => ({ type: 'active' as const, data: t })),
          ...incomingTrips.map((t) => ({ type: 'incoming' as const, data: t })),
        ];
      case 'drafts':
        return draftTrips.map((t) => ({ type: 'draft' as const, data: t }));
      case 'archived':
        return archivedTrips.map((t) => ({
          type: 'archived' as const,
          data: mapTripToPastDisplay(t),
        }));
      case 'all':
      default:
        return [
          ...activeTrips.map((t) => ({ type: 'active' as const, data: t })),
          ...incomingTrips.map((t) => ({ type: 'incoming' as const, data: t })),
          ...pastTrips.map((t) => ({ type: 'past' as const, data: t })),
          ...draftTrips.map((t) => ({ type: 'draft' as const, data: t })),
        ];
    }
  }, [filter, activeTrips, incomingTrips, pastTrips, draftTrips, archivedTrips]);

  const handleFilterChange = useCallback(
    (f: TripFilter) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFilter(f);
    },
    []
  );

  const handleDelete = useCallback(
    (tripId: string, isDraft?: boolean) => {
      if (isDraft) {
        onDeleteDraft?.(tripId);
        return;
      }
      onDeleteTrip?.(tripId);
    },
    [onDeleteDraft, onDeleteTrip]
  );

  const handleArchive = useCallback(
    (tripId: string) => {
      onArchiveTrip?.(tripId);
    },
    [onArchiveTrip]
  );

  const handleEdit = useCallback(
    (tripId: string) => {
      onEditTrip?.(tripId);
    },
    [onEditTrip]
  );

  const handleRestore = useCallback(
    (tripId: string) => {
      onRestoreTrip?.(tripId);
    },
    [onRestoreTrip]
  );

  const renderTripItem = (item: (typeof filteredItems)[number], index: number) => {
    if (item.type === 'draft') {
      const t = item.data as Trip;
      const display: PastTripDisplay = mapTripToPastDisplay(t);
      return (
        <SwipeableTripCard
          key={`draft-${t.id}`}
          onEdit={() => handleEdit(t.id)}
          onDelete={() => handleDelete(t.id, true)}
        >
          <PastTripRow
            trip={{ ...display, isDraft: true }}
            onPress={t.id && onTripPress ? () => onTripPress(t.id, 'draft') : undefined}
          />
        </SwipeableTripCard>
      );
    }

    if (item.type === 'archived') {
      const t = item.data as PastTripDisplay;
      return (
        <SwipeableTripCard
          key={`archived-${t.tripId}`}
          onRestore={() => t.tripId && handleRestore(t.tripId)}
          isArchived
        >
          <PastTripRow
            trip={t}
            onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!, 'archived') : undefined}
          />
        </SwipeableTripCard>
      );
    }

    const t = item.data as PastTripDisplay;
    const statusColor =
      item.type === 'active'
        ? colors.success
        : item.type === 'incoming'
        ? colors.accent
        : colors.text3;

    return (
      <SwipeableTripCard
        key={`${item.type}-${t.tripId ?? index}`}
        onEdit={t.tripId ? () => handleEdit(t.tripId!) : undefined}
        onArchive={t.tripId ? () => handleArchive(t.tripId!) : undefined}
        onDelete={t.tripId ? () => handleDelete(t.tripId!) : undefined}
      >
        <View style={styles.tripCardWrapper}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <View style={{ flex: 1 }}>
            <PastTripRow
              trip={t}
              hasMemory={t.hasMemory}
              onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!, item.type) : undefined}
            />
          </View>
        </View>
      </SwipeableTripCard>
    );
  };

  // ── Album card for a trip ──
  const renderTripAlbumCard = (item: (typeof filteredItems)[number], index: number) => {
    const t = item.type === 'draft' ? mapTripToPastDisplay(item.data as Trip) : (item.data as PastTripDisplay);
    const isDraft = item.type === 'draft';
    const isArchived = item.type === 'archived';
    const statusColor = item.type === 'active' ? colors.success : item.type === 'incoming' ? colors.accent : undefined;
    const statusLabel = getTripStatusLabel(item.type, t);
    const shortId = t.tripId ? t.tripId.slice(-6).toUpperCase() : null;
    const canManage = !!t.tripId && (onEditTrip || onArchiveTrip || onDeleteTrip || onDeleteDraft || onRestoreTrip);

    const showTripActions = () => {
      if (!t.tripId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActionTrip({
        tripId: t.tripId,
        dest: t.dest,
        dates: t.dates,
        statusLabel,
        isDraft,
        isArchived,
      });
    };

    return (
      <TouchableOpacity
        key={`${item.type}-${t.tripId ?? index}`}
        style={styles.albumCard}
        onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!, item.type) : undefined}
        activeOpacity={0.8}
      >
        {t.tripId ? (
          <TripCollage tripId={t.tripId} width={CARD_W} height={CARD_H} />
        ) : (
          <View style={[styles.albumCover, styles.albumCoverFallback]}>
            <Text style={styles.albumFlag}>{t.flag}</Text>
          </View>
        )}
        <View style={styles.albumGradient} />
        {statusColor && <View style={[styles.albumDot, { backgroundColor: statusColor }]} />}
        <View style={styles.albumBadge}>
          <Text style={styles.albumBadgeText}>{statusLabel}{shortId ? ` · ${shortId}` : ''}</Text>
        </View>
        {canManage && (
          <TouchableOpacity
            style={styles.albumActionBtn}
            onPress={showTripActions}
            hitSlop={8}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${statusLabel} trip actions`}
          >
            <MoreHorizontal size={16} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.albumInfo}>
          <Text style={styles.albumDest} numberOfLines={1}>{t.dest}</Text>
          <Text style={styles.albumDates} numberOfLines={1}>{t.dates}</Text>
          {t.nights > 0 && (
            <View style={styles.albumMetaRow}><Moon size={10} color="rgba(255,255,255,0.7)" /><Text style={styles.albumMetaText}>{t.nights}n</Text></View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Album card for a quick trip ──
  const renderQuickTripCard = (qt: QuickTrip) => {
    const iconName = CATEGORY_ICON[qt.category] ?? 'Sparkles';
    const Icon = QT_ICON_MAP[iconName] ?? Sparkles;
    return (
      <TouchableOpacity key={qt.id} style={styles.albumCard} onPress={onQuickTripPress ? () => onQuickTripPress(qt.id) : undefined} activeOpacity={0.8}>
        {qt.coverPhotoUrl ? (
          <Image source={{ uri: qt.coverPhotoUrl }} style={styles.albumCover} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[styles.albumCover, styles.albumCoverFallback]}><Icon size={32} color={colors.accent} strokeWidth={1.5} /></View>
        )}
        <View style={styles.albumGradient} />
        <View style={styles.albumBadge}><Icon size={10} color="#fff" strokeWidth={2.5} /><Text style={styles.albumBadgeText}>{qt.category}</Text></View>
        <View style={styles.albumInfo}>
          <Text style={styles.albumDest} numberOfLines={1}>{qt.title}</Text>
          <Text style={styles.albumDates} numberOfLines={1}>{qt.placeName}</Text>
          {qt.totalSpendAmount > 0 && (
            <View style={styles.albumMetaRow}><Wallet size={10} color="rgba(255,255,255,0.7)" /><Text style={styles.albumMetaText}>{formatCurrency(qt.totalSpendAmount, qt.totalSpendCurrency)}</Text></View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <ConstellationHero miles={totalMiles} trips={totalTrips} countries={countriesCount} nights={totalNights} spent={totalSpent} />

      {/* ── Segment: Trips / Quick Trips ── */}
      <View style={styles.segmentRow}>
        {(['trips', 'quick'] as TopSegment[]).map((seg) => {
          const active = segment === seg;
          const count = seg === 'trips' ? activeTrips.length + incomingTrips.length + pastTrips.length + draftTrips.length : quickTrips.length;
          return (
            <TouchableOpacity key={seg} style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={() => { Haptics.selectionAsync(); setSegment(seg); }} activeOpacity={0.7}>
              {seg === 'trips' ? <MapPin size={14} color={active ? colors.accent : colors.text3} /> : <Zap size={14} color={active ? colors.accent : colors.text3} />}
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{seg === 'trips' ? 'Trips' : 'Quick Trips'}</Text>
              <View style={[styles.segmentCount, active && styles.segmentCountActive]}>
                <Text style={[styles.segmentCountText, active && styles.segmentCountTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {segment === 'trips' ? (
        <>
          <GroupHeader kicker="Highlights" title="Your travel story" colors={colors} />
          <HighlightsStrip highlights={highlights} />

          <View style={styles.filterRow}>
            {(Object.keys(FILTER_LABELS) as TripFilter[]).map((f) => (
              <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => handleFilterChange(f)} activeOpacity={0.7}>
                <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{FILTER_LABELS[f]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.albumGrid}>
            {filteredItems.length === 0 ? (
              <View style={{ width: '100%' }}>
                <EmptyFilterState filter={filter} colors={colors} onAction={filter === 'upcoming' || filter === 'all' ? onAddTrip : undefined} />
              </View>
            ) : (
              filteredItems.map((item, i) => renderTripAlbumCard(item, i))
            )}
            {(filter === 'all' || filter === 'upcoming') && (
              <TouchableOpacity onPress={onAddTrip} style={styles.albumCardAdd} activeOpacity={0.7}>
                <Plus size={24} color={colors.accent} />
                <Text style={styles.albumAddLabel}>Add trip</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : (
        <>
          <GroupHeader kicker={`${quickTrips.length} trips`} title="Quick trips" colors={colors} />
          <View style={styles.albumGrid}>
            {quickTrips.length === 0 ? (
              <View style={{ width: '100%', paddingVertical: 32, paddingHorizontal: 24 }}>
                <EmptyState icon={Zap} title="No quick trips yet" subtitle="Capture dinners, outings, and everyday moments" actionLabel="Add Quick Trip" onAction={onAddQuickTrip} />
              </View>
            ) : (
              quickTrips.map((qt) => renderQuickTripCard(qt))
            )}
            {onAddQuickTrip && quickTrips.length > 0 && (
              <TouchableOpacity onPress={onAddQuickTrip} style={styles.albumCardAdd} activeOpacity={0.7}>
                <Zap size={24} color={colors.accent} />
                <Text style={styles.albumAddLabel}>Quick trip</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      <Modal
        visible={!!actionTrip}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTrip(null)}
      >
        <Pressable style={styles.actionOverlay} onPress={() => setActionTrip(null)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <View style={styles.actionHandle} />
            <Text style={styles.actionTitle}>{actionTrip?.dest ?? 'Trip'}</Text>
            <Text style={styles.actionSubtitle}>
              {[actionTrip?.statusLabel, actionTrip?.dates].filter(Boolean).join(' · ')}
            </Text>

            <View style={styles.actionDivider} />

            {actionTrip?.isArchived ? (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  const id = actionTrip.tripId;
                  setActionTrip(null);
                  handleRestore(id);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.actionRowTitle}>Restore Trip</Text>
                <Text style={styles.actionRowSub}>Move this trip back to your travel story</Text>
              </TouchableOpacity>
            ) : (
              <>
                {onEditTrip && actionTrip && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      const id = actionTrip.tripId;
                      setActionTrip(null);
                      handleEdit(id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionRowTitle}>Edit Trip</Text>
                    <Text style={styles.actionRowSub}>Update dates, hotel, flights, and details</Text>
                  </TouchableOpacity>
                )}

                {onArchiveTrip && actionTrip && !actionTrip.isDraft && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      const id = actionTrip.tripId;
                      setActionTrip(null);
                      handleArchive(id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionRowTitle}>Archive Trip</Text>
                    <Text style={styles.actionRowSub}>Hide it from active planning without deleting it</Text>
                  </TouchableOpacity>
                )}

                {actionTrip && ((actionTrip.isDraft && onDeleteDraft) || (!actionTrip.isDraft && onDeleteTrip)) && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      const id = actionTrip.tripId;
                      const draft = actionTrip.isDraft;
                      setActionTrip(null);
                      handleDelete(id, draft);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.actionRowTitle, { color: colors.danger }]}>
                      {actionTrip.isDraft ? 'Delete Draft' : 'Delete Trip'}
                    </Text>
                    <Text style={styles.actionRowSub}>Remove this trip from your account</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.actionBackBtn}
              onPress={() => setActionTrip(null)}
              activeOpacity={0.75}
            >
              <Text style={styles.actionBackText}>Back</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function mapTripToPastDisplay(t: Trip): PastTripDisplay {
  const COUNTRY_FLAGS: Record<string, string> = {
    JP: '\u{1F1EF}\u{1F1F5}',
    VN: '\u{1F1FB}\u{1F1F3}',
    PH: '\u{1F1F5}\u{1F1ED}',
    TH: '\u{1F1F9}\u{1F1ED}',
    SG: '\u{1F1F8}\u{1F1EC}',
    US: '\u{1F1FA}\u{1F1F8}',
    KR: '\u{1F1F0}\u{1F1F7}',
    ID: '\u{1F1EE}\u{1F1E9}',
  };
  const nights = t.nights > 0 ? t.nights : (t.totalNights ?? 0);
  return {
    tripId: t.id,
    flag: COUNTRY_FLAGS[t.countryCode ?? ''] ?? '\u{1F30D}',
    dest: t.destination ?? t.name,
    country: t.country ?? '',
    dates: `${formatDate(t.startDate)} \u2013 ${formatDate(t.endDate)}`,
    nights,
    spent: t.totalSpent ?? 0,
    miles: 0,
    rating: 0,
    heroImageUrl: t.heroImageUrl,
    isDraft: t.isDraft,
    lifecycleStatus: t.isDraft ? 'Draft' : t.archivedAt ? 'Archived' : t.status,
  };
}

function getTripStatusLabel(type: TripCardStatus, trip: PastTripDisplay): string {
  if (trip.lifecycleStatus) {
    if (trip.lifecycleStatus === 'Planning') return 'Planning';
    return trip.lifecycleStatus;
  }
  switch (type) {
    case 'active':
      return 'Active';
    case 'incoming':
      return 'Planning';
    case 'draft':
      return 'Draft';
    case 'archived':
      return 'Archived';
    case 'past':
    default:
      return 'Completed';
  }
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00+08:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ghostAction: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    listContainer: {
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 8,
    },
    tripCardWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    emptyText: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      paddingVertical: 16,
    },
    addPastTripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: colors.border2,
      borderStyle: 'dashed',
      borderRadius: 14,
    },
    addPastTripIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPastTripInfo: {
      flex: 1,
    },
    addPastTripTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    addPastTripSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 8,
    },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipActive: {
      borderColor: colors.black,
      backgroundColor: colors.black,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    filterChipTextActive: {
      color: colors.onBlack,
    },
    // ── Segment control ──
    segmentRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 10,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentBtnActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text3,
    },
    segmentLabelActive: {
      color: colors.accent,
    },
    segmentCount: {
      backgroundColor: colors.border,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
      minWidth: 20,
      alignItems: 'center',
    },
    segmentCountActive: {
      backgroundColor: colors.accentBorder,
    },
    segmentCountText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.text3,
    },
    segmentCountTextActive: {
      color: colors.accent,
    },
    // ── Album grid ──
    albumGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      gap: 12,
      paddingBottom: 16,
    },
    albumCard: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    albumCover: {
      width: '100%',
      height: '100%',
    },
    albumCoverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.elevated,
    },
    albumFlag: {
      fontSize: 40,
    },
    albumGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '55%',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    albumDot: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: 'rgba(0,0,0,0.3)',
    },
    albumBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      maxWidth: CARD_W - 52,
    },
    albumBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#fff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    albumActionBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.48)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    albumInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    albumDest: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.2,
    },
    albumDates: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
    },
    albumMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 4,
    },
    albumMetaText: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '600',
    },
    albumCardAdd: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border2,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    albumAddLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
    },
    actionOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.58)',
      justifyContent: 'flex-end',
    },
    actionSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 34,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionHandle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border2,
      marginBottom: 14,
    },
    actionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    actionSubtitle: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 4,
    },
    actionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 14,
    },
    actionRow: {
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.bg,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionRowTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    actionRowSub: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 3,
      lineHeight: 16,
    },
    actionBackBtn: {
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 2,
    },
    actionBackText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text2,
    },
  });
