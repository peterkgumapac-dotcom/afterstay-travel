import React, { useMemo, useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Archive, ChevronRight, Coffee, Dumbbell, Heart, MapPin, MoreHorizontal, Plus, Sparkles, User, Users, UtensilsCrossed, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import EmptyState from '@/components/shared/EmptyState';
import { TripCollage } from './TripCollage';
import type { PastTripDisplay, ThemeColors } from './tripConstants';
import { CATEGORY_ICON, type QuickTrip } from '@/lib/quickTripTypes';
import { formatCurrency } from '@/lib/utils';
import type { Trip } from '@/lib/types';

const QT_ICON_MAP: Record<string, React.ElementType> = {
  Users, Heart, Coffee, User, UtensilsCrossed, Dumbbell, Sparkles,
};

type TopSegment = 'trips' | 'quick';
type TripCardStatus = 'active' | 'incoming' | 'past' | 'draft' | 'archived';
type TripLibraryItem =
  | { type: 'active'; data: PastTripDisplay }
  | { type: 'incoming'; data: PastTripDisplay }
  | { type: 'past'; data: PastTripDisplay }
  | { type: 'draft'; data: Trip }
  | { type: 'archived'; data: PastTripDisplay };

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
  onViewRecap?: (tripId: string) => void;
  onRescanTrip?: (tripId: string) => void;
  onInviteTrip?: (tripId: string) => void;
  onRestoreTrip?: (tripId: string) => void;
}

