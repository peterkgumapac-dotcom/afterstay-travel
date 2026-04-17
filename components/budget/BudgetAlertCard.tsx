import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BudgetStatus } from '../../lib/budgetAlerts';

interface Props {
  status: BudgetStatus;
}

const COLORS = {
  green: { bg: 'rgba(45,212,160,0.1)', border: '#2dd4a0', text: '#2dd4a0' },
  yellow: { bg: 'rgba(251,191,36,0.1)', border: '#fbbf24', text: '#fbbf24' },
  orange: { bg: 'rgba(249,115,22,0.12)', border: '#f97316', text: '#fdba74' },
  red: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#fca5a5' },
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
