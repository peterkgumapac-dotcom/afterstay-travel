import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';

interface ArrivedCardProps {
  destination?: string;
  hotelName?: string;
  distance?: string;
  travelTime?: string;
  onStart: () => void;
}

const CREAM = '#fffaf0';
const CTA_BG = '#3d2416';

export function ArrivedCard({
  destination = '',
  hotelName = '',
  distance = '',
  travelTime = '',
  onStart,
}: ArrivedCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const bounceY = useSharedValue(0);

  useEffect(() => {
    bounceY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [bounceY]);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bounceY.value }],
  }));

  return (
    <LinearGradient
      colors={[colors.accentBg, colors.card]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Animated.View style={[styles.iconContainer, bounceStyle]}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 22s-8-7-8-13a8 8 0 0116 0c0 6-8 13-8 13z"
              stroke={CREAM}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle
              cx={12}
              cy={9}
              r={3}
              stroke={CREAM}
              strokeWidth={2}
            />
          </Svg>
        </Animated.View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Welcome to {destination}</Text>
          <Text style={styles.display}>You've arrived</Text>
          <Text style={styles.subtitle}>
            Check-in at {hotelName} {'\u00B7'} {distance} {'\u00B7'} {travelTime}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Manual Start Trip CTA */}
      <Pressable
        style={styles.ctaButton}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Explore now"
      >
        <View style={styles.ctaRow}>
          <View style={styles.ctaIconCircle}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle
                cx={12}
                cy={12}
                r={9}
                stroke={CREAM}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M15.5 8.5l-2 5-5 2 2-5z"
                fill={CREAM}
              />
            </Svg>
          </View>
          <View>
            <Text style={styles.ctaEyebrow}>I'm at the hotel</Text>
            <Text style={styles.ctaLabel}>Explore now</Text>
          </View>
        </View>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14M13 5l7 7-7 7"
            stroke={CREAM}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </LinearGradient>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: 18,
      marginHorizontal: 16,
      gap: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1.8,
    },
    display: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '500',
      letterSpacing: -0.02 * 20,
      marginTop: 2,
    },
    subtitle: {
      color: colors.text3,
      fontSize: 11,
      marginTop: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.accentBorder,
      opacity: 0.6,
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: CTA_BG,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      shadowColor: 'rgba(61, 36, 22, 1)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 18,
      elevation: 6,
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    ctaIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 99,
      backgroundColor: 'rgba(255,250,240,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,250,240,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaEyebrow: {
      color: CREAM,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.16 * 10,
      opacity: 0.85,
    },
    ctaLabel: {
      color: CREAM,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.01 * 15,
      marginTop: 1,
    },
  });
