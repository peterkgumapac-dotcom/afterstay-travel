import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  FadeIn,
} from 'react-native-reanimated';
import { Camera, MapPin, Share2, Sparkles, Star, Wallet } from 'lucide-react-native';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { formatCurrency } from '@/lib/utils';

interface TripCompletedCardProps {
  destination: string;
  nights: number;
  momentCount: number;
  placesCount?: number;
  totalSpent?: number;
  currency?: string;
  onViewMemory: () => void;
  onShare?: () => void;
}

function CelebrationStar({ delay, x, y, colors }: { delay: number; x: number; y: number; colors: ThemeColors }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.2, { duration: 1200 }),
        ),
        -1,
        true,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.6, { duration: 1200 }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top: y, left: x }, animStyle]}>
      <Star size={10} color={colors.accent} fill={colors.accent} />
    </Animated.View>
  );
}

export function TripCompletedCard({
  destination,
  nights,
  momentCount,
  placesCount = 0,
  totalSpent = 0,
  currency = 'PHP',
  onViewMemory,
  onShare,
}: TripCompletedCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const stats = [
    momentCount > 0 && { icon: Camera, label: `${momentCount} moments` },
    placesCount > 0 && { icon: MapPin, label: `${placesCount} places` },
    totalSpent > 0 && { icon: Wallet, label: formatCurrency(totalSpent, currency) },
  ].filter(Boolean) as { icon: typeof Camera; label: string }[];

  return (
    <Animated.View entering={FadeIn.duration(500)} style={s.card}>
      {/* Celebration sparkles */}
      <CelebrationStar delay={0} x={20} y={12} colors={colors} />
      <CelebrationStar delay={400} x={60} y={6} colors={colors} />
      <CelebrationStar delay={800} x={200} y={10} colors={colors} />
      <CelebrationStar delay={200} x={240} y={18} colors={colors} />
      <CelebrationStar delay={600} x={280} y={8} colors={colors} />

      <View style={s.glow} />
      <View style={s.glowLeft} />
      <View style={s.inner}>
        <View style={s.iconRow}>
          <Star size={22} color={colors.accent} fill={colors.accent} />
        </View>
        <Text style={s.title}>Your trip is complete!</Text>
        <Text style={s.subtitle}>
          {destination} · {nights} nights
        </Text>

        {/* Stats row */}
        {stats.length > 0 && (
          <View style={s.statsRow}>
            {stats.map((stat, i) => (
              <View key={i} style={s.statPill}>
                <stat.icon size={12} color={colors.accent} strokeWidth={2} />
                <Text style={s.statText}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTAs */}
        <View style={s.ctaRow}>
          <TouchableOpacity style={s.cta} onPress={onViewMemory} activeOpacity={0.7}>
            <Sparkles size={14} color={colors.bg} strokeWidth={2} />
            <Text style={s.ctaText}>View Your Story</Text>
          </TouchableOpacity>
          {onShare && (
            <TouchableOpacity style={s.ctaSecondary} onPress={onShare} activeOpacity={0.7}>
              <Share2 size={14} color={colors.accent} strokeWidth={2} />
              <Text style={s.ctaSecondaryText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    marginHorizontal: 16, borderRadius: 22, overflow: 'hidden',
    backgroundColor: c.card, borderWidth: 1, borderColor: c.accentBorder,
  },
  glow: {
    position: 'absolute', top: -40, right: -40, width: 140, height: 140,
    borderRadius: 999, backgroundColor: `${c.accent}28`,
  },
  glowLeft: {
    position: 'absolute', bottom: -30, left: -30, width: 100, height: 100,
    borderRadius: 999, backgroundColor: `${c.accent}14`,
  },
  inner: { padding: 22, alignItems: 'center' },
  iconRow: { marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: c.text3, marginTop: 4, textAlign: 'center' },
  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginTop: 14,
  },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: c.accentBg, borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: c.accentBorder,
  },
  statText: { fontSize: 11, fontWeight: '600', color: c.text2 },
  ctaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.accent, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20,
    ...Platform.select({
      ios: { shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  ctaText: { fontSize: 14, fontWeight: '600', color: c.bg },
  ctaSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: c.accentBorder, backgroundColor: c.accentBg,
  },
  ctaSecondaryText: { fontSize: 14, fontWeight: '600', color: c.accent },
});
