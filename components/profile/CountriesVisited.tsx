import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { CountryVisited } from '@/lib/profileStats';

interface CountriesVisitedProps {
  countries: CountryVisited[];
}

export default function CountriesVisited({ countries }: CountriesVisitedProps) {
  const { colors } = useTheme();
  const s = getStyles(colors);

  if (countries.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {countries.slice(0, 8).map((country) => (
        <View key={`${country.code}-${country.name}`} style={s.item}>
          <Text style={s.flag}>{country.flag}</Text>
          <Text style={s.name} numberOfLines={1}>{country.name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 12,
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  flag: {
    fontSize: 34,
  },
  name: {
    color: colors.text2,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 72,
  },
});
