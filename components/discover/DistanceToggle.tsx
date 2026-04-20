import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Building2, MapPin, Footprints, Car } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius, typography } from '@/constants/theme';

interface DistanceToggleProps {
  anchor: 'hotel' | 'me';
  travelMode: 'walk' | 'car';
  onAnchorChange: (a: 'hotel' | 'me') => void;
  onTravelModeChange: (m: 'walk' | 'car') => void;
}

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>;
}

interface SplitToggleProps<T extends string> {
  options: readonly [SegmentOption<T>, SegmentOption<T>];
  active: T;
  onChange: (value: T) => void;
  activeColor: string;
  activeTextColor: string;
  inactiveTextColor: string;
}

function SplitToggle<T extends string>({
  options,
  active,
  onChange,
  activeColor,
  activeTextColor,
  inactiveTextColor,
}: SplitToggleProps<T>) {
  const { colors } = useTheme();
  const styles = getSplitStyles(colors);

  return (
    <View style={styles.track}>
      {options.map((opt) => {
        const isActive = opt.value === active;
        const color = isActive ? activeTextColor : inactiveTextColor;
        const Icon = opt.icon;

        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segment,
              isActive && { backgroundColor: activeColor },
            ]}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: isActive }}
          >
            <Icon size={13} strokeWidth={1.8} color={color} />
            <Text style={[styles.segmentLabel, { color }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ANCHOR_OPTIONS: [SegmentOption<'hotel'>, SegmentOption<'me'>] = [
  { value: 'hotel', label: 'Hotel', icon: Building2 },
  { value: 'me', label: 'Me', icon: MapPin },
];

const MODE_OPTIONS: [SegmentOption<'walk'>, SegmentOption<'car'>] = [
  { value: 'walk', label: 'Walk', icon: Footprints },
  { value: 'car', label: 'Car', icon: Car },
];

export default function DistanceToggle({
  anchor,
  travelMode,
  onAnchorChange,
  onTravelModeChange,
}: DistanceToggleProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>FROM</Text>

      <View style={styles.togglesRow}>
        <SplitToggle
          options={ANCHOR_OPTIONS}
          active={anchor}
          onChange={onAnchorChange}
          activeColor={colors.accent}
          activeTextColor={colors.ink}
          inactiveTextColor={colors.text2}
        />
        <SplitToggle
          options={MODE_OPTIONS}
          active={travelMode}
          onChange={onTravelModeChange}
          activeColor={colors.accent}
          activeTextColor={colors.ink}
          inactiveTextColor={colors.text2}
        />
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
      marginRight: spacing.sm,
    },
    togglesRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
  });

const getSplitStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.canvas,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      minHeight: 34,
    },
    segmentLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
  });
