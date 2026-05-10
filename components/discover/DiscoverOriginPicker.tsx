import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MapPin, Navigation, Search } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';

import type { getDiscoverStyles } from './discoverScreenStyles';

type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;
type ThemeColors = ReturnType<typeof useTheme>['colors'];
type DestinationSuggestion = { placeId: string; description: string };

interface Props {
  colors: ThemeColors;
  focused: boolean;
  inputRef: React.RefObject<TextInput | null>;
  query: string;
  refinementText: string;
  results: DestinationSuggestion[];
  styles: DiscoverStyles;
  onBlur: () => void;
  onChangeQuery: (query: string) => void;
  onChooseDestination: (label: string, placeId?: string) => void;
  onFocus: () => void;
  onUseCurrentLocation: () => void;
}

export default function DiscoverOriginPicker({
  colors,
  focused,
  inputRef,
  query,
  refinementText,
  results,
  styles,
  onBlur,
  onChangeQuery,
  onChooseDestination,
  onFocus,
  onUseCurrentLocation,
}: Props) {
  const trimmedQuery = query.trim();
  const showSuggestions = focused && trimmedQuery.length >= 2;

  return (
    <View style={styles.precisionPanel}>
      <View style={styles.originChoiceRow}>
        <View style={[styles.originChoiceBtn, styles.originChoiceBtnActive]}>
          <MapPin size={16} color={colors.black} strokeWidth={2.2} />
          <Text style={[styles.originChoiceText, styles.originChoiceTextActive]}>Set precise location</Text>
        </View>
        <TouchableOpacity
          style={styles.originChoiceBtn}
          activeOpacity={0.75}
          onPress={onUseCurrentLocation}
        >
          <Navigation size={15} color={colors.accent} strokeWidth={2} />
          <Text style={styles.originChoiceText}>Current location</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.precisionInputBox}>
        <Search size={17} color={colors.text3} strokeWidth={1.8} />
        <TextInput
          ref={inputRef}
          value={query}
          onFocus={onFocus}
          onBlur={onBlur}
          onChangeText={onChangeQuery}
          onSubmitEditing={() => onChooseDestination(query)}
          placeholder="Accommodation, address, landmark, Airbnb, or exact pin"
          placeholderTextColor={colors.text3}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          spellCheck={false}
          autoCapitalize="words"
        />
      </View>
      {showSuggestions ? (
        <View style={styles.destDropdown}>
          <TouchableOpacity
            style={styles.destRow}
            onPressIn={() => onChooseDestination(query)}
            activeOpacity={0.7}
          >
            <Search size={14} color={colors.accent} strokeWidth={2} />
            <Text style={[styles.destRowText, { color: colors.text }]} numberOfLines={1}>
              Use "{trimmedQuery}" as search origin
            </Text>
          </TouchableOpacity>
          {results.slice(0, 5).map((r) => (
            <TouchableOpacity
              key={r.placeId}
              style={styles.destRow}
              onPressIn={() => onChooseDestination(r.description, r.placeId)}
              activeOpacity={0.7}
            >
              <MapPin size={14} color={colors.text3} />
              <Text style={styles.destRowText} numberOfLines={1}>{r.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <Text style={[styles.precisionHint, refinementText && { color: colors.danger }]}>
        {refinementText || 'For accurate recommendations, choose an exact place or use current GPS.'}
      </Text>
    </View>
  );
}
