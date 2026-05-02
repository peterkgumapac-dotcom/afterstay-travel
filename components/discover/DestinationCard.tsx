import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CalendarDays, ChevronDown, ChevronUp, Cloud, MapPin, Sparkles, Wallet } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getDestinationOverview } from '@/lib/supabase';
import type { DestinationOverview } from '@/lib/types';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface Props {
  destination: string;
  coords?: { lat: number; lng: number } | null;
}

export default function DestinationCard({ destination, coords }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = getStyles(colors);
  const [data, setData] = useState<DestinationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    const key = `dest_overview_${destination.toLowerCase().trim()}`;

    (async () => {
      setLoading(true);
      setData(null);

      // Check local cache first
      const cached = await cacheGet<{ data: DestinationOverview; ts: number }>(key);
      if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        if (!cancelled) { setData(cached.data); setLoading(false); }
        return;
      }

      const overview = await getDestinationOverview(destination);
      if (!cancelled) {
        setData(overview);
        setLoading(false);
        if (overview) {
          cacheSet(key, { data: overview, ts: Date.now() });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [destination]);

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={[styles.skeletonLine, { width: '80%', marginTop: 8 }]} />
      </View>
    );
  }

  if (!data) return null;

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed((c) => !c)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Expand destination info' : 'Collapse destination info'}
      >
        <View style={styles.headerLeft}>
          <Sparkles size={14} color={colors.accent} />
          <Text style={styles.headerTitle}>{destination}</Text>
        </View>
        {collapsed
          ? <ChevronDown size={16} color={colors.text3} />
          : <ChevronUp size={16} color={colors.text3} />}
      </TouchableOpacity>

      {/* Summary — always visible */}
      <Text style={styles.summary}>{data.summary}</Text>

      {!collapsed && (
        <>
          {/* Highlights */}
          {data.highlights.length > 0 && (
            <View style={styles.highlightsWrap}>
              {data.highlights.map((h, i) => (
                <View key={i} style={styles.highlightChip}>
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Budget row */}
          <View style={styles.budgetRow}>
            <Wallet size={12} color={colors.text3} />
            <View style={styles.budgetCol}>
              <Text style={styles.budgetLabel}>Budget</Text>
              <Text style={styles.budgetValue}>{data.budgetRange.budget}</Text>
            </View>
            <View style={styles.budgetDivider} />
            <View style={styles.budgetCol}>
              <Text style={styles.budgetLabel}>Mid</Text>
              <Text style={styles.budgetValue}>{data.budgetRange.mid}</Text>
            </View>
            <View style={styles.budgetDivider} />
            <View style={styles.budgetCol}>
              <Text style={styles.budgetLabel}>Luxury</Text>
              <Text style={styles.budgetValue}>{data.budgetRange.luxury}</Text>
            </View>
          </View>

          {/* Info row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <CalendarDays size={12} color={colors.accent} />
              <Text style={styles.infoText}>{data.bestMonths}</Text>
            </View>
            <View style={styles.infoItem}>
              <Cloud size={12} color={colors.accent} />
              <Text style={styles.infoText}>{data.weatherNote}</Text>
            </View>
          </View>

          {/* Getting there */}
          <View style={styles.infoItem}>
            <MapPin size={12} color={colors.accent} />
            <Text style={styles.infoText}>{data.gettingThere}</Text>
          </View>

          {/* Plan a trip CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => {
              const params: Record<string, string> = { destination };
              if (coords) {
                params.lat = String(coords.lat);
                params.lng = String(coords.lng);
              }
              router.push({ pathname: '/quick-trip-create', params });
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.ctaText}>Plan a trip here</Text>
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skeletonLine: {
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.bg3,
      marginBottom: 6,
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    summary: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.text2,
      marginBottom: 10,
    },
    highlightsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    highlightChip: {
      backgroundColor: colors.accentBg,
      borderRadius: radius.pill,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    highlightText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.accent,
    },
    budgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.bg3,
      borderRadius: radius.sm,
      padding: 10,
      marginBottom: 10,
    },
    budgetCol: {
      flex: 1,
      alignItems: 'center',
    },
    budgetLabel: {
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 0.6,
      color: colors.text3,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    budgetValue: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.text,
    },
    budgetDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
    },
    infoRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 8,
    },
    infoItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      flex: 1,
      marginBottom: 4,
    },
    infoText: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.text2,
      flex: 1,
    },
    ctaBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    ctaText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.bg,
    },
  });
