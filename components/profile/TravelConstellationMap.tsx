import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Line,
  Text as SvgText,
  G,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withDelay,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '@/constants/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);

// ---------- Types ----------

export interface Destination {
  code: string;
  flag: string;
  x: number;
  y: number;
}

export interface ConstellationData {
  destinations: Destination[];
  totalKm: number;
  since: string;
  trips: number;
  places: number;
  nights: number;
  spent: string;
}

// ---------- Preset data ----------

export const AARON_DATA: ConstellationData = {
  destinations: [
    { code: 'TYO', flag: '\u{1F1EF}\u{1F1F5}', x: 320, y: 37.5 },
    { code: 'ICN', flag: '\u{1F1F0}\u{1F1F7}', x: 228.8, y: 32 },
    { code: 'HKG', flag: '\u{1F1ED}\u{1F1F0}', x: 137.5, y: 76.9 },
    { code: 'BKK', flag: '\u{1F1F9}\u{1F1ED}', x: 40, y: 102.1 },
    { code: 'DAD', flag: '\u{1F1FB}\u{1F1F3}', x: 95, y: 95.3 },
    { code: 'SIN', flag: '\u{1F1F8}\u{1F1EC}', x: 63.7, y: 138.6 },
    { code: 'DPS', flag: '\u{1F1EE}\u{1F1E9}', x: 145, y: 168 },
    { code: 'MPH', flag: '\u{1F1F5}\u{1F1ED}', x: 212.1, y: 131.7 },
  ],
  totalKm: 15698,
  since: '2024',
  trips: 13,
  places: 8,
  nights: 75,
  spent: '\u20B1348k',
};

export const PETER_DATA: ConstellationData = {
  destinations: [
    { code: 'MPH', flag: '\u{1F1F5}\u{1F1ED}', x: 212.1, y: 131.7 },
  ],
  totalKm: 582,
  since: '2026',
  trips: 1,
  places: 1,
  nights: 7,
  spent: '\u20B136k',
};

// ---------- Constants ----------

const HOME = { x: 186.1, y: 99.7 };
const VIEWBOX = '0 0 360 200';

const COLORS = {
  accent: '#d8ab7a',
  text: '#f1ebe2',
  text2: '#b8afa3',
  text3: '#857d70',
  card: '#1f1b17',
  border: '#2e2822',
  border2: '#3e362e',
  bg: '#141210',
};

// ---------- Animated route line ----------

function RouteLine({ dest, index }: { dest: Destination; index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      100 + index * 100,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 1], [0, 0.7, 0.7]),
    strokeDashoffset: interpolate(progress.value, [0, 1], [200, 0]),
  }));

  return (
    <AnimatedLine
      x1={HOME.x}
      y1={HOME.y}
      x2={dest.x}
      y2={dest.y}
      stroke={COLORS.accent}
      strokeWidth={1}
      strokeDasharray="2.4 2.4"
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

// ---------- Destination node ----------

function DestinationNode({ dest, index }: { dest: Destination; index: number }) {
  const scale = useSharedValue(0);
  const labelOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      400 + index * 100,
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
    labelOpacity.value = withDelay(
      500 + index * 100,
      withTiming(1, { duration: 500 }),
    );
  }, []);

  const dotProps = useAnimatedProps(() => ({
    opacity: scale.value,
    r: interpolate(scale.value, [0, 0.6, 1], [0, 2.8, 2.2]),
  }));

  const ringProps = useAnimatedProps(() => ({
    opacity: interpolate(scale.value, [0, 1], [0, 0.4]),
    r: interpolate(scale.value, [0, 0.6, 1], [0, 4.2, 3.4]),
  }));

  const labelProps = useAnimatedProps(() => ({
    opacity: labelOpacity.value,
  }));

  // Flag position offset
  const isLeft = dest.x < HOME.x;
  const flagX = dest.code === 'HKG' || dest.code === 'DPS' ? dest.x : isLeft ? dest.x : dest.x + 28;
  const flagY = dest.code === 'HKG' || dest.code === 'SIN' || dest.code === 'BKK' || dest.code === 'DPS'
    ? dest.y + 26
    : dest.y - 1;

  return (
    <G>
      {/* Ring */}
      <AnimatedCircle
        cx={dest.x}
        cy={dest.y}
        fill="none"
        stroke={COLORS.accent}
        strokeWidth={1.2}
        animatedProps={ringProps}
      />
      {/* Dot */}
      <AnimatedCircle
        cx={dest.x}
        cy={dest.y}
        fill={COLORS.text}
        animatedProps={dotProps}
      />
      {/* Label */}
      <AnimatedG animatedProps={labelProps}>
        <SvgText
          x={dest.x}
          y={dest.y - 15}
          fill={COLORS.text2}
          fontSize={6.5}
          fontWeight="600"
          textAnchor="middle"
          letterSpacing={0.5}
        >
          {dest.code}
        </SvgText>
      </AnimatedG>
    </G>
  );
}

