import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';

type BudgetState = 'cruising' | 'low' | 'over';

interface BudgetStatusBannerProps {
  state: BudgetState;
  spent: number;
  total: number;
}

interface VariantConfig {
  gradient: readonly [string, string];
  border: string;
  accent: string;
  eyebrow: string;
  title: string;
  sub: string;
  icon: 'check' | 'bell' | 'alert';
}

function getVariant(state: BudgetState, spent: number, total: number): VariantConfig {
  const pct = Math.round((spent / total) * 100);
  const remaining = total - spent;

  switch (state) {
    case 'cruising':
      return {
        gradient: ['rgba(126, 204, 140, 0.18)', 'rgba(198, 106, 54, 0.10)'],
        border: 'rgba(126, 204, 140, 0.55)',
        accent: '#3e8f54',
        eyebrow: 'All good',
        title: "You're cruising",
        sub: `\u20B1${remaining.toLocaleString()} left \u00B7 pacing ahead of plan`,
        icon: 'check',
      };
    case 'low':
      return {
        gradient: ['rgba(230, 170, 60, 0.20)', 'rgba(198, 106, 54, 0.12)'],
        border: 'rgba(230, 170, 60, 0.6)',
        accent: '#b07a14',
        eyebrow: 'Low balance',
        title: 'Watch your pace',
        sub: `Only \u20B1${remaining.toLocaleString()} left for ${Math.max(1, 8 - Math.round(pct / 12))} more days`,
        icon: 'bell',
      };
    case 'over':
      return {
        gradient: ['rgba(214, 90, 60, 0.22)', 'rgba(127, 55, 18, 0.16)'],
        border: 'rgba(214, 90, 60, 0.65)',
        accent: '#c44d2c',
        eyebrow: 'Over budget',
        title: 'Time to ease off',
        sub: `\u20B1${Math.abs(remaining).toLocaleString()} over your trip cap`,
        icon: 'alert',
      };
  }
}

/* ---------- Icon components with animations ---------- */

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="20 6 9 17 4 12"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BellIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.7 21a2 2 0 01-3.4 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AlertIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12} y1={9} x2={12} y2={13}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12} y1={17} x2={12.01} y2={17}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ---------- Animated icon wrappers ---------- */

/** iconBob: 3s ease-in-out infinite, translateY 0 → -2 → 0 */
function CruisingIconAnimated({ color }: { color: string }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <CheckIcon color={color} />
    </Animated.View>
  );
}

/** ringBell: 2s ease-in-out infinite
 *  0%,100% rotate(0); 10%,30% rotate(-14); 20%,40% rotate(14); 50% rotate(0) */
function LowIconAnimated({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(-14, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(14, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-14, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(14, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1000 }),
      ),
      -1,
    );
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <BellIcon color={color} />
    </Animated.View>
  );
}

/** alertPulse: 1s ease-in-out infinite, scale 1 → 1.08 → 1 */
function OverIconAnimated({ color }: { color: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <AlertIcon color={color} />
    </Animated.View>
  );
}

/* ---------- Shimmer overlay for cruising ---------- */

function ShimmerOverlay() {
  const translateX = useSharedValue(-200);

  useEffect(() => {
    // shimmer: 4s ease-in-out infinite, background-position sweep
    translateX.value = withRepeat(
      withTiming(400, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
    );
  }, [translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[shimmerStyles.shimmer, style]}
      pointerEvents="none"
    />
  );
}

const shimmerStyles = StyleSheet.create({
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: 'rgba(126, 204, 140, 0.18)',
    opacity: 0.6,
  },
});

/* ---------- Banner shake for "over" state ---------- */

function ShakeWrapper({
  children,
  shouldShake,
}: {
  children: React.ReactNode;
  shouldShake: boolean;
}) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (shouldShake) {
      // shakeH: 0.5s ease-in-out
      translateX.value = withSequence(
        withTiming(-4, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withTiming(4, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withTiming(-3, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withTiming(2, { duration: 100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 100, easing: Easing.inOut(Easing.ease) }),
      );
    }
  }, [shouldShake, translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/* ---------- Banner fade-in for non-over states ---------- */

function FadeInWrapper({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-6);

  useEffect(() => {
    // bannerIn: 0.4s ease-out
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/* ---------- Main component ---------- */

export default function BudgetStatusBanner({ state, spent, total }: BudgetStatusBannerProps) {
  const { colors } = useTheme();
  const v = getVariant(state, spent, total);

  const content = (
    <View style={[styles.wrapper, { borderColor: v.border }]}>
      <LinearGradient
        colors={[v.gradient[0], v.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Shimmer / pulse backdrop */}
        {state === 'cruising' && <ShimmerOverlay />}

        <View style={styles.row}>
          {/* Icon */}
          <View style={[styles.iconBox, { borderColor: v.border }]}>
            {state === 'cruising' && <CruisingIconAnimated color={v.accent} />}
            {state === 'low' && <LowIconAnimated color={v.accent} />}
            {state === 'over' && <OverIconAnimated color={v.accent} />}
          </View>

          {/* Text */}
          <View style={styles.textContent}>
            <Text style={[styles.eyebrow, { color: v.accent }]}>
              {v.eyebrow}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {v.title}
            </Text>
            <Text style={[styles.sub, { color: colors.text3 }]}>
              {v.sub}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  if (state === 'over') {
    return <ShakeWrapper shouldShake>{content}</ShakeWrapper>;
  }

  return <FadeInWrapper>{content}</FadeInWrapper>;
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fffaf0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    // 0.16em * 9.5 = 1.52px
    letterSpacing: 1.52,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.32,
    marginTop: 2,
  },
  sub: {
    fontSize: 11,
    marginTop: 2,
  },
});
