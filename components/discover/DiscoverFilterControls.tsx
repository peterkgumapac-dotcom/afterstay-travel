import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export const FilterRow = React.memo(function FilterRow({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: colors.text3, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
    </View>
  );
});

const segStyles = (colors: ThemeColors) => StyleSheet.create({
  seg: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  segActive: { borderColor: colors.black, backgroundColor: colors.black },
  segText: { fontSize: 11.5, fontWeight: '600', color: colors.text },
  segTextActive: { color: colors.onBlack },
});

export const SegBtn = React.memo(function SegBtn({
  active,
  onPress,
  children,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  const s = segStyles(colors);
  return (
    <TouchableOpacity onPress={onPress} style={[s.seg, active && s.segActive]} activeOpacity={0.7}>
      <Text style={[s.segText, active && s.segTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
});
