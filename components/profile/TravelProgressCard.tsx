import { MapPinned, Plane } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { formatProfileCurrency, type TravelProgressItem } from '@/lib/profileStats';
import type { LifetimeStats } from '@/lib/types';

interface TravelProgressCardProps {
  items: TravelProgressItem[];
  stats: LifetimeStats;
}

export default function TravelProgressCard({ items, stats }: TravelProgressCardProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  if (items.length === 0) {
    return (
      <View style={s.card}>
        <View style={s.emptyIcon}>
          <Plane size={18} color={colors.accent} strokeWidth={1.8} />
        </View>
        <Text style={s.emptyTitle}>Travel progress starts here</Text>
        <Text style={s.emptyText}>Add completed trips to build your visited countries trail.</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View>
          <Text style={s.kicker}>Travel progress</Text>
          <Text style={s.title}>{stats.totalCountries} visited {stats.totalCountries === 1 ? 'country' : 'countries'}</Text>
        </View>
        <View style={s.metricPill}>
          <MapPinned size={14} color={colors.accent} strokeWidth={1.8} />
          <Text style={s.metricText}>{stats.totalTrips} trips</Text>
        </View>
      </View>

      <View style={s.trail}>
        <View style={s.track} />
        {items.map((item) => (
          <View
            key={`${item.code}-${item.label}`}
            style={[s.node, { left: `${item.progress * 100}%` }]}
          >
            <View style={s.flagBubble}>
              <Text style={s.flag}>{item.flag}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.labels}>
        {items.map((item) => (
          <View key={`${item.code}-${item.label}-label`} style={s.labelCell}>
            <Text style={s.countryLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.statsRow}>
        <View style={s.statCell}>
          <Text style={s.statValue}>{stats.totalNights}</Text>
          <Text style={s.statLabel}>Nights</Text>
        </View>
        <View style={s.statCell}>
          <Text style={s.statValue}>{stats.totalMoments}</Text>
          <Text style={s.statLabel}>Photos</Text>
        </View>
        <View style={s.statCellLast}>
          <Text style={s.statValue}>{formatProfileCurrency(stats.totalSpent)}</Text>
          <Text style={s.statLabel}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0,
  },
  metricPill: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '800',
  },
  trail: {
    height: 58,
    marginHorizontal: 14,
    marginTop: 20,
    justifyContent: 'center',
  },
  track: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.border,
  },
  node: {
    position: 'absolute',
    top: 12,
    marginLeft: -17,
  },
  flagBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.card,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  flag: {
    fontSize: 20,
  },
  labels: {
    flexDirection: 'row',
    gap: 6,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
  },
  countryLabel: {
    color: colors.text2,
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statCellLast: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.text3,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
