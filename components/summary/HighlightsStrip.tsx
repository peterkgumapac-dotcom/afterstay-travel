import { ScrollView, StyleSheet, View } from 'react-native'

import { spacing } from '@/constants/theme'
import type { Highlight } from '@/lib/types'

import HighlightCard from './HighlightCard'

interface HighlightsStripProps {
  highlights: Highlight[]
}

export default function HighlightsStrip({ highlights }: HighlightsStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {highlights.map((h) => (
        <HighlightCard key={h.id} highlight={h} />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
})
