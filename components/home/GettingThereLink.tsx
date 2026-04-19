import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { Flight } from '@/lib/types';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';

interface GettingThereLinkProps {
  flights: Flight[];
}

export const GettingThereLink = ({ flights }: GettingThereLinkProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const outbound = flights.find((f) => f.direction === 'Outbound');
  const returnFlight = flights.find((f) => f.direction === 'Return');

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(tabs)/guide')}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>Getting There</Text>
        <Text style={styles.title}>
          {outbound ? `${formatDatePHT(outbound.departTime)} \u00B7 ${formatTimePHT(outbound.departTime)}` : 'No flight yet'}
        </Text>
        <Text style={styles.subtitle}>Flight · Boat · Trike</Text>
        <Text style={styles.arrow}>View →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(tabs)/guide')}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>Plan Your Departure</Text>
        <Text style={styles.title}>
          {returnFlight ? `${formatDatePHT(returnFlight.departTime)} \u00B7 ${formatTimePHT(returnFlight.departTime)}` : 'No flight yet'}
        </Text>
        <Text style={styles.subtitle}>Checkout 12:00 PM</Text>
        <Text style={styles.arrow}>View →</Text>
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  card: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: colors.text2,
    fontSize: 11,
    marginTop: 4,
  },
  arrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 10,
  },
});
