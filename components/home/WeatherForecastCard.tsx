import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Sun, Cloud, CloudRain, CloudSun, CloudSnow, CloudFog, CloudLightning, Droplets } from 'lucide-react-native';

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

interface CurrentWeather {
  temp: number;
  condition: string;
  feelsLike: number;
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
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };
  return `${fmt(start)} \u2013 ${fmt(end)}`;
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
  if (index === 0) return 'TODAY';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
};

export const WeatherForecastCard = () => {
  const [days, setDays] = useState<DayForecast[]>([]);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${CONFIG.WEATHER_KEY}&q=Boracay,Philippines&days=5&aqi=no&alerts=no`
      );
      const data = await res.json();

      if (data.error) {
        console.error('Weather API error:', data.error);
        setLoading(false);
        return;
      }

      // Current weather
      if (data.current) {
        setCurrent({
          temp: Math.round(data.current.temp_c),
          condition: data.current.condition?.text ?? '',
          feelsLike: Math.round(data.current.feelslike_c),
        });
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

  const today = days[0];
  const todayRain = today?.rainWindows.length > 0
    ? today.rainWindows.reduce((a, b) => (a.maxChance > b.maxChance ? a : b))
    : null;

  const { Icon: BigIcon, color: bigIconColor } = iconForCondition(today?.condition ?? '');

  return (
    <View style={styles.card}>
      {/* Header with current temp */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>Your Stay Weather {'\u00B7'} Boracay</Text>
          {current ? (
            <View style={styles.currentRow}>
              <Text style={styles.currentTemp}>{today.maxTemp}{'\u00B0'}</Text>
              <Text style={styles.currentTempLow}> / {today.minTemp}{'\u00B0'}</Text>
            </View>
          ) : null}
          {today ? (
            <Text style={styles.conditionText}>{today.condition}</Text>
          ) : null}
        </View>
        <View style={styles.bigIconWrap}>
          <BigIcon color={bigIconColor} size={44} strokeWidth={1.5} />
        </View>
      </View>

      {/* Rain warning chip */}
      {todayRain && (
        <View style={styles.rainChip}>
          <Droplets size={14} color={colors.warnInk} />
          <Text style={styles.rainChipText}>
            Rain expected {formatHourRange(todayRain.startHour, todayRain.endHour)} {'\u00B7'} {todayRain.maxChance}% chance
          </Text>
        </View>
      )}

      {/* 5-day forecast */}
      <View style={styles.daysRow}>
        {days.map((d, i) => {
          const { Icon: WeatherIcon, color: iconColor } = iconForCondition(d.condition);
          const isToday = i === 0;
          return (
            <View key={d.date} style={[styles.dayCol, isToday && styles.dayColToday]}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {d.dayLabel}
              </Text>
              <View style={styles.iconWrap}>
                <WeatherIcon color={iconColor} size={22} strokeWidth={1.75} />
              </View>
              <Text style={styles.maxTemp}>{d.maxTemp}{'\u00B0'}</Text>
              <Text style={styles.minTemp}>{d.minTemp}{'\u00B0'}</Text>
              {d.chanceRain > 0 && (
                <Text style={styles.rainPct}>{d.chanceRain}%</Text>
              )}
            </View>
          );
        })}
      </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  currentTemp: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  currentTempLow: {
    color: colors.text3,
    fontSize: 16,
    fontWeight: '500',
  },
  conditionText: {
    color: colors.text2,
    fontSize: 12,
    marginTop: 2,
  },
  bigIconWrap: {
    marginTop: 4,
  },
  rainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warnBg,
    borderColor: colors.warnBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  rainChipText: {
    color: colors.warnInk,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCol: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dayColToday: {
    backgroundColor: colors.accentDim,
  },
  dayLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dayLabelToday: {
    color: colors.accent,
    fontWeight: '800',
  },
  iconWrap: {
    marginBottom: 6,
    alignItems: 'center',
  },
  maxTemp: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  minTemp: {
    color: colors.text3,
    fontSize: 12,
    marginTop: 1,
  },
  rainPct: {
    color: colors.info,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
});
