import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BudgetStatus } from '../../lib/budgetAlerts';
import { colors } from '@/constants/theme';

interface Props {
  status: BudgetStatus;
}

const COLORS = {
  green: { bg: colors.accentBg, border: colors.accent, text: colors.accent },
  yellow: { bg: colors.warnBg, border: colors.warn, text: colors.warn },
  orange: { bg: 'rgba(227, 136, 104, 0.12)', border: colors.coral, text: colors.coral },
  red: { bg: 'rgba(196, 85, 74, 0.12)', border: colors.danger, text: colors.danger },
};

export const BudgetAlertCard: React.FC<Props> = ({ status }) => {
  const c = COLORS[status.level];

  return (
    <View style={[styles.card, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{status.emoji}</Text>
        <Text style={[styles.title, { color: c.text }]}>{status.title}</Text>
      </View>
      <Text style={[styles.message, { color: c.text }]}>{status.message}</Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(100, status.percentUsed)}%`,
              backgroundColor: c.border,
            },
          ]}
        />
      </View>
      <Text style={[styles.percent, { color: c.text }]}>
        {status.percentUsed.toFixed(0)}% used
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  emoji: { fontSize: 18 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  percent: { fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'right' },
});
