import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sparkles, Star } from 'lucide-react-native';
import { useTheme, ThemeColors } from '@/constants/ThemeContext';

interface TripCompletedCardProps {
  destination: string;
  nights: number;
  momentCount: number;
  onViewMemory: () => void;
}

export function TripCompletedCard({ destination, nights, momentCount, onViewMemory }: TripCompletedCardProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={s.card}>
      <View style={s.glow} />
      <View style={s.inner}>
        <View style={s.iconRow}>
          <Star size={20} color={colors.accent} fill={colors.accent} />
        </View>
        <Text style={s.title}>Your trip is complete!</Text>
        <Text style={s.subtitle}>
          {destination} · {nights} nights{momentCount > 0 ? ` · ${momentCount} moments captured` : ''}
        </Text>
        <TouchableOpacity style={s.cta} onPress={onViewMemory} activeOpacity={0.7}>
          <Sparkles size={14} color={colors.bg} strokeWidth={2} />
          <Text style={s.ctaText}>View Trip Memory</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  inner: { padding: 20, alignItems: 'center' },
  iconRow: { marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: c.text3, marginTop: 4, textAlign: 'center' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: c.accent, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20,
    ...Platform.select({
      ios: { shadowColor: c.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  ctaText: { fontSize: 14, fontWeight: '600', color: c.bg },
});
