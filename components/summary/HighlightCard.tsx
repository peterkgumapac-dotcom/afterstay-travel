import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/constants/ThemeContext'
import { radius, spacing } from '@/constants/theme'
import type { Highlight, HighlightType } from '@/lib/types'

// ---------- TYPES ----------

interface HighlightCardProps {
  highlight: Highlight
}

// ---------- EMOJI MAP ----------

const TYPE_EMOJI: Record<HighlightType, string> = {
  countries_visited: '\uD83C\uDF0D',
  miles_traveled: '\u2708\uFE0F',
  beach_streak: '\uD83C\uDF19',
  total_moments: '\uD83D\uDCF8',
  longest_trip: '\u23F1',
  most_visited: '\uD83D\uDCCD',
  favorite_companion: '\uD83E\uDDD1\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1',
  first_solo: '\uD83E\uDDD3',
  first_trip: '\u2B50',
  new_territory: '\uD83C\uDD95',
  start_of_something: '\uD83C\uDF1F',
}

// ---------- COMPONENT ----------

export default function HighlightCard({ highlight }: HighlightCardProps) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const emoji = TYPE_EMOJI[highlight.type] ?? '\u2728'

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.displayText} numberOfLines={2}>
        {highlight.displayText}
      </Text>
    </View>
  )
}

// ---------- STYLES ----------

type ThemeColors = ReturnType<typeof useTheme>['colors']

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: 140,
      backgroundColor: colors.accentDim,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    emoji: {
      fontSize: 22,
    },
    displayText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 17,
    },
  })
