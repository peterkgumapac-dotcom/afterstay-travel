import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatCurrency } from '@/lib/utils';
import type { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface CategoryBarProps {
  label: string;
  amount: number;
  total: number;
  color: string;
  currency: string;
  colors: ThemeColors;
}

export default function CategoryBar({
  label,
  amount,
  total,
  color,
  currency,
  colors,
}: CategoryBarProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;

  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.amount}>{formatCurrency(amount, currency)}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    labelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 90,
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text2,
      flex: 1,
    },
    barTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.card2,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
    },
    amount: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      width: 72,
      textAlign: 'right',
      letterSpacing: 0.2,
    },
  });
