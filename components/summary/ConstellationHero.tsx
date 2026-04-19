import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, {
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated'

import { useTheme } from '@/constants/ThemeContext'
import { spacing } from '@/constants/theme'

// ---------- TYPES ----------

interface Destination {
  name: string
  lat: number
  lng: number
  isCurrent?: boolean
}

interface ConstellationHeroProps {
  totalMiles: number
  destinations: Destination[]
}

// ---------- ANIMATED COMPONENTS ----------

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

// ---------- PROJECTION ----------

const HOME_LAT = 14.5995
const HOME_LNG = 120.9842
const HOME_SVG_X = 175
const HOME_SVG_Y = 240

const SVG_WIDTH = 350
const SVG_HEIGHT = 300

function mapToSvg(lat: number, lng: number) {
  const x = HOME_SVG_X + (lng - HOME_LNG) * 8
  const y = HOME_SVG_Y - (lat - HOME_LAT) * 12
  return {
    x: Math.max(30, Math.min(SVG_WIDTH - 30, x)),
    y: Math.max(40, Math.min(220, y)),
  }
}

// ---------- DESTINATION STAR ----------

function DestinationStar({
  dest,
  index,
  accentColor,
  textColor,
  mutedColor,
}: {
  dest: Destination
  index: number
  accentColor: string
  textColor: string
  mutedColor: string
}) {
  const pos = mapToSvg(dest.lat, dest.lng)
  const scale = useSharedValue(0)
  const pulseScale = useSharedValue(1)
  const pulseOpacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withDelay(
      index * 200,
      withSpring(1, { damping: 12, stiffness: 120 }),
    )

    if (dest.isCurrent) {
      pulseScale.value = withDelay(
        index * 200 + 400,
        withRepeat(
          withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) }),
          -1,
          true,
        ),
      )
      pulseOpacity.value = withDelay(
        index * 200 + 400,
        withRepeat(
          withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
          -1,
          true,
        ),
      )
    }
  }, [index, dest.isCurrent, scale, pulseScale, pulseOpacity])

  const starProps = useAnimatedProps(() => ({
    r: 4 * scale.value,
    opacity: scale.value,
  }))

  const pulseProps = useAnimatedProps(() => ({
    r: 8 * pulseScale.value,
    opacity: pulseOpacity.value,
  }))

  return (
    <>
      {dest.isCurrent && (
        <AnimatedCircle
          cx={pos.x}
          cy={pos.y}
          fill="none"
          stroke={accentColor}
          strokeWidth={1.5}
          animatedProps={pulseProps}
        />
      )}
      <AnimatedCircle
        cx={pos.x}
        cy={pos.y}
        fill={dest.isCurrent ? accentColor : textColor}
        animatedProps={starProps}
      />
      <SvgText
        x={pos.x}
        y={pos.y + 14}
        fontSize={9}
        fontWeight="600"
        fill={mutedColor}
        textAnchor="middle"
      >
        {dest.name}
      </SvgText>
    </>
  )
}

// ---------- CONSTELLATION LINE ----------

function ConstellationLine({
  dest,
  index,
  lineColor,
}: {
  dest: Destination
  index: number
  lineColor: string
}) {
  const pos = mapToSvg(dest.lat, dest.lng)
  const dx = pos.x - HOME_SVG_X
  const dy = pos.y - HOME_SVG_Y
  const length = Math.sqrt(dx * dx + dy * dy)

  const dashOffset = useSharedValue(length)

  useEffect(() => {
    dashOffset.value = withDelay(
      index * 200,
      withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    )
  }, [index, dashOffset, length])

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }))

  return (
    <AnimatedLine
      x1={HOME_SVG_X}
      y1={HOME_SVG_Y}
      x2={pos.x}
      y2={pos.y}
      stroke={lineColor}
      strokeWidth={1}
      strokeDasharray={`4 4`}
      animatedProps={lineProps}
    />
  )
}

// ---------- HOME STAR ----------

function HomeStar({ accentColor }: { accentColor: string }) {
  const pulseScale = useSharedValue(1)
  const pulseOpacity = useSharedValue(0.6)

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [pulseScale, pulseOpacity])

  const ringProps = useAnimatedProps(() => ({
    r: 8 * pulseScale.value,
    opacity: pulseOpacity.value,
  }))

  return (
    <>
      <AnimatedCircle
        cx={HOME_SVG_X}
        cy={HOME_SVG_Y}
        fill="none"
        stroke={accentColor}
        strokeWidth={1.5}
        animatedProps={ringProps}
      />
      <Circle cx={HOME_SVG_X} cy={HOME_SVG_Y} r={5} fill={accentColor} />
      <SvgText
        x={HOME_SVG_X}
        y={HOME_SVG_Y + 16}
        fontSize={9}
        fontWeight="700"
        fill={accentColor}
        textAnchor="middle"
      >
        Manila
      </SvgText>
    </>
  )
}

// ---------- MAIN COMPONENT ----------

export default function ConstellationHero({
  totalMiles,
  destinations,
}: ConstellationHeroProps) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const lineColor = colors.border2

  return (
    <View style={styles.container}>
      <Svg
        width="100%"
        height={280}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      >
        {/* Miles display */}
        <SvgText
          x={SVG_WIDTH / 2}
          y={32}
          fontSize={28}
          fontWeight="800"
          fill={colors.text}
          textAnchor="middle"
          letterSpacing={-0.5}
        >
          {totalMiles.toLocaleString()}
        </SvgText>
        <SvgText
          x={SVG_WIDTH / 2}
          y={48}
          fontSize={10}
          fontWeight="600"
          fill={colors.text3}
          textAnchor="middle"
          letterSpacing={1.5}
        >
          MILES TRAVELED
        </SvgText>

        {/* Dashed lines from home to destinations */}
        {destinations.map((dest, i) => (
          <ConstellationLine
            key={`line-${dest.name}`}
            dest={dest}
            index={i}
            lineColor={lineColor}
          />
        ))}

        {/* Destination stars */}
        {destinations.map((dest, i) => (
          <DestinationStar
            key={`star-${dest.name}`}
            dest={dest}
            index={i}
            accentColor={colors.accent}
            textColor={colors.text2}
            mutedColor={colors.text3}
          />
        ))}

        {/* Home star */}
        <HomeStar accentColor={colors.accent} />
      </Svg>
    </View>
  )
}

// ---------- STYLES ----------

type ThemeColors = ReturnType<typeof useTheme>['colors']

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.canvas,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      overflow: 'hidden',
    },
  })
