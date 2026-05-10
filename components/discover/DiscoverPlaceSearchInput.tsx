import React from 'react';
import { TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';

import type { getDiscoverStyles } from './discoverScreenStyles';

type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;
type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface Props {
  colors: ThemeColors;
  query: string;
  styles: DiscoverStyles;
  onChangeQuery: (query: string) => void;
}

export default function DiscoverPlaceSearchInput({
  colors,
  query,
  styles,
  onChangeQuery,
}: Props) {
  return (
    <View style={styles.precisionInputBox}>
      <Search size={17} color={colors.text3} strokeWidth={1.8} />
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder="Search food, coffee, things to do..."
        placeholderTextColor={colors.text3}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
      />
    </View>
  );
}
