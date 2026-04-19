import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/constants/ThemeContext';

// ---------- TYPES ----------

interface ConstellationHeroProps {
  miles: number;
  trips: number;
  countries: number;
  nights: number;
  spent: number;
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ---------- ANIMATED COMPONENTS ----------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// ---------- FIXED STAR POSITIONS (from prototype) ----------

const W = 320;
const H = 120;

const HOME = { x: 48, y: 72, label: 'HOME' };

const STARS = [
  { x: 88, y: 42, label: 'TOK', flag: '\u{1F1EF}\u{1F1F5}' },
  { x: 130, y: 86, label: 'DAD', flag: '\u{1F1FB}\u{1F1F3}' },
  { x: 78, y: 96, label: 'IAO', flag: '\u{1F1F5}\u{1F1ED}' },
  { x: 172, y: 58, label: 'BKK', flag: '\u{1F1F9}\u{1F1ED}' },
  { x: 208, y: 92, label: 'SIN', flag: '\u{1F1F8}\u{1F1EC}' },
  { x: 244, y: 50, label: 'MPH', flag: '\u{1F334}', current: true },
];

// ---------- CONNECTION LINE ----------

function ConnectionLine({
  star,
  index,
  accentColor,
}: {
  star: (typeof STARS)[number];
  index: number;
  accentColor: string;
}) {
  const dashOffset = useSharedValue(120);

  useEffect(() => {
    dashOffset.value = withDelay(
      index * 120,
      withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );
  }, [index, dashOffset]);

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  return (
    <AnimatedLine
      x1={HOME.x}
      y1={HOME.y}
      x2={star.x}
      y2={star.y}
      stroke={accentColor}
      strokeWidth={0.7}
      strokeDasharray="2 2"
      opacity={star.current ? 0.8 : 0.35}
      animatedProps={lineProps}
    />
  );
}

// ---------- DESTINATION STAR ----------

function DestinationStar({
  star,
  index,
  accentColor,
  textColor,
  text2Color,
}: {
  star: (typeof STARS)[number];
  index: number;
  accentColor: string;
  textColor: string;
  text2Color: string;
}) {
  const opacity = useSharedValue(0);
  const pulseR = useSharedValue(6);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    opacity.value = withDelay(
      300 + index * 100,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );

    if (star.current) {
      pulseR.value = withDelay(
        500 + index * 100,
        withRepeat(
          withTiming(10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      );
      pulseOpacity.value = withDelay(
        500 + index * 100,
        withRepeat(
          withTiming(0.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      );
    }
  }, [index, star.current, opacity, pulseR, pulseOpacity]);

  const starProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  const pulseProps = useAnimatedProps(() => ({
    r: pulseR.value,
    opacity: pulseOpacity.value,
  }));

  return (
    <G>
      {star.current && (
        <AnimatedCircle
          cx={star.x}
          cy={star.y}
          fill="none"
          stroke={accentColor}
          strokeWidth={1}
          animatedProps={pulseProps}
        />
      )}
      <AnimatedCircle
        cx={star.x}
        cy={star.y}
        r={star.current ? 3.5 : 2.5}
        fill={star.current ? accentColor : textColor}
        animatedProps={starProps}
      />
      <SvgText
        x={star.x}
        y={star.y - 7}
        textAnchor="middle"
        fill={text2Color}
        fontSize={6.5}
        fontWeight="600"
      >
        {star.label}
      </SvgText>
    </G>
  );
}

// ---------- STAT ----------

function SummaryStat({
  num,
  label,
  last,
  colors,
}: {
  num: string | number;
  label: string;
  last?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        summaryStatStyles.container,
        !last && { borderRightWidth: 1, borderRightColor: colors.border2 },
      ]}
    >
      <Text style={[summaryStatStyles.num, { color: colors.text }]}>
        {num}
      </Text>
      <Text style={[summaryStatStyles.label, { color: colors.text3 }]}>
        {label}
      </Text>
    </View>
  );
}

const summaryStatStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  num: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.6,
    lineHeight: 20,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    marginTop: 5,
  },
});

// ---------- MAIN COMPONENT ----------

export default function ConstellationHero({
  miles,
  trips,
  countries,
  nights,
  spent,
}: ConstellationHeroProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const spentFormatted = `\u20B1${Math.round(spent / 1000)}k`;

  return (
    <View style={styles.container}>
      {/* Background glow */}
      <View style={styles.glow} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Lifetime \u00B7 since 2024</Text>
        <View style={styles.milesRow}>
          <Text style={styles.milesNum}>{miles.toLocaleString()}</Text>
          <Text style={styles.milesLabel}>miles traveled</Text>
        </View>
      </View>

      {/* Constellation map */}
      <Svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={120}
        style={styles.svg}
      >
        {/* Connection lines */}
        {STARS.map((s, i) => (
          <ConnectionLine
            key={`line-${s.label}`}
            star={s}
            index={i}
            accentColor={colors.accent}
          />
        ))}

        {/* Home base */}
        <Circle
          cx={HOME.x}
          cy={HOME.y}
          r={7}
          fill="none"
          stroke={colors.accent}
          strokeWidth={1}
          opacity={0.35}
        />
        <Circle cx={HOME.x} cy={HOME.y} r={4} fill={colors.accent} />
        <SvgText
          x={HOME.x}
          y={HOME.y + 18}
          textAnchor="middle"
          fill={colors.text3}
          fontSize={7}
          fontWeight="700"
          letterSpacing={0.7}
        >
          HOME
        </SvgText>

        {/* Destination stars */}
        {STARS.map((s, i) => (
          <DestinationStar
            key={`star-${s.label}`}
            star={s}
            index={i}
            accentColor={colors.accent}
            textColor={colors.text}
            text2Color={colors.text2}
          />
        ))}
      </Svg>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <SummaryStat num={trips} label="Trips" colors={colors} />
        <SummaryStat num={countries} label="Countries" colors={colors} />
        <SummaryStat num={nights} label="Nights" colors={colors} />
        <SummaryStat num={spentFormatted} label="Spent" last colors={colors} />
      </View>
    </View>
  );
}

// ---------- STYLES ----------

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginBottom: 8,
      position: 'relative',
      padding: 18,
      paddingTop: 16,
      paddingBottom: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      overflow: 'hidden',
    },
    glow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.12,
    },
    header: {
      position: 'relative',
      zIndex: 1,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    milesRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 6,
    },
    milesNum: {
      fontSize: 44,
      fontWeight: '500',
      color: colors.text,
      lineHeight: 44,
      letterSpacing: -0.88,
    },
    milesLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },
    svg: {
      marginTop: 8,
    },
    statsRow: {
      flexDirection: 'row',
      marginTop: 12,
      paddingTop: 14,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: colors.border2,
    },
  });
