import React, { useMemo, useState, useCallback } from 'react';
import {
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { ChevronRight, CircleDot, Clock, MapPin, Plus, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import ConstellationHero from '@/components/summary/ConstellationHero';
import HighlightsStrip from '@/components/summary/HighlightsStrip';
import PastTripRow from '@/components/summary/PastTripRow';
import QuickTripRow from '@/components/quick-trips/QuickTripRow';
import SwipeableTripCard from '@/components/SwipeableTripCard';
import EmptyState from '@/components/shared/EmptyState';
import { GroupHeader } from './GroupHeader';
import type { PastTripDisplay, ThemeColors } from './tripConstants';
import type { QuickTrip } from '@/lib/quickTripTypes';
import type { Trip } from '@/lib/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TripFilter = 'all' | 'past' | 'upcoming' | 'drafts' | 'archived';

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
  onTripPress?: (tripId: string) => void;
  onQuickTripPress?: (id: string) => void;
  onAddQuickTrip?: () => void;
  onDeleteTrip?: (tripId: string) => void;
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
  onArchiveTrip,
  onEditTrip,
  onRestoreTrip,
}: SummaryTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [filter, setFilter] = useState<TripFilter>('all');

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
    (tripId: string) => {
      onDeleteTrip?.(tripId);
    },
    [onDeleteTrip]
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
          onDelete={() => handleDelete(t.id)}
        >
          <PastTripRow
            trip={{ ...display, isDraft: true }}
            onPress={t.id && onTripPress ? () => onTripPress(t.id) : undefined}
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
            onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!) : undefined}
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
              onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!) : undefined}
            />
          </View>
        </View>
      </SwipeableTripCard>
    );
  };

  return (
    <>
      <ConstellationHero
        miles={totalMiles}
        trips={totalTrips}
        countries={countriesCount}
        nights={totalNights}
        spent={totalSpent}
      />

      {/* Highlights */}
      <GroupHeader kicker="Highlights" title="Your travel story" colors={colors} />
      <HighlightsStrip highlights={highlights} />

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(Object.keys(FILTER_LABELS) as TripFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => handleFilterChange(f)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f && styles.filterChipTextActive,
              ]}
            >
              {FILTER_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtered trip list */}
      <View style={styles.listContainer}>
        {filteredItems.length === 0 ? (
          <EmptyFilterState
            filter={filter}
            colors={colors}
            onAction={filter === 'upcoming' || filter === 'all' ? onAddTrip : undefined}
          />
        ) : (
          filteredItems.map((item, i) => renderTripItem(item, i))
        )}

        {/* Add trip row (only in All/Upcoming tabs) */}
        {(filter === 'all' || filter === 'upcoming') && (
          <TouchableOpacity
            onPress={onAddTrip}
            style={styles.addPastTripRow}
            activeOpacity={0.7}
          >
            <View style={styles.addPastTripIcon}>
              <Plus size={18} color={colors.accent} />
            </View>
            <View style={styles.addPastTripInfo}>
              <Text style={styles.addPastTripTitle}>Add a past trip</Text>
              <Text style={styles.addPastTripSub}>
                Backfill your travel history
              </Text>
            </View>
            <ChevronRight size={14} color={colors.text3} />
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Trips */}
      <GroupHeader
        kicker={`Quick trips \u00B7 ${quickTrips.length}`}
        title="Quick moments"
        colors={colors}
      />
      <View style={styles.listContainer}>
        {quickTrips.length === 0 && (
          <Text style={styles.emptyText}>No quick trips yet</Text>
        )}
        {quickTrips.map((qt) => (
          <QuickTripRow
            key={qt.id}
            trip={qt}
            onPress={onQuickTripPress ? () => onQuickTripPress(qt.id) : undefined}
          />
        ))}

        {onAddQuickTrip && (
          <TouchableOpacity
            onPress={onAddQuickTrip}
            style={styles.addPastTripRow}
            activeOpacity={0.7}
          >
            <View style={styles.addPastTripIcon}>
              <Zap size={18} color={colors.accent} />
            </View>
            <View style={styles.addPastTripInfo}>
              <Text style={styles.addPastTripTitle}>Add a quick trip</Text>
              <Text style={styles.addPastTripSub}>
                Dinners, outings, gatherings
              </Text>
            </View>
            <ChevronRight size={14} color={colors.text3} />
          </TouchableOpacity>
        )}
      </View>
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
  };
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
  });
