import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import WrappedCard from './WrappedCard';

interface VibeCardProps {
  dominantMood: string;
  topTags: string[];
  vibeDescription: string;
}

export default function VibeCard({
  dominantMood,
  topTags,
  vibeDescription,
}: VibeCardProps) {
  return (
    <WrappedCard bg="#1a150e">
      <View style={styles.content}>
        <Sparkles size={28} color="#d8ab7a" strokeWidth={1.5} />
        <Text style={styles.kicker}>YOUR TRIP VIBE</Text>

        <Animated.Text
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.mood}
        >
          {dominantMood}
        </Animated.Text>

        <View style={styles.tags}>
          {topTags.map((tag, i) => (
            <Animated.View
              key={tag}
              entering={FadeInDown.delay(500 + i * 100).duration(400)}
              style={styles.tagPill}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </Animated.View>
          ))}
        </View>

        {vibeDescription ? (
          <Animated.Text
            entering={FadeInDown.delay(800).duration(500)}
            style={styles.description}
          >
            {vibeDescription}
          </Animated.Text>
        ) : null}
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: 'rgba(216,171,122,0.7)',
    marginTop: 4,
  },
  mood: {
    fontSize: 38,
    fontWeight: '800',
    color: '#f1ebe2',
    letterSpacing: -1,
    textAlign: 'center',
    marginVertical: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(216,171,122,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(216,171,122,0.25)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d8ab7a',
  },
  description: {
    fontSize: 15,
    color: 'rgba(241,235,226,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 16,
  },
});
