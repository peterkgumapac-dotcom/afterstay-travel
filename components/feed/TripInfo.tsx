import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PAPER, SERIF_ITALIC } from './feedTheme';

interface TripInfoProps {
  destination: string;
  dateRange: string;
}

export function TripInfo({ destination, dateRange }: TripInfoProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.destination}>{destination}</Text>
      <Text style={styles.dates}>{dateRange}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 4,
    alignItems: 'center',
  },
  destination: {
    fontFamily: SERIF_ITALIC,
    fontSize: 16,
    color: PAPER.inkDark,
    lineHeight: 20,
  },
  dates: {
    fontSize: 11,
    color: PAPER.inkMid,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
