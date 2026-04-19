import { ScrollView, StyleSheet, View } from 'react-native';

import HighlightCard from './HighlightCard';

// ---------- TYPES ----------

interface HighlightItem {
  icon: string;
  label: string;
  sub: string;
  tint: string;
}

interface HighlightsStripProps {
  highlights: HighlightItem[];
}

// ---------- COMPONENT ----------

export default function HighlightsStrip({ highlights }: HighlightsStripProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      decelerationRate="fast"
      snapToInterval={150}
      snapToAlignment="start"
    >
      {highlights.map((h) => (
        <HighlightCard
          key={h.label}
          icon={h.icon}
          label={h.label}
          sub={h.sub}
          tint={h.tint}
        />
      ))}
      {/* Spacer so last card doesn't hug the edge */}
      <View style={styles.spacer} />
    </ScrollView>
  );
}

// ---------- STYLES ----------

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  spacer: {
    width: 6,
  },
});