// ---------- Home node (pulsing) ----------

function HomeNode() {
  const pulse = useSharedValue(6.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 1300 }),
        withTiming(6.5, { duration: 1300 }),
      ),
      -1,
    );
  }, []);

  const glowProps = useAnimatedProps(() => ({
    r: pulse.value,
    opacity: interpolate(pulse.value, [6.5, 10], [0.35, 0.05]),
  }));

  return (
    <G>
      <AnimatedCircle
        cx={HOME.x}
        cy={HOME.y}
        fill={COLORS.accent}
        animatedProps={glowProps}
      />
      <Circle cx={HOME.x} cy={HOME.y} r={3.6} fill={COLORS.accent} />
      <Circle cx={HOME.x} cy={HOME.y} r={2} fill={COLORS.bg} />
      <SvgText
        x={HOME.x}
        y={HOME.y + 13}
        fill={COLORS.text}
        fontSize={6.5}
        fontWeight="700"
        textAnchor="middle"
        letterSpacing={0.5}
      >
        HOME
      </SvgText>
    </G>
  );
}

// ---------- Main component ----------

interface Props {
  data: ConstellationData;
}

export default function TravelConstellationMap({ data }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.head}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>
          {`LIFETIME \u00B7 SINCE ${data.since}`}
        </Text>
        <View style={styles.kmRow}>
          <Text style={[styles.kmNum, { color: colors.text }]}>
            {data.totalKm.toLocaleString()}
          </Text>
          <Text style={[styles.kmUnit, { color: colors.text2 }]}>km traveled</Text>
        </View>
      </View>

      {/* SVG Map */}
      <View style={styles.mapWrap}>
        <Svg viewBox={VIEWBOX} style={styles.svg}>
          {/* Route lines */}
          {data.destinations.map((d, i) => (
            <RouteLine key={d.code} dest={d} index={i} />
          ))}

          {/* Home node */}
          <HomeNode />

          {/* Destination nodes */}
          {data.destinations.map((d, i) => (
            <DestinationNode key={d.code} dest={d} index={i} />
          ))}
        </Svg>

        {/* Flag emojis as RN Text (SVG text can't render emoji reliably) */}
        {data.destinations.map((d) => {
          const isBelow = ['HKG', 'SIN', 'BKK', 'DPS'].includes(d.code);
          const flagX = d.code === 'HKG' || d.code === 'DPS' ? d.x : d.x < HOME.x ? d.x : d.x + 28;
          const flagY = isBelow ? d.y + 16 : d.y - 8;
          // Convert SVG coords to percentage for absolute positioning
          const leftPct = (flagX / 360) * 100;
          const topPct = (flagY / 200) * 100;
          return (
            <Text
              key={`flag-${d.code}`}
              style={[
                styles.flag,
                { left: `${leftPct}%`, top: `${topPct}%` },
              ]}
            >
              {d.flag}
            </Text>
          );
        })}
      </View>

      {/* Footer stats */}
      <View style={[styles.footer, { borderTopColor: colors.border2 }]}>
        <View style={[styles.fcell, { borderRightColor: colors.border }]}>
          <Text style={[styles.fval, { color: colors.text }]}>{data.trips}</Text>
          <Text style={[styles.flabel, { color: colors.text3 }]}>TRIPS</Text>
        </View>
        <View style={[styles.fcell, { borderRightColor: colors.border }]}>
          <Text style={[styles.fval, { color: colors.text }]}>{data.places}</Text>
          <Text style={[styles.flabel, { color: colors.text3 }]}>PLACES</Text>
        </View>
        <View style={[styles.fcell, { borderRightColor: colors.border }]}>
          <Text style={[styles.fval, { color: colors.text }]}>{data.nights}</Text>
          <Text style={[styles.flabel, { color: colors.text3 }]}>NIGHTS</Text>
        </View>
        <View style={styles.fcell}>
          <Text style={[styles.fval, { color: colors.text }]}>{data.spent}</Text>
          <Text style={[styles.flabel, { color: colors.text3 }]}>SPENT</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  head: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  kmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  kmNum: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.8,
  },
  kmUnit: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  mapWrap: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: 'relative',
  },
  svg: {
    width: '100%',
    aspectRatio: 360 / 200,
  },
  flag: {
    position: 'absolute',
    fontSize: 16,
    transform: [{ translateX: -8 }, { translateY: -8 }],
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: 18,
    paddingVertical: 12,
  },
  fcell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    borderRightWidth: 1,
  },
  fval: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  flabel: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
