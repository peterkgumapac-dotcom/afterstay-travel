import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { WeatherDay } from '@/lib/types';
import { getForecast } from '@/lib/weather';
import { formatDay } from '@/lib/utils';
import Card from './Card';

interface Props {
  destination: string;
  days?: number;
}

export default function WeatherWidget({ destination, days = 5 }: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    error?: string;
    data: WeatherDay[];
  }>({ loading: true, data: [] });

  useEffect(() => {
    let alive = true;
    getForecast(destination, days)
      .then(d => alive && setState({ loading: false, data: d }))
      .catch(e => alive && setState({ loading: false, data: [], error: String(e.message || e) }));
    return () => {
      alive = false;
    };
  }, [destination, days]);

  return (
    <Card>
      <Text style={styles.title}>Weather</Text>
      <Text style={styles.sub}>{destination}</Text>

      {state.loading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.green2} />
        </View>
      )}

      {state.error && <Text style={styles.error}>Couldn't load weather: {state.error}</Text>}

      {!state.loading && !state.error && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {state.data.map(d => (
            <View key={d.date} style={styles.day}>
              <Text style={styles.dayLabel}>{formatDay(d.date)}</Text>
              <Image source={{ uri: d.icon }} style={styles.icon} />
              <Text style={styles.temp}>
                {Math.round(d.maxTemp)}°
                <Text style={styles.tempMin}>/{Math.round(d.minTemp)}°</Text>
              </Text>
              {d.chanceOfRain >= 40 && (
                <Text style={styles.rain}>{d.chanceOfRain}% rain</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.text2, fontSize: 12, marginTop: 2, marginBottom: spacing.md },
  loading: { padding: spacing.lg, alignItems: 'center' },
  error: { color: colors.red, fontSize: 12 },
  row: { gap: spacing.md, paddingVertical: spacing.xs },
  day: {
    backgroundColor: colors.bg3,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minWidth: 78,
  },
  dayLabel: { color: colors.text2, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  icon: { width: 36, height: 36, marginVertical: 4 },
  temp: { color: colors.text, fontSize: 15, fontWeight: '700' },
  tempMin: { color: colors.text3, fontWeight: '500' },
  rain: { color: colors.amber, fontSize: 10, marginTop: 2, fontWeight: '600' },
});
