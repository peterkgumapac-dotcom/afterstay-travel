import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Bell, CheckCircle } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';
import { formatCurrency } from '@/lib/utils';

type StatusVariant = 'cruising' | 'low' | 'over';

interface BudgetStatusBannerProps {
  status: StatusVariant;
  remaining: number;
  daysLeft: number;
  currency?: string;
}

interface StatusConfig {
  gradient: readonly [string, string];
  border: string;
  accent: string;
  eyebrow: string;
  title: string;
  sub: string;
}

function getStatusConfig(
  status: StatusVariant,
  remaining: number,
  daysLeft: number,
): StatusConfig {
  switch (status) {
    case 'cruising':
      return {
        gradient: ['rgba(126, 204, 140, 0.18)', 'rgba(198, 106, 54, 0.10)'],
        border: 'rgba(126, 204, 140, 0.55)',
        accent: '#3e8f54',
        eyebrow: 'All good',
        title: "You're cruising",
        sub: `${formatCurrency(remaining, 'PHP')} left \u00B7 pacing ahead of plan`,
      };
    case 'low':
      return {
        gradient: ['rgba(230, 170, 60, 0.20)', 'rgba(198, 106, 54, 0.12)'],
        border: 'rgba(230, 170, 60, 0.6)',
        accent: '#b07a14',
        eyebrow: 'Low balance',
        title: 'Watch your pace',
        sub: `Only ${formatCurrency(remaining, 'PHP')} left for ${daysLeft} more days`,
      };
    case 'over':
      return {
        gradient: ['rgba(214, 90, 60, 0.22)', 'rgba(127, 55, 18, 0.16)'],
        border: 'rgba(214, 90, 60, 0.65)',
        accent: '#c44d2c',
        eyebrow: 'Over budget',
        title: 'Time to ease off',
        sub: `${formatCurrency(Math.abs(remaining), 'PHP')} over your trip cap`,
      };
  }
}

function CruisingIcon({ color }: { color: string }) {
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <CheckCircle size={20} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

function LowIcon({ color }: { color: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 100, easing: Easing.linear }),
        withTiming(14, { duration: 100, easing: Easing.linear }),
        withTiming(-10, { duration: 80, easing: Easing.linear }),
        withTiming(10, { duration: 80, easing: Easing.linear }),
        withTiming(-4, { duration: 60, easing: Easing.linear }),
        withTiming(0, { duration: 60, easing: Easing.linear }),
        withTiming(0, { duration: 1520 }),
      ),
      -1,
    );
  }, [rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Bell size={20} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

function OverIcon({ color }: { color: string }) {
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <AlertTriangle size={20} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}

function StatusIcon({ status, color }: { status: StatusVariant; color: string }) {
  switch (status) {
    case 'cruising':
      return <CruisingIcon color={color} />;
    case 'low':
      return <LowIcon color={color} />;
    case 'over':
      return <OverIcon color={color} />;
  }
}

function ShimmerOverlay() {
  const translateX = useSharedValue(-120);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(400, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(-120, { duration: 0 }),
      ),
      -1,
    );
  }, [translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.shimmer, animStyle]} pointerEvents="none" />
  );
}

export default function BudgetStatusBanner({
  status,
  remaining,
  daysLeft,
  currency = '\u20B1',
}: BudgetStatusBannerProps) {
  const { colors } = useTheme();
  const config = getStatusConfig(status, remaining, daysLeft);

  return (
    <View style={[styles.wrapper, { borderColor: config.border }]}>
      <LinearGradient
        colors={[config.gradient[0], config.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {status === 'cruising' && <ShimmerOverlay />}

        <View style={styles.row}>
          <View style={[styles.iconBox, { borderColor: config.border }]}>
            <StatusIcon status={status} color={config.accent} />
          </View>

          <View style={styles.textContent}>
            <Text style={[styles.eyebrow, { color: config.accent }]}>
              {config.eyebrow}
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              {config.title}
            </Text>
            <Text style={[styles.sub, { color: colors.text3 }]}>
              {config.sub}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    transform: [{ skewX: '-15deg' }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    gap: 1,
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11,
    lineHeight: 15,
  },
});
