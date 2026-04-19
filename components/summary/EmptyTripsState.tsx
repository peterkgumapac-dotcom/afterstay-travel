import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'

import { useTheme } from '@/constants/ThemeContext'
import { radius, spacing } from '@/constants/theme'

interface EmptyTripsStateProps {
  onPlanTrip: () => void
  onAddPastTrip: () => void
}

export default function EmptyTripsState({
  onPlanTrip,
  onAddPastTrip,
}: EmptyTripsStateProps) {
  const { colors } = useTheme()
  const styles = getStyles(colors)

  return (
    <View style={styles.container}>
      {/* Mini constellation art */}
      <Svg width={180} height={120} viewBox="0 0 180 120">
        {/* Dashed lines */}
        <Line
          x1={90}
          y1={100}
          x2={50}
          y2={40}
          stroke={colors.border2}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <Line
          x1={90}
          y1={100}
          x2={130}
          y2={30}
          stroke={colors.border2}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <Line
          x1={90}
          y1={100}
          x2={150}
          y2={70}
          stroke={colors.border2}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Stars */}
        <Circle cx={50} cy={40} r={3} fill={colors.text3} opacity={0.5} />
        <Circle cx={130} cy={30} r={3} fill={colors.text3} opacity={0.5} />
        <Circle cx={150} cy={70} r={2.5} fill={colors.text3} opacity={0.4} />
        <Circle cx={30} cy={20} r={1.5} fill={colors.text3} opacity={0.3} />
        <Circle cx={160} cy={15} r={1.5} fill={colors.text3} opacity={0.3} />

        {/* Home star */}
        <Circle cx={90} cy={100} r={5} fill={colors.accent} />
        <SvgText
          x={90}
          y={116}
          fontSize={8}
          fontWeight="600"
          fill={colors.accent}
          textAnchor="middle"
        >
          Home
        </SvgText>
      </Svg>

      <Text style={styles.heading}>Your journey starts here</Text>
      <Text style={styles.subtitle}>
        Every great traveler has a first trip. Add yours and start building your
        travel identity.
      </Text>

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
          styles.secondaryBtn,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.secondaryBtnText}>Or add a past trip</Text>
      </Pressable>
    </View>
  )
}

type ThemeColors = ReturnType<typeof useTheme>['colors']

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.md,
    },
    heading: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
      marginTop: spacing.md,
      letterSpacing: -0.3,
    },
    subtitle: {
      color: colors.text2,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm,
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.xxl,
    },
    primaryBtnText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    secondaryBtn: {
      borderRadius: radius.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.xxl,
      borderWidth: 1,
      borderColor: colors.accent + '40',
      borderStyle: 'dashed',
    },
    secondaryBtnText: {
      color: colors.accentLt,
      fontSize: 14,
      fontWeight: '600',
    },
  })
