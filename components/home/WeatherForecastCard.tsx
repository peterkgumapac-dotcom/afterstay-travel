import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/constants/ThemeContext';
import MiniLoader from '@/components/loader/MiniLoader';
import { elevation } from '@/constants/theme';
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
  sunrise?: string;
  sunset?: string;
}

interface CurrentWeather {
  temp: number;
  condition: string;
  feelsLike: number;
}

/* ── Weather SVG icons matching the prototype ── */
function WeatherIcon({
  kind,
  size = 22,
  color,
}: {
  kind: string;
  size?: number;
  color: string;
}) {
  const c = kind.toLowerCase();
  if (c.includes('sunny') || c.includes('clear')) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
        <Path
          d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 14a4 4 0 110-8 6 6 0 0111.6 2A3.5 3.5 0 0117 14z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Path
          d="M9 18v2M13 18v2M17 18v2"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // cloud-sun / partly cloudy / default
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={8} r={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M8 2v1M8 13v1M2 8h1M13 8h1M3.8 3.8l.7.7M12.2 12.2l.7.7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M18 20a4 4 0 100-8 6 6 0 00-10.5-2.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function getIconColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('sunny') || c.includes('clear')) return '#fbbf24';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('thunder'))
    return '#60a5fa';
  return '#94a3b8';
}

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

interface WeatherForecastCardProps {
  destination?: string;
}

export const WeatherForecastCard: React.FC<WeatherForecastCardProps> = ({ destination }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [days, setDays] = useState<DayForecast[]>([]);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecast();
  }, [destination]);

  const loadForecast = async () => {
    try {
      const location = destination || 'Boracay,Philippines';
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${CONFIG.WEATHER_KEY}&q=${encodeURIComponent(location)}&days=5&aqi=no&alerts=no`,
      );
      const data = await res.json();

      if (data.error) {
        setLoading(false);
        return;
      }

      if (data.current) {
        setCurrent({
          temp: Math.round(data.current.temp_c),
          condition: data.current.condition?.text ?? '',
          feelsLike: Math.round(data.current.feelslike_c),
        });
      }

      const forecasts: DayForecast[] = data.forecast.forecastday.map(
        (fd: any, i: number) => {
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
            sunrise: fd.astro?.sunrise,
            sunset: fd.astro?.sunset,
          };
        },
      );

      setDays(forecasts);
    } catch {
      // silently fail — card won't render
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <MiniLoader size={40} message="Reading the skies\u2026" />
      </View>
    );
  }

  if (days.length === 0) return null;

  const today = days[0];
  const todayRain =
    today?.rainWindows.length > 0
      ? today.rainWindows.reduce((a, b) => (a.maxChance > b.maxChance ? a : b))
      : null;

  const bigIconColor = getIconColor(today?.condition ?? '');

  return (
    <View style={styles.card}>
      {/* Header with current temp */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Weather {'\u00B7'} {destination || 'Forecast'}</Text>
          <View style={styles.tempRow}>
            <Text style={styles.tempBig}>{today.maxTemp}{'\u00B0'}</Text>
            <Text style={styles.tempLow}> / {today.minTemp}{'\u00B0'}</Text>
          </View>
          <Text style={styles.conditionText}>{today.condition}</Text>
          {today.sunrise && today.sunset && (
            <View style={styles.sunRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2v4M4.9 7.9l2.9 2.9M2 16h4M18 16h4M19.1 7.9l-2.9 2.9M12 10a6 6 0 00-6 6M18 16a6 6 0 00-6-6" stroke={colors.gold} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
              <Text style={styles.sunText}>{today.sunrise}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M12 10v4M4.9 7.9l2.9 2.9M2 16h4M18 16h4M19.1 7.9l-2.9 2.9M12 22v-4M12 10a6 6 0 00-6 6M18 16a6 6 0 00-6-6" stroke={colors.coral} strokeWidth={1.6} strokeLinecap="round" />
              </Svg>
              <Text style={styles.sunText}>{today.sunset}</Text>
            </View>
          )}
        </View>
        <View style={styles.bigIconWrap}>
          <WeatherIcon kind={today.condition} size={28} color={bigIconColor} />
        </View>
      </View>

      {/* Rain warning chip */}
      {todayRain && (
        <View style={styles.rainChip}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M7 14a4 4 0 110-8 6 6 0 0111.6 2A3.5 3.5 0 0117 14z"
              stroke={colors.warn}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
            <Path
              d="M9 18v2M13 18v2M17 18v2"
              stroke={colors.warn}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.rainChipText}>
            <Text style={styles.rainBold}>Rain expected</Text>
            {' '}today {formatHourRange(todayRain.startHour, todayRain.endHour)} {'\u00B7'} {todayRain.maxChance}% chance
          </Text>
        </View>
      )}

      {/* 5-day forecast */}
      <View style={styles.daysRow}>
        {days.map((d, i) => {
          const isToday = i === 0;
          const iconColor = getIconColor(d.condition);
          return (
            <View
              key={d.date}
              style={[
                styles.dayCol,
                isToday && styles.dayColToday,
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isToday && styles.dayLabelToday,
                ]}
              >
                {d.dayLabel}
              </Text>
              <View style={styles.dayIconWrap}>
                <WeatherIcon kind={d.condition} size={18} color={iconColor} />
              </View>
              <Text style={styles.dayHi}>
                {d.maxTemp}{'\u00B0'}{' '}
                <Text style={styles.dayLo}>{d.minTemp}{'\u00B0'}</Text>
              </Text>
              {d.chanceRain >= 50 && (
                <Text style={styles.dayRain}>{d.chanceRain}%</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 16,
      marginHorizontal: 16,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.8,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    tempRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 4,
    },
    tempBig: {
      fontSize: 36,
      fontWeight: '500',
      letterSpacing: -0.8,
      color: colors.text,
    },
    tempLow: {
      fontSize: 13,
      color: colors.text3,
    },
    conditionText: {
      fontSize: 12,
      color: colors.text2,
    },
    sunRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    sunText: {
      fontSize: 11,
      color: colors.text3,
      fontWeight: '500',
      marginRight: 8,
    },
    bigIconWrap: {
      padding: 6,
      paddingHorizontal: 8,
      backgroundColor: colors.card2,
      borderRadius: 12,
    },
    rainChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.warnBg,
      borderWidth: 1,
      borderColor: 'rgba(245, 181, 74, 0.20)',
      borderRadius: 12,
      marginBottom: 14,
    },
    rainChipText: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      fontWeight: '500',
    },
    rainBold: {
      fontWeight: '600',
      color: colors.warn,
    },
    daysRow: {
      flexDirection: 'row',
      gap: 6,
    },
    dayCol: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    dayColToday: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    dayLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.08 * 10,
      color: colors.text3,
    },
    dayLabelToday: {
      color: colors.accent,
    },
    dayIconWrap: {
      marginVertical: 6,
    },
    dayHi: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
    },
    dayLo: {
      fontWeight: '400',
      color: colors.text3,
    },
    dayRain: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.info,
      marginTop: 2,
    },
  });
