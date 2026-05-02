import { Globe2, Moon, Plane, WalletCards } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { formatProfileCurrency } from '@/lib/profileStats';
import type { LifetimeStats } from '@/lib/types';

interface ProfileStatsStripProps {
  stats: LifetimeStats;
}

export default function ProfileStatsStrip({ stats }: ProfileStatsStripProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);
  const cells = [
    { key: 'trips', icon: Plane, value: stats.totalTrips, label: 'Trips' },
    { key: 'countries', icon: Globe2, value: stats.totalCountries, label: 'Countries' },
    { key: 'nights', icon: Moon, value: stats.totalNights, label: 'Nights' },
    { key: 'spent', icon: WalletCards, value: formatProfileCurrency(stats.totalSpent), label: 'Spent' },
  ];

  return (
    <View style={s.card}>
      {cells.map((cell, index) => {
        const Icon = cell.icon;
        return (
          <View key={cell.key} style={[s.cell, index < cells.length - 1 && s.cellBorder]}>
            <Icon size={17} color={colors.accent} strokeWidth={1.8} />
            <Text style={s.value}>{cell.value}</Text>
            <Text style={s.label}>{cell.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  value: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  label: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
  },
});
