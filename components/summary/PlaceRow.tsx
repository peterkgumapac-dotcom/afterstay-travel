import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import type { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export type PlaceSource = 'moment' | 'expense' | 'discover';

interface PlaceRowProps {
  name: string;
  category?: string;
  source: PlaceSource;
  colors: ThemeColors;
}

const SOURCE_LABELS: Record<PlaceSource, string> = {
  moment: 'Photo',
  expense: 'Receipt',
  discover: 'Saved',
};

export default function PlaceRow({ name, category, source, colors }: PlaceRowProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <MapPin size={14} color={colors.accent} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {category ? (
        <View style={styles.catPill}>
          <Text style={styles.catText}>{category}</Text>
        </View>
      ) : null}
      <View style={styles.sourcePill}>
        <Text style={styles.sourceText}>{SOURCE_LABELS[source]}</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.accentBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    catPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.card2,
    },
    catText: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.text3,
    },
    sourcePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: colors.accentDim,
    },
    sourceText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.accent,
    },
  });
