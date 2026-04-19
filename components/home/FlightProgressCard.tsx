import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
} from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';

/* ── Brand constants ── */
const ESPRESSO = '#3d2416';
const CREAM = '#fffaf0';
const GREEN = '#4fb372';
const GREEN_DARK = '#2f7a46';
const GREEN_BG = 'rgba(125, 220, 150, 0.14)';
const GREEN_BORDER = 'rgba(125, 220, 150, 0.35)';

/* ── Bezier helpers ── */
const P0 = { x: 20, y: 46 };
const P1 = { x: 150, y: -8 };
const P2 = { x: 280, y: 46 };

function bezierPoint(t: number) {
  'worklet';
  const mt = 1 - t;
  const x = mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x;
  const y = mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y;
  return { x, y };
}

function bezierAngle(t: number) {
  'worklet';
  const mt = 1 - t;
  const dx = 2 * mt * (P1.x - P0.x) + 2 * t * (P2.x - P1.x);
  const dy = 2 * mt * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/* ── Animated SVG wrappers ── */
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

/* ── Arc length constant ── */
const ARC_LENGTH = 320;

const INITIAL_PROGRESS = 0.32;

/* ── Props ── */
interface FlightProgressCardProps {
  onLanded: () => void;
  fromCode?: string;
  fromCity?: string;
  toCode?: string;
  toCity?: string;
  totalMinutes?: number;
  etaLabel?: string;
}

export function FlightProgressCard({
  onLanded,
  fromCode = 'MNL',
  fromCity = 'Manila',
  toCode = 'MPH',
  toCity = 'Caticlan',
  totalMinutes = 70,
  etaLabel = '8:40 PM',
}: FlightProgressCardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  /* ── State ── */
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);

  /* ── Shared values ── */
  const progressSV = useSharedValue(INITIAL_PROGRESS);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  const ringRadius = useSharedValue(7);
  const ringOpacity = useSharedValue(0.5);

  /* ── Sync progress state → shared value ── */
  useEffect(() => {
    progressSV.value = withTiming(progress, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [progress]);

  /* ── Progress drift ── */
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(1, p + 0.008));
    }, 900);
    return () => clearInterval(id);
  }, [playing]);

  /* ── Pulsing dot animation ── */
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, []);

  /* ── Destination pulse ring ── */
  useEffect(() => {
    ringRadius.value = withRepeat(
      withSequence(
        withTiming(14, { duration: 2000, easing: Easing.out(Easing.ease) }),
        withTiming(7, { duration: 0 }),
      ),
      -1,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        withTiming(0.5, { duration: 0 }),
      ),
      -1,
    );
  }, []);

  /* ── Animated props ── */
  const completedArcProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - progressSV.value),
  }));

  const planeGroupProps = useAnimatedProps(() => {
    const t = progressSV.value;
    const { x, y } = bezierPoint(t);
    const angle = bezierAngle(t);
    return {
      transform: `translate(${x}, ${y}) rotate(${angle})`,
    };
  });

  const pulseRingProps = useAnimatedProps(() => ({
    r: ringRadius.value,
    opacity: ringOpacity.value,
  }));

  /* ── Derived values ── */
  const remainingMin = Math.max(
    0,
    Math.round(totalMinutes * (1 - progress)),
  );
  const progressPct = Math.round(progress * 100);

  /* ── Static plane position for initial render ── */
  const staticPos = bezierPoint(progress);
  const staticAngle = bezierAngle(progress);

  return (
    <View style={styles.card}>
      {/* ── Top row ── */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Text style={styles.eyebrow}>ARRIVING IN</Text>
          <View style={styles.etaRow}>
            <Text style={styles.remainingMono}>{remainingMin}m</Text>
            <Text style={styles.etaText}>{'\u00B7'} ETA {etaLabel}</Text>
          </View>
        </View>
        <View style={styles.pill}>
          <PulsingDot scale={pulseScale} opacity={pulseOpacity} />
          <Text style={styles.pillText}>IN FLIGHT</Text>
        </View>
      </View>

      {/* ── Separator ── */}
      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* ── SVG Arc Strip ── */}
      <Svg viewBox="0 0 300 56" style={styles.svgContainer}>
        <Defs>
          <Path id="flightArc" d="M 20 46 Q 150 -8 280 46" />
        </Defs>

        {/* Remaining arc (dashed) */}
        <Path
          d="M 20 46 Q 150 -8 280 46"
          stroke={colors.border}
          strokeWidth={1.2}
          fill="none"
          strokeDasharray="3 4"
        />

        {/* Completed arc */}
        <AnimatedPath
          d="M 20 46 Q 150 -8 280 46"
          stroke={colors.accent}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={String(ARC_LENGTH)}
          animatedProps={completedArcProps}
        />

        {/* Origin marker */}
        <Circle cx={20} cy={46} r={3.5} fill={colors.ink} />

        {/* Destination marker */}
        <Circle cx={280} cy={46} r={3.5} fill={colors.accent} />

        {/* Destination pulse ring */}
        <AnimatedCircle
          cx={280}
          cy={46}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1.5}
          animatedProps={pulseRingProps}
        />

        {/* Plane group */}
        <AnimatedG
          animatedProps={planeGroupProps}
          transform={`translate(${staticPos.x}, ${staticPos.y}) rotate(${staticAngle})`}
        >
          {/* White halo */}
          <Circle r={12} fill={CREAM} opacity={0.9} />
          <Circle
            r={12}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1}
            opacity={0.35}
          />

          {/* Plane body — scaled 1.6x via nested G */}
          <G scale={1.6}>
            {/* Swept wings */}
            <Path
              d="M0 0 L-5 -6 L-6.5 -6 L-1 0 L-6.5 6 L-5 6 Z"
              fill={ESPRESSO}
            />
            {/* Fuselage */}
            <Path
              d="M-6 -1.1 L4 -1.3 L6 -0.6 L6.4 0 L6 0.6 L4 1.3 L-6 1.1 Z"
              fill={ESPRESSO}
            />
            {/* Tail fin */}
            <Path d="M-5.5 0 L-7.5 -3 L-7 -3 L-4.5 0 Z" fill={ESPRESSO} />
            {/* Cockpit window */}
            <Ellipse cx={4} cy={0} rx={1.2} ry={0.6} fill="#ffd9a8" />
          </G>
        </AnimatedG>
      </Svg>

      {/* ── Origin / Dest labels ── */}
      <View style={styles.labelRow}>
        <View>
          <Text style={styles.codeLabel}>{fromCode}</Text>
          <Text style={styles.cityLabel}>{fromCity}</Text>
        </View>
        <View style={styles.labelRight}>
          <Text style={[styles.codeLabel, { color: colors.accent }]}>
            {toCode}
          </Text>
          <Text style={[styles.cityLabel, { textAlign: 'right' }]}>
            {toCity}
          </Text>
        </View>
      </View>

      {/* ── Separator ── */}
      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>PROGRESS</Text>
          <Text style={styles.statValue}>{progressPct}%</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>ALTITUDE</Text>
          <Text style={styles.statValue}>34,000 ft</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>SPEED</Text>
          <Text style={styles.statValue}>820 km/h</Text>
        </View>
      </View>

      {/* ── Separator ── */}
      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* ── "I've landed" CTA ── */}
      <Pressable
        style={styles.ctaButton}
        onPress={onLanded}
        accessibilityRole="button"
        accessibilityLabel="Mark flight as landed"
      >
        <View style={styles.ctaIconCircle}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M2.5 19.5h19M3 13.5l3.5 1.5 4-3-4.5-5 2-.5 6 4.5 4.5-2a1.5 1.5 0 0 1 1 2.8l-12 5a1 1 0 0 1-1-.2L3 13.5z"
              fill="none"
              stroke={CREAM}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <View style={styles.ctaTextGroup}>
          <Text style={styles.ctaEyebrow}>Wheels down?</Text>
          <Text style={styles.ctaTitle}>I've landed</Text>
        </View>
        <ChevronRight size={18} color={CREAM} style={{ opacity: 0.7 }} />
      </Pressable>
    </View>
  );
}

