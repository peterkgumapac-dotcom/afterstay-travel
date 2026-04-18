import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/theme';

interface Props {
  totalAmount: number;
  peopleCount: number;
  onPeopleChange: (n: number) => void;
  maxPeople: number;
}

export const QuickSplitWidget: React.FC<Props> = ({
  totalAmount, peopleCount, onPeopleChange, maxPeople,
}) => {
  const perPerson = peopleCount > 0 ? totalAmount / peopleCount : 0;

  const change = (delta: number) => {
    const next = Math.max(1, Math.min(maxPeople, peopleCount + delta));
    if (next !== peopleCount) {
      Haptics.selectionAsync();
      onPeopleChange(next);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Split among</Text>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => change(-1)}
          style={[styles.btn, peopleCount <= 1 && styles.btnDisabled]}
          disabled={peopleCount <= 1}
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>

        <View style={styles.countBox}>
          <Text style={styles.count}>{peopleCount}</Text>
          <Text style={styles.countLabel}>
            {peopleCount === 1 ? 'person' : 'people'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => change(1)}
          style={[styles.btn, peopleCount >= maxPeople && styles.btnDisabled]}
          disabled={peopleCount >= maxPeople}
        >
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.perPersonRow}>
        <Text style={styles.perPersonLabel}>Each pays</Text>
        <Text style={styles.perPersonValue}>
          ₱{perPerson.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginVertical: 10,
  },
  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  btn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: colors.text, fontSize: 22, fontWeight: '300' },
  countBox: { alignItems: 'center', minWidth: 70 },
  count: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countLabel: { color: colors.text2, fontSize: 11, marginTop: 2 },
  perPersonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border2,
  },
  perPersonLabel: { color: colors.text2, fontSize: 12 },
  perPersonValue: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
