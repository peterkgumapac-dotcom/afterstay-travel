import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useTheme } from '@/constants/ThemeContext';

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
  const [playing] = useState(true);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);

  /* ── Shared values ── */
  const progressSV = useSharedValue(INITIAL_PROGRESS);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  const ringRadius = useSharedValue(7);
  const ringOpacity = useSharedValue(0.5);

  /* ── Sync progress state -> shared value ── */
  useEffect(() => {
    progressSV.value = withTiming(progress, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [progress, progressSV]);

  /* ── Progress drift ── */
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => Math.min(1, p + 0.008));
    }, 900);
    return () => clearInterval(id);
  }, [playing]);

  /* ── Pulsing dot animation (1.6s ease-in-out infinite) ── */
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
  }, [pulseScale, pulseOpacity]);

  /* ── Destination pulse ring (2s ease-out infinite) ── */
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
  }, [ringRadius, ringOpacity]);

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
  const remainingMin = Math.max(0, Math.round(totalMinutes * (1 - progress)));
  const progressPct = Math.round(progress * 100);

  /* ── Static plane position for initial render ── */
  const staticPos = bezierPoint(progress);
  const staticAngle = bezierAngle(progress);

  return (
    <View style={styles.wrapper}>
      {/* ── Top row: label + eta, status chip ── */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Text style={styles.eyebrow}>Arriving in</Text>
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

      {/* ── Arc strip ── */}
      <View style={styles.arcWrap}>
        <Svg viewBox="0 0 300 56" style={styles.svgContainer}>
          <Defs>
            <Path id="flightArc" d="M 20 46 Q 150 -8 280 46" />
          </Defs>

          {/* Remaining arc (dashed, subtle) */}
          <Path
            d="M 20 46 Q 150 -8 280 46"
            stroke="rgba(61,36,22,0.25)"
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
            <Circle r={12} fill="none" stroke={colors.accent} strokeWidth={0.8} opacity={0.35} />

            {/* Plane body — scaled 1.6x */}
            <G scale={1.6}>
              {/* Main wings (swept) */}
              <Path d="M0 0 L-5 -6 L-6.5 -6 L-1 0 L-6.5 6 L-5 6 Z" fill={ESPRESSO} />
              {/* Fuselage */}
              <Path d="M-6 -1.1 L4 -1.3 L6 -0.6 L6.4 0 L6 0.6 L4 1.3 L-6 1.1 Z" fill={ESPRESSO} />
              {/* Tail fin */}
              <Path d="M-6 0 L-8 -3 L-5.8 -3 L-4.5 0 L-5.8 3 L-8 3 Z" fill={ESPRESSO} />
              {/* Cockpit window */}
              <Ellipse cx={4} cy={0} rx={1.2} ry={0.6} fill="#ffd9a8" />
            </G>
          </AnimatedG>
        </Svg>

        {/* Origin / Dest labels */}
        <View style={styles.labelRow}>
          <View>
            <Text style={styles.codeLabel}>{fromCode}</Text>
            <Text style={styles.cityLabel}>{fromCity}</Text>
          </View>
          <View style={styles.labelRight}>
            <Text style={[styles.codeLabel, { color: colors.accent }]}>{toCode}</Text>
            <Text style={[styles.cityLabel, { textAlign: 'right' }]}>{toCity}</Text>
          </View>
        </View>
      </View>

      {/* ── Separator ── */}
      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <StatCell label="Progress" value={`${progressPct}%`} colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell label="Altitude" value="34,000 ft" colors={colors} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatCell label="Speed" value="820 km/h" colors={colors} />
      </View>

      {/* ── Separator ── */}
      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* ── "I've landed" CTA ── */}
      <Pressable
        style={styles.ctaButton}
        onPress={onLanded}
        accessibilityRole="button"
        accessibilityLabel="I've landed"
      >
        <View style={styles.ctaRow}>
          <View style={styles.ctaIconCircle}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M2 22h20"
                stroke={CREAM}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M5.5 16l14-3.5a2 2 0 00-1.4-2.4l-2-.5-4-6-2 .4 1.6 5.2-4 1-2-1.5-1.2.3z"
                stroke={CREAM}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <View>
            <Text style={styles.ctaEyebrow}>Wheels down?</Text>
            <Text style={styles.ctaTitle}>I've landed</Text>
          </View>
        </View>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12h14M13 5l7 7-7 7"
            stroke={CREAM}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

/* ── Stat cell ── */
function StatCell({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];
}) {
  return (
    <View style={statStyles.cell}>
      <Text style={[statStyles.label, { color: colors.text3 }]}>{label.toUpperCase()}</Text>
      <Text style={[statStyles.value, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.14 * 8.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

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
const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    wrapper: {
      marginHorizontal: 16,
      paddingTop: 4,
      paddingHorizontal: 2,
    },

    /* Top row */
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    topLeft: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      flex: 1,
    },
    eyebrow: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.16 * 9.5,
      textTransform: 'uppercase',
      color: colors.text3,
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
      color: colors.ink,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.01 * 15,
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
      borderRadius: 99,
    },
    pillText: {
      fontSize: 9.5,
      fontWeight: '700',
      color: GREEN_DARK,
      letterSpacing: 0.04 * 9.5,
    },

    /* Separator */
    separator: {
      height: 1,
      marginVertical: 10,
    },

    /* Arc */
    arcWrap: {
      paddingHorizontal: 4,
    },
    svgContainer: {
      width: '100%',
      height: 56,
    },

    /* Labels */
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: -4,
      paddingHorizontal: 2,
    },
    labelRight: {
      alignItems: 'flex-end',
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.ink,
      letterSpacing: 0.04 * 11,
    },
    cityLabel: {
      fontSize: 9,
      color: colors.text3,
    },

    /* Stats */
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 2,
    },
    statDivider: {
      width: 1,
      height: 22,
    },

    /* CTA */
    ctaButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      backgroundColor: ESPRESSO,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      shadowColor: 'rgba(61, 36, 22, 1)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
      elevation: 6,
    },
    ctaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    ctaIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 99,
      backgroundColor: 'rgba(255,250,240,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,250,240,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaEyebrow: {
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.16 * 9.5,
      textTransform: 'uppercase',
      color: CREAM,
      opacity: 0.85,
    },
    ctaTitle: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.01 * 14,
      color: CREAM,
      marginTop: 1,
    },
  });
