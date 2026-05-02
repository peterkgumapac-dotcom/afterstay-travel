import { Camera, Compass, Plane } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { AchievementBadge } from '@/lib/profileStats';

interface AchievementBadgesProps {
  badges: AchievementBadge[];
}

const ICONS = {
  camera: Camera,
  compass: Compass,
  plane: Plane,
};

export default function AchievementBadges({ badges }: AchievementBadgesProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  if (badges.length === 0) return null;

  return (
    <View style={s.row}>
      {badges.map((badge) => {
        const Icon = ICONS[badge.icon as keyof typeof ICONS] ?? Compass;
        return (
          <View key={badge.key} style={s.card}>
            <View style={s.medal}>
              <Icon size={23} color={colors.accent} strokeWidth={1.9} />
            </View>
            <Text style={s.title}>{badge.title}</Text>
            <Text style={s.description}>{badge.description}</Text>
          </View>
        );
      })}
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 124,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  medal: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 3,
  },
});
