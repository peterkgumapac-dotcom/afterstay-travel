import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { ChevronDown, Droplets, Sun, Thermometer, Umbrella, Wind } from 'lucide-react-native';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import MiniLoader from '@/components/loader/MiniLoader';
import { CONFIG } from '../../lib/config';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  humidity: number;
  windKph: number;
  rainWindows: { startHour: number; endHour: number; maxChance: number }[];
  sunrise?: string;
  sunset?: string;
  uvIndex: number;
}

interface CurrentWeather {
  temp: number;
  condition: string;
  feelsLike: number;
  humidity: number;
  windKph: number;
}

/* ── Advisory tips based on weather data ── */

interface Advisory {
  icon: React.ReactNode;
  text: string;
  color: string;
}

function getAdvisories(today: DayForecast, current: CurrentWeather | null, colors: ThemeColors): Advisory[] {
  const tips: Advisory[] = [];

  // Rain advisory
  if (today.rainWindows.length > 0) {
    const worst = today.rainWindows.reduce((a, b) => (a.maxChance > b.maxChance ? a : b));
    tips.push({
      icon: <Umbrella size={14} color={colors.info} strokeWidth={2} />,
      text: `Bring an umbrella — ${worst.maxChance}% rain chance ${formatHourRange(worst.startHour, worst.endHour)}`,
      color: colors.info,
    });
  } else if (today.chanceRain >= 30) {
    tips.push({
      icon: <Droplets size={14} color={colors.info} strokeWidth={2} />,
      text: `Light rain possible today (${today.chanceRain}% chance)`,
      color: colors.info,
    });
  }

  // Heat advisory
  if (today.maxTemp >= 33) {
    tips.push({
      icon: <Thermometer size={14} color={colors.coral} strokeWidth={2} />,
      text: `Hot day ahead (${today.maxTemp}°C) — stay hydrated and wear sunscreen`,
      color: colors.coral,
    });
  }

  // UV advisory
  if (today.uvIndex >= 8) {
    tips.push({
      icon: <Sun size={14} color={colors.warn} strokeWidth={2} />,
      text: `Very high UV (${today.uvIndex}) — limit sun exposure 10AM–3PM`,
      color: colors.warn,
    });
  } else if (today.uvIndex >= 6) {
    tips.push({
      icon: <Sun size={14} color={colors.gold} strokeWidth={2} />,
      text: `High UV today (${today.uvIndex}) — apply sunscreen if heading out`,
      color: colors.gold,
    });
  }

  // Wind advisory
  if (today.windKph >= 40 || (current && current.windKph >= 40)) {
    tips.push({
      icon: <Wind size={14} color={colors.text2} strokeWidth={2} />,
      text: `Windy conditions (${Math.round(today.windKph)} km/h) — be careful near the water`,
      color: colors.text2,
    });
  }

  // Perfect weather
  if (tips.length === 0 && today.maxTemp >= 25 && today.maxTemp <= 32 && today.chanceRain < 20) {
    tips.push({
      icon: <Sun size={14} color="#fbbf24" strokeWidth={2} />,
      text: 'Perfect weather today — great day to explore!',
      color: '#fbbf24',
    });
  }

  return tips;
}

/* ── Weather SVG icons ── */

function WeatherIcon({ kind, size = 22, color }: { kind: string; size?: number; color: string }) {
  const c = kind.toLowerCase();
  if (c.includes('sunny') || c.includes('clear')) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={1.8} />
        <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M7 14a4 4 0 110-8 6 6 0 0111.6 2A3.5 3.5 0 0117 14z" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M9 18v2M13 18v2M17 18v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }
  if (c.includes('thunder') || c.includes('storm')) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M7 14a4 4 0 110-8 6 6 0 0111.6 2A3.5 3.5 0 0117 14z" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M13 14l-2 4h4l-2 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={8} cy={8} r={3} stroke={color} strokeWidth={1.8} />
      <Path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.8 3.8l.7.7M12.2 12.2l.7.7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M18 20a4 4 0 100-8 6 6 0 00-10.5-2.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function getIconColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes('sunny') || c.includes('clear')) return '#fbbf24';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('thunder')) return '#60a5fa';
  return '#94a3b8';
}

