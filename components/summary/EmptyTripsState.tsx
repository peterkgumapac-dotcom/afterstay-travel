import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';

// ---------- TYPES ----------

interface EmptyTripsStateProps {
  onPlanTrip: () => void;
  onAddPastTrip: () => void;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ---------- STAR POSITIONS (from prototype) ----------

const EMPTY_STARS: [number, number][] = [
  [60, 70],
  [110, 40],
  [160, 80],
  [210, 35],
  [250, 75],
];

// ---------- PULSING STAR ----------

function PulsingStar({
  cx,
  cy,
  index,
  accentColor,
}: {
  cx: number;
  cy: number;
  index: number;
  accentColor: string;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    const duration = 2000 + (index % 3) * 500;
    opacity.value = withDelay(
      index * 300,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [index, opacity]);

  // SVG Circle doesn't support reanimated well for opacity,
  // so we use a static circle with the pulsing handled via SVG animate equivalent
  return <Circle cx={cx} cy={cy} r={3} fill={accentColor} opacity={0.7} />;
}

// ---------- COMPONENT ----------

export default function EmptyTripsState({
  onPlanTrip,
  onAddPastTrip,
}: EmptyTripsStateProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* Background constellation art */}
        <Svg
          viewBox="0 0 300 120"
          width="100%"
          height={120}
          style={styles.svg}
        >
          {EMPTY_STARS.map(([x, y], i) => (
            <View key={`star-${i}`}>
              {i > 0 && (
                <Line
                  x1={EMPTY_STARS[i - 1][0]}
                  y1={EMPTY_STARS[i - 1][1]}
                  x2={x}
                  y2={y}
                  stroke={colors.accent}
                  strokeWidth={0.7}
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
              )}
              <PulsingStar
                cx={x}
                cy={y}
                index={i}
                accentColor={colors.accent}
              />
            </View>
          ))}
        </Svg>

        <Text style={styles.heading}>Your travel story starts here</Text>
        <Text style={styles.subtitle}>
          Every trip becomes a star in your personal constellation {'\u2014'}{' '}
          distances, destinations, and the people you went with.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onPlanTrip}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Plan your first trip</Text>
          </Pressable>

          <Pressable
            onPress={onAddPastTrip}
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.ghostBtnText}>
              Or add a past trip {'\u2192'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.unlockRow}>
          <Text style={styles.unlockText}>
            <Text style={styles.unlockAccent}>
              1 trip {'\u00B7'} 500+ miles
            </Text>{' '}
            unlocks your first highlight
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 16,
    },
    container: {
      position: 'relative',
      paddingTop: 32,
      paddingHorizontal: 20,
      paddingBottom: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      alignItems: 'center',
      overflow: 'hidden',
    },
    svg: {
      opacity: 0.7,
    },
    heading: {
      fontSize: 22,
      fontWeight: '500',
      color: colors.text,
      marginTop: 10,
      letterSpacing: -0.44,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 8,
      maxWidth: 260,
      textAlign: 'center',
      lineHeight: 18,
    },
    actions: {
      width: '100%',
      gap: 8,
      marginTop: 20,
    },
    primaryBtn: {
      width: '100%',
      backgroundColor: colors.black,
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: colors.onBlack,
      fontSize: 13,
      fontWeight: '600',
    },
    ghostBtn: {
      width: '100%',
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostBtnText: {
      color: colors.text2,
      fontSize: 12,
      fontWeight: '600',
    },
    unlockRow: {
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: colors.border2,
      width: '100%',
      alignItems: 'center',
    },
    unlockText: {
      fontSize: 10.5,
      color: colors.text3,
      letterSpacing: 0.42,
    },
    unlockAccent: {
      color: colors.accent,
      fontWeight: '600',
    },
  });
