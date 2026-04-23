import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fateColors } from '@/constants/fateTheme';
import type { FateResult } from '@/hooks/fate/useFateHistory';

interface RecentChipsProps {
  history: FateResult[];
}

export default function RecentChips({ history }: RecentChipsProps) {
  if (history.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>RECENT</Text>
      <View style={styles.chipRow}>
        {history.map((r) => (
          <View key={r.id} style={styles.chip}>
            <Text style={styles.chipText}>
              {r.winner}
              {r.duoWinner ? ` & ${r.duoWinner}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 20 },
  label: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: fateColors.textMuted,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 90, 43, 0.08)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: fateColors.textSecondary,
  },
});