const formatHourRange = (start: number, end: number): string => {
  const fmt = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12} ${ampm}`;
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
  if (inWindow) windows.push({ startHour, endHour: 23, maxChance });
  return windows;
};

const dayLabelFor = (dateStr: string, index: number): string => {
  if (index === 0) return 'TODAY';
  if (index === 1) return 'TMR';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
};

interface WeatherForecastCardProps {
  destination?: string;
}

export const WeatherForecastCard: React.FC<WeatherForecastCardProps> = ({ destination }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [days, setDays] = useState<DayForecast[]>([]);
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const chevronAnim = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    loadForecast(cancelled);
    return () => { cancelled = true; };
  }, [destination]);

  const loadForecast = async (cancelled = false) => {
    try {
      const location = destination || '11.9710,121.9215';
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${CONFIG.WEATHER_KEY}&q=${encodeURIComponent(location)}&days=5&aqi=no&alerts=no`,
      );
      const data = await res.json();

      if (data.error || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (data.current && !cancelled) {
        setCurrent({
          temp: Math.round(data.current.temp_c),
          condition: data.current.condition?.text ?? '',
          feelsLike: Math.round(data.current.feelslike_c),
          humidity: data.current.humidity ?? 0,
          windKph: data.current.wind_kph ?? 0,
        });
      }

      const forecasts: DayForecast[] = data.forecast.forecastday.map(
        (fd: any, i: number) => {
          const hours: HourData[] = fd.hour.map((h: any) => ({
            hour: new Date(h.time).getHours(),
            chance_of_rain: h.chance_of_rain,
          }));
          return {
            date: fd.date,
            dayLabel: dayLabelFor(fd.date, i),
            maxTemp: Math.round(fd.day.maxtemp_c),
            minTemp: Math.round(fd.day.mintemp_c),
            chanceRain: fd.day.daily_chance_of_rain,
            condition: fd.day.condition.text,
            humidity: fd.day.avghumidity ?? 0,
            windKph: fd.day.maxwind_kph ?? 0,
            rainWindows: findRainWindows(hours),
            sunrise: fd.astro?.sunrise,
            sunset: fd.astro?.sunset,
            uvIndex: fd.day?.uv ?? 0,
          };
        },
      );

      if (!cancelled) setDays(forecasts);
    } catch {
      // Card won't render
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !expanded;
    setExpanded(next);
    chevronAnim.value = withSpring(next ? 1 : 0, { damping: 18, stiffness: 140 });
  }, [expanded, chevronAnim]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronAnim.value * 180}deg` }],
  }));

  if (loading) {
    return (
      <View style={styles.card}>
        <MiniLoader size={40} message="Reading the skies\u2026" />
      </View>
    );
  }

  if (days.length === 0) return null;

  const today = days[0];
  const bigIconColor = getIconColor(today.condition);
  const advisories = getAdvisories(today, current, colors);

  return (
    <View style={styles.card}>
      {/* Header — always visible */}
      <Pressable onPress={toggleExpand} style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>WEATHER</Text>
          <View style={styles.tempRow}>
            <WeatherIcon kind={today.condition} size={32} color={bigIconColor} />
            <Text style={styles.tempBig}>{current?.temp ?? today.maxTemp}°</Text>
            <Text style={styles.tempLow}> / {today.minTemp}°</Text>
          </View>
          <Text style={styles.conditionText}>
            {today.condition} · Feels {current?.feelsLike ?? today.maxTemp}°
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={18} color={colors.text3} strokeWidth={2} />
        </Animated.View>
      </Pressable>

      {/* Advisories — always visible if any */}
      {advisories.length > 0 && (
        <View style={styles.advisories}>
          {advisories.map((tip, i) => (
            <View key={i} style={styles.advisoryRow}>
              {tip.icon}
              <Text style={[styles.advisoryText, { color: colors.text }]}>{tip.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Expanded content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Current conditions row */}
          {current && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Droplets size={13} color={colors.text3} strokeWidth={2} />
                <Text style={styles.statValue}>{current.humidity}%</Text>
                <Text style={styles.statLabel}>Humidity</Text>
              </View>
              <View style={styles.statItem}>
                <Wind size={13} color={colors.text3} strokeWidth={2} />
                <Text style={styles.statValue}>{Math.round(current.windKph)}</Text>
                <Text style={styles.statLabel}>km/h</Text>
              </View>
              <View style={styles.statItem}>
                <Sun size={13} color={colors.text3} strokeWidth={2} />
                <Text style={styles.statValue}>{today.uvIndex}</Text>
                <Text style={styles.statLabel}>UV</Text>
              </View>
              {today.sunrise && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { fontSize: 11 }]}>{today.sunrise}</Text>
                  <Text style={styles.statLabel}>Sunrise</Text>
                </View>
              )}
              {today.sunset && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { fontSize: 11 }]}>{today.sunset}</Text>
                  <Text style={styles.statLabel}>Sunset</Text>
                </View>
              )}
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* 5-day forecast */}
          <Text style={[styles.eyebrow, { marginBottom: 10 }]}>5-DAY FORECAST</Text>
          {days.map((d, i) => {
            const iconColor = getIconColor(d.condition);
            const isToday = i === 0;
            return (
              <View key={d.date} style={[styles.forecastRow, isToday && styles.forecastRowToday]}>
                <Text style={[styles.forecastDay, isToday && { color: colors.accent }]}>
                  {d.dayLabel}
                </Text>
                <WeatherIcon kind={d.condition} size={18} color={iconColor} />
                <Text style={styles.forecastCondition} numberOfLines={1}>{d.condition}</Text>
                {d.chanceRain >= 30 && (
                  <Text style={styles.forecastRain}>{d.chanceRain}%</Text>
                )}
                <View style={styles.forecastTemps}>
                  <Text style={styles.forecastHi}>{d.maxTemp}°</Text>
                  <Text style={styles.forecastLo}>{d.minTemp}°</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: ThemeColors) =>
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
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    tempRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    tempBig: {
      fontSize: 36,
      fontWeight: '500',
      letterSpacing: -0.8,
      color: colors.text,
    },
    tempLow: {
      fontSize: 14,
      color: colors.text3,
    },
    conditionText: {
      fontSize: 12,
      color: colors.text2,
      marginTop: 2,
    },

    /* Advisories */
    advisories: {
      marginTop: 12,
      gap: 6,
    },
    advisoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card2,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
    },
    advisoryText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '500',
    },

    /* Expanded */
    expandedContent: {
      marginTop: 14,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
    },
    statItem: {
      alignItems: 'center',
      gap: 3,
      flex: 1,
    },
    statValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    statLabel: {
      fontSize: 9,
      color: colors.text3,
      fontWeight: '500',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 14,
    },

    /* 5-day forecast rows */
    forecastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 10,
    },
    forecastRowToday: {
      backgroundColor: colors.accentBg,
    },
    forecastDay: {
      width: 38,
      fontSize: 11,
      fontWeight: '700',
      color: colors.text2,
      letterSpacing: 0.5,
    },
    forecastCondition: {
      flex: 1,
      fontSize: 12,
      color: colors.text2,
    },
    forecastRain: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.info,
    },
    forecastTemps: {
      flexDirection: 'row',
      gap: 4,
      width: 52,
      justifyContent: 'flex-end',
    },
    forecastHi: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    forecastLo: {
      fontSize: 12,
      color: colors.text3,
    },
  });