/* ── Pulsing dot sub-component ── */
function PulsingDot({
  scale,
  opacity,
}: {
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={pulsingDotStyles.wrapper}>
      <Animated.View style={[pulsingDotStyles.dot, animatedStyle]} />
    </View>
  );
}

const pulsingDotStyles = StyleSheet.create({
  wrapper: {
    width: 5,
    height: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: GREEN,
  },
});

/* ── Styles factory ── */
const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg2,
      borderRadius: radius.md,
      padding: 18,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },

    /* Top row */
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    topLeft: {
      flex: 1,
    },
    eyebrow: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.16 * 10,
      textTransform: 'uppercase',
      color: colors.text3,
      marginBottom: 2,
    },
    etaRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    remainingMono: {
      fontFamily: 'SpaceMono',
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    etaText: {
      fontSize: 11,
      color: colors.text3,
    },

    /* Pill */
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: GREEN_BG,
      borderWidth: 1,
      borderColor: GREEN_BORDER,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.xs,
    },
    pillText: {
      fontSize: 9.5,
      fontWeight: '600',
      color: GREEN_DARK,
    },

    /* Separator */
    separator: {
      height: 1,
      marginVertical: 12,
    },

    /* SVG */
    svgContainer: {
      width: '100%',
      height: 56,
    },

    /* Labels */
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    labelRight: {
      alignItems: 'flex-end',
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    cityLabel: {
      fontSize: 9,
      color: colors.text3,
      marginTop: 1,
    },

    /* Stats */
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statCell: {
      flex: 1,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 8.5,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.text3,
      marginBottom: 2,
    },
    statValue: {
      fontFamily: 'SpaceMono',
      fontSize: 12,
      color: colors.text,
    },
    statDivider: {
      width: 1,
      height: 24,
    },

    /* CTA */
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: ESPRESSO,
      borderRadius: radius.sm,
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: ESPRESSO,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
      elevation: 6,
    },
    ctaIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(255, 250, 240, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    ctaTextGroup: {
      flex: 1,
    },
    ctaEyebrow: {
      fontSize: 9.5,
      fontWeight: '600',
      color: CREAM,
      opacity: 0.6,
    },
    ctaTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: CREAM,
    },
  });