export function SummaryTab({
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
  onViewRecap,
  onRescanTrip,
  onInviteTrip,
  onRestoreTrip,
}: SummaryTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [segment, setSegment] = useState<TopSegment>('trips');
  const [showArchived, setShowArchived] = useState(false);
  const [actionTrip, setActionTrip] = useState<{
    tripId: string;
    dest: string;
    dates: string;
    statusLabel: string;
    isDraft: boolean;
    isArchived: boolean;
  } | null>(null);

  const upcomingItems = useMemo<TripLibraryItem[]>(() => [
    ...activeTrips.map((t) => ({ type: 'active' as const, data: t })),
    ...incomingTrips.map((t) => ({ type: 'incoming' as const, data: t })),
    ...draftTrips.map((t) => ({ type: 'draft' as const, data: t })),
  ], [activeTrips, incomingTrips, draftTrips]);

  const completedItems = useMemo<TripLibraryItem[]>(() => pastTrips.map((t) => ({ type: 'past' as const, data: t })), [pastTrips]);

  const archivedItems = useMemo<TripLibraryItem[]>(() => archivedTrips.map((t) => ({
    type: 'archived' as const,
    data: mapTripToPastDisplay(t),
  })), [archivedTrips]);

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

  // ── Library card for a trip ──
  const renderTripLibraryCard = (
    item: TripLibraryItem,
    index: number,
  ) => {
    const t = item.type === 'draft' ? mapTripToPastDisplay(item.data as Trip) : (item.data as PastTripDisplay);
    const isDraft = item.type === 'draft';
    const isArchived = item.type === 'archived';
    const statusLabel = getTripStatusLabel(item.type, t);
    const canManage = !!t.tripId && (onEditTrip || onArchiveTrip || onDeleteTrip || onDeleteDraft || onRestoreTrip || onViewRecap || onRescanTrip || onInviteTrip);

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
        style={styles.tripLibraryCard}
        onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!, item.type) : undefined}
        activeOpacity={0.8}
      >
        <View style={styles.tripThumbWrap}>
          {t.tripId ? (
            <TripCollage tripId={t.tripId} width={92} height={92} animated={false} />
          ) : (
            <View style={[styles.tripThumbFallback]}>
              <Text style={styles.albumFlag}>{t.flag}</Text>
            </View>
          )}
        </View>

        <View style={styles.tripLibraryInfo}>
          <View style={styles.tripTitleRow}>
            <Text style={styles.tripLibraryTitle} numberOfLines={1}>{t.dest}</Text>
            <View style={[
              styles.statusPill,
              item.type === 'active' && styles.statusPillActive,
              item.type === 'incoming' && styles.statusPillUpcoming,
              item.type === 'past' && styles.statusPillCompleted,
              item.type === 'draft' && styles.statusPillDraft,
              item.type === 'archived' && styles.statusPillArchived,
            ]}>
              <Text style={[
                styles.statusPillText,
                item.type === 'active' && styles.statusPillTextActive,
                item.type === 'incoming' && styles.statusPillTextUpcoming,
                item.type === 'past' && styles.statusPillTextCompleted,
                item.type === 'draft' && styles.statusPillTextDraft,
                item.type === 'archived' && styles.statusPillTextArchived,
              ]}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.tripLibraryDates} numberOfLines={1}>{t.dates}</Text>
          <View style={styles.tripMetaLine}>
            {t.nights > 0 ? (
              <Text style={styles.tripMetaText}>{t.nights} night{t.nights !== 1 ? 's' : ''}</Text>
            ) : null}
            {t.spent > 0 ? (
              <Text style={styles.tripMetaText}>{formatCurrency(t.spent, 'PHP')} spent</Text>
            ) : null}
            {isDraft ? <Text style={styles.tripMetaText}>Resume planning</Text> : null}
          </View>
        </View>

        <View style={styles.tripCardRight}>
          {canManage ? (
            <TouchableOpacity
              style={styles.tripActionBtn}
              onPress={showTripActions}
              hitSlop={8}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${statusLabel} trip actions`}
            >
              <MoreHorizontal size={17} color={colors.text2} />
            </TouchableOpacity>
          ) : (
            <ChevronRight size={18} color={colors.text3} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    items: TripLibraryItem[],
    emptyText?: string,
  ) => (
    <View style={styles.librarySection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionList}>
        {items.length > 0 ? (
          items.map((item, index) => renderTripLibraryCard(item, index))
        ) : emptyText ? (
          <Text style={styles.sectionEmptyText}>{emptyText}</Text>
        ) : null}
      </View>
    </View>
  );

  const renderArchiveRow = () => {
    if (archivedItems.length === 0) return null;
    return (
      <TouchableOpacity
        style={styles.archiveRow}
        onPress={() => {
          Haptics.selectionAsync();
          setShowArchived((value) => !value);
        }}
        activeOpacity={0.75}
      >
        <View style={styles.archiveIcon}>
          <Archive size={17} color={colors.text2} />
        </View>
        <Text style={styles.archiveText}>View archived trips</Text>
        <Text style={styles.archiveCount}>{archivedItems.length}</Text>
        <ChevronRight size={18} color={colors.text3} style={showArchived ? styles.archiveChevronOpen : undefined} />
      </TouchableOpacity>
    );
  };

  const renderQuickTripListCard = (qt: QuickTrip) => {
    const iconName = CATEGORY_ICON[qt.category] ?? 'Sparkles';
    const Icon = QT_ICON_MAP[iconName] ?? Sparkles;
    return (
      <TouchableOpacity
        key={qt.id}
        style={styles.tripLibraryCard}
        onPress={onQuickTripPress ? () => onQuickTripPress(qt.id) : undefined}
        activeOpacity={0.8}
      >
        {qt.coverPhotoUrl ? (
          <Image source={{ uri: qt.coverPhotoUrl }} style={styles.quickThumb} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={styles.quickThumbFallback}>
            <Icon size={28} color={colors.accent} strokeWidth={1.5} />
          </View>
        )}
        <View style={styles.tripLibraryInfo}>
          <Text style={styles.tripLibraryTitle} numberOfLines={1}>{qt.title}</Text>
          <Text style={styles.tripLibraryDates} numberOfLines={1}>{qt.placeName}</Text>
          <View style={styles.tripMetaLine}>
            <Text style={styles.tripMetaText}>{qt.category}</Text>
            {qt.totalSpendAmount > 0 ? (
              <Text style={styles.tripMetaText}>{formatCurrency(qt.totalSpendAmount, qt.totalSpendCurrency)} spent</Text>
            ) : null}
          </View>
        </View>
        <ChevronRight size={18} color={colors.text3} />
      </TouchableOpacity>
    );
  };

  return (
    <>
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
          {renderSection('Active & Upcoming', upcomingItems, 'No active or upcoming trips yet.')}
          {renderSection('Completed', completedItems)}
          {upcomingItems.length === 0 && completedItems.length === 0 ? (
            <View style={styles.emptyLibraryWrap}>
              <EmptyState
                icon={MapPin}
                title="Plan your first trip"
                subtitle="Your trips, bookings, companions, and files will live here."
                actionLabel="Plan a Trip"
                onAction={onAddTrip}
              />
            </View>
          ) : null}
          <View style={styles.librarySection}>
            <TouchableOpacity onPress={onAddTrip} style={styles.addTripRow} activeOpacity={0.7}>
              <View style={styles.addTripIcon}>
                <Plus size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addTripTitle}>Add trip</Text>
                <Text style={styles.addTripSub}>Scan a booking or start from scratch</Text>
              </View>
              <ChevronRight size={18} color={colors.text3} />
            </TouchableOpacity>
            {renderArchiveRow()}
            {showArchived ? renderSection('Archived', archivedItems) : null}
          </View>
        </>
      ) : (
        <>
          <View style={styles.librarySection}>
            <Text style={styles.sectionTitle}>Quick Trips</Text>
            {quickTrips.length === 0 ? (
              <View style={styles.emptyLibraryWrap}>
                <EmptyState icon={Zap} title="No quick trips yet" subtitle="Capture dinners, outings, and everyday moments" actionLabel="Add Quick Trip" onAction={onAddQuickTrip} />
              </View>
            ) : (
              <View style={styles.sectionList}>
                {quickTrips.map((qt) => renderQuickTripListCard(qt))}
              </View>
            )}
            {onAddQuickTrip && quickTrips.length > 0 && (
              <TouchableOpacity onPress={onAddQuickTrip} style={styles.addTripRow} activeOpacity={0.7}>
                <View style={styles.addTripIcon}>
                  <Zap size={22} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addTripTitle}>Add quick trip</Text>
                  <Text style={styles.addTripSub}>Log a day out, meal, or short memory</Text>
                </View>
                <ChevronRight size={18} color={colors.text3} />
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
                {onViewRecap && actionTrip && actionTrip.statusLabel === 'Completed' && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      const id = actionTrip.tripId;
                      setActionTrip(null);
                      onViewRecap(id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionRowTitle}>View Recap</Text>
                    <Text style={styles.actionRowSub}>Open photos, places, spending, and trip memories</Text>
                  </TouchableOpacity>
                )}

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

                {onRescanTrip && actionTrip && !actionTrip.isDraft && actionTrip.statusLabel !== 'Completed' && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      const id = actionTrip.tripId;
                      setActionTrip(null);
                      onRescanTrip(id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionRowTitle}>Rescan Booking</Text>
                    <Text style={styles.actionRowSub}>Replace hotel, dates, outbound, and return flights</Text>
                  </TouchableOpacity>
                )}

                {onInviteTrip && actionTrip && !actionTrip.isDraft && actionTrip.statusLabel !== 'Completed' && (
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={() => {
                      const id = actionTrip.tripId;
                      setActionTrip(null);
                      onInviteTrip(id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.actionRowTitle}>Invite Companions</Text>
                    <Text style={styles.actionRowSub}>Review travelers and share trip access</Text>
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
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    librarySection: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text2,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    sectionList: {
      gap: 10,
    },
    sectionEmptyText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.text3,
      paddingVertical: 12,
    },
    tripLibraryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 112,
      padding: 10,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tripThumbWrap: {
      width: 92,
      height: 92,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.elevated,
    },
    tripThumbFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.elevated,
    },
    albumFlag: {
      fontSize: 34,
    },
    quickThumb: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: colors.elevated,
    },
    quickThumbFallback: {
      width: 72,
      height: 72,
      borderRadius: 16,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripLibraryInfo: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    tripTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tripLibraryTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.25,
    },
    tripLibraryDates: {
      fontSize: 13,
      color: colors.text2,
      marginTop: 6,
    },
    tripMetaLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
      marginTop: 9,
    },
    tripMetaText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.text3,
      fontWeight: '600',
    },
    tripCardRight: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 2,
    },
    tripActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusPill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.elevated,
    },
    statusPillActive: {
      backgroundColor: 'rgba(50, 150, 90, 0.13)',
    },
    statusPillUpcoming: {
      backgroundColor: colors.accentBg,
    },
    statusPillCompleted: {
      backgroundColor: colors.elevated,
    },
    statusPillDraft: {
      backgroundColor: 'rgba(120, 120, 120, 0.12)',
    },
    statusPillArchived: {
      backgroundColor: 'rgba(120, 120, 120, 0.10)',
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.text3,
    },
    statusPillTextActive: {
      color: colors.success,
    },
    statusPillTextUpcoming: {
      color: colors.accent,
    },
    statusPillTextCompleted: {
      color: colors.text2,
    },
    statusPillTextDraft: {
      color: colors.text3,
    },
    statusPillTextArchived: {
      color: colors.text3,
    },
    emptyLibraryWrap: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    addTripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border2,
      borderStyle: 'dashed',
      backgroundColor: colors.card,
      marginBottom: 10,
    },
    addTripIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addTripTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    addTripSub: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 2,
    },
    archiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    archiveIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    archiveText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    archiveCount: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text3,
      backgroundColor: colors.elevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    archiveChevronOpen: {
      transform: [{ rotate: '90deg' }],
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
