import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Sun, Cloud, CloudRain, CloudSun, CloudSnow, CloudFog, CloudLightning } from 'lucide-react-native';

import { colors } from '@/constants/theme';
import { CONFIG } from '../../lib/config';

interface HourData {
  hour: number;
  chance_of_rain: number;
}

interface DayForecast {
  date: string;
  dayLabel: string;
  maxTemp: number;
  minTemp: number;
  chanceRain: number;
  condition: string;
  rainWindows: { startHour: number; endHour: number; maxChance: number }[];
}

type LucideIcon = typeof Sun;

const iconForCondition = (condition: string): { Icon: LucideIcon; color: string } => {
  const c = condition.toLowerCase();
  if (c.includes('sunny') || c.includes('clear')) return { Icon: Sun, color: '#fbbf24' };
  if (c.includes('partly cloudy')) return { Icon: CloudSun, color: '#94a3b8' };
  if (c.includes('thunder')) return { Icon: CloudLightning, color: '#60a5fa' };
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return { Icon: CloudRain, color: '#60a5fa' };
  if (c.includes('snow') || c.includes('sleet')) return { Icon: CloudSnow, color: '#e2e8f0' };
  if (c.includes('fog') || c.includes('mist')) return { Icon: CloudFog, color: '#94a3b8' };
  if (c.includes('cloud') || c.includes('overcast')) return { Icon: Cloud, color: '#94a3b8' };
  return { Icon: CloudSun, color: '#fbbf24' };
};

const formatHourRange = (start: number, end: number): string => {
  const fmt = (h: number) => {
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${h12}${ampm}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
};

const findRainWindows = (hours: HourData[]) => {
  const windows: { startHour: number; endHour: number; maxChance: number }[] = [];
  let inWindow = false;
  let startHour = 0;
  let maxChance = 0;

  hours.forEach((h) => {
    const raining = h.chance_of_rain >= 50;
    if (raining && !inWindow) {
      inWindow = true;
      startHour = h.hour;
      maxChance = h.chance_of_rain;
    } else if (raining && inWindow) {
      maxChance = Math.max(maxChance, h.chance_of_rain);
    } else if (!raining && inWindow) {
      inWindow = false;
      windows.push({ startHour, endHour: h.hour, maxChance });
    }
  });

  if (inWindow) {
    windows.push({ startHour, endHour: 23, maxChance });
  }

  return windows;
};

const dayLabelFor = (dateStr: string, index: number): string => {
  if (index === 0) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};

export const WeatherForecastCard = () => {
  const [days, setDays] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${CONFIG.WEATHER_KEY}&q=Boracay,Philippines&days=3&aqi=no&alerts=no`
      );
      const data = await res.json();

      if (data.error) {
        console.error('Weather API error:', data.error);
        setLoading(false);
        return;
      }

      const forecasts: DayForecast[] = data.forecast.forecastday.map((fd: any, i: number) => {
        const hours: HourData[] = fd.hour.map((h: any) => ({
          hour: new Date(h.time).getHours(),
          chance_of_rain: h.chance_of_rain,
        }));
        const rainWindows = findRainWindows(hours);

        return {
          date: fd.date,
          dayLabel: dayLabelFor(fd.date, i),
          maxTemp: Math.round(fd.day.maxtemp_c),
          minTemp: Math.round(fd.day.mintemp_c),
          chanceRain: fd.day.daily_chance_of_rain,
          condition: fd.day.condition.text,
          rainWindows,
        };
      });

      setDays(forecasts);
    } catch (e) {
      console.error('Weather fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.accentLt} />
      </View>
    );
  }

  if (days.length === 0) return null;

  const insights: string[] = [];
  days.forEach((d) => {
    if (d.rainWindows.length > 0) {
      const biggest = d.rainWindows.reduce((a, b) => (a.maxChance > b.maxChance ? a : b));
      const timeStr = formatHourRange(biggest.startHour, biggest.endHour);
      insights.push(
        `${d.dayLabel}: Rain expected ${timeStr} (${biggest.maxChance}%)`
      );
    }
  });

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Your Stay Weather · Boracay</Text>

      <View style={styles.daysRow}>
        {days.map((d) => {
          const { Icon: WeatherIcon, color: iconColor } = iconForCondition(d.condition);
          return (
          <View key={d.date} style={styles.dayCol}>
            <Text style={styles.dayLabel}>{d.dayLabel}</Text>
            <View style={styles.iconWrap}>
              <WeatherIcon color={iconColor} size={28} strokeWidth={1.75} />
            </View>
            <Text style={styles.maxTemp}>{d.maxTemp}°</Text>
            <Text style={styles.minTemp}>{d.minTemp}°</Text>
            {d.chanceRain > 0 && (
              <Text style={styles.rainPct}>{d.chanceRain}%</Text>
            )}
          </View>
          );
        })}
      </View>

      {insights.length > 0 && (
        <View style={styles.insightsBox}>
          {insights.map((insight, idx) => (
            <Text key={idx} style={styles.insight}>
              💡 {insight}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  iconWrap: {
    marginBottom: 8,
    alignItems: 'center',
  },
  maxTemp: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '500',
  },
  minTemp: {
    color: colors.text3,
    fontSize: 13,
    marginTop: 2,
  },
  rainPct: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  insightsBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  insight: {
    color: colors.accentLt,
    fontSize: 13,
    lineHeight: 18,
  },
});
