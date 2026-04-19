import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Compass, MapPin } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';

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
  destination = 'Boracay',
  hotelName = 'Canyon Hotels',
  distance = '2.1 km',
  travelTime = '12 min by van',
  onStart,
}: ArrivedCardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

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
      <View style={styles.headerRow}>
        <Animated.View style={[styles.iconContainer, bounceStyle]}>
          <MapPin size={22} color={CREAM} />
        </Animated.View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Welcome to {destination}</Text>
          <Text style={styles.display}>You've arrived</Text>
          <Text style={styles.subtitle}>
            Check-in at {hotelName} {'\u00B7'} {distance} {'\u00B7'} {travelTime}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Pressable
        style={styles.ctaButton}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel="Explore now"
      >
        <View style={styles.ctaIconCircle}>
          <Compass size={16} color={CREAM} />
        </View>
        <View style={styles.ctaTextGroup}>
          <Text style={styles.ctaEyebrow}>I'm at the hotel</Text>
          <Text style={styles.ctaLabel}>Explore now</Text>
        </View>
        <ChevronRight size={18} color={CREAM} />
      </Pressable>
    </LinearGradient>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      paddingVertical: 18,
      paddingHorizontal: spacing.xl,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
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
      letterSpacing: -0.4,
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
      marginVertical: spacing.lg,
    },
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: CTA_BG,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      shadowColor: CTA_BG,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 18,
      elevation: 6,
    },
    ctaIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,250,240,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,250,240,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaTextGroup: {
      flex: 1,
      marginLeft: spacing.md,
    },
    ctaEyebrow: {
      color: CREAM,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.6,
      opacity: 0.85,
    },
    ctaLabel: {
      color: CREAM,
      fontSize: 15,
      fontWeight: '600',
      marginTop: 1,
    },
  });
