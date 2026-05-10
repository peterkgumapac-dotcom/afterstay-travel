import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';

import type { getDiscoverStyles } from './discoverScreenStyles';

type DiscoverStyles = ReturnType<typeof getDiscoverStyles>;
type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface Props {
  colors: ThemeColors;
  label: string;
  styles: DiscoverStyles;
  onChange: () => void;
}

export default function DiscoverOriginStatus({
  colors,
  label,
  styles,
  onChange,
}: Props) {
  return (
    <View style={styles.originStatusStrip}>
      <MapPin size={16} color={colors.accent} strokeWidth={2} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.originStatusLabel}>Searching near</Text>
        <Text style={styles.originStatusValue} numberOfLines={1}>{label}</Text>
      </View>
      <TouchableOpacity activeOpacity={0.7} onPress={onChange}>
        <Text style={styles.originChangeText}>Change</Text>
      </TouchableOpacity>
    </View>
  );
}
