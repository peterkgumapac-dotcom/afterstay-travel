import { Camera, Globe2, Moon, Plane, WalletCards } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { formatProfileCurrency } from '@/lib/profileStats';
import type { LifetimeStats } from '@/lib/types';

interface TravelStatsCardProps {
  stats: LifetimeStats;
}

export default function TravelStatsCard({ stats }: TravelStatsCardProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const totalKm = Math.round(stats.totalMiles * 1.60934);

  const cells = [
    { key: 'trips', icon: Plane, value: stats.totalTrips, label: 'Trips' },
    { key: 'countries', icon: Globe2, value: stats.totalCountries, label: 'Countries' },
    { key: 'nights', icon: Moon, value: stats.totalNights, label: 'Nights' },
    { key: 'spent', icon: WalletCards, value: formatProfileCurrency(stats.totalSpent), label: 'Spent' },
    { key: 'photos', icon: Camera, value: stats.totalMoments, label: 'Photos' },
  ];

  return (
    <View style={s.card}>
      <Text style={s.kicker}>Lifetime · Since {stats.earliestTripDate ? new Date(stats.earliestTripDate).getFullYear() : 'now'}</Text>
      <View style={s.distanceRow}>
        <Text style={s.distance}>{totalKm.toLocaleString()}</Text>
        <Text style={s.distanceLabel}>km traveled</Text>
      </View>
      <View style={s.grid}>
        {cells.map((cell) => {
          const Icon = cell.icon;
          return (
            <View key={cell.key} style={s.cell}>
              <Icon size={16} color={colors.accent} strokeWidth={1.8} />
              <Text style={s.value}>{cell.value}</Text>
              <Text style={s.label}>{cell.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  distance: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  distanceLabel: {
    color: colors.text2,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 18,
    paddingTop: 14,
  },
  cell: {
    width: '20%',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  label: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
