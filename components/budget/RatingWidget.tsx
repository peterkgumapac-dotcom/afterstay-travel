import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

interface Props {
  rating: number;
  onRatingChange: (n: number) => void;
  notes: string;
  onNotesChange: (s: string) => void;
  placeName?: string;
}

export const RatingWidget: React.FC<Props> = ({
  rating, onRatingChange, notes, onNotesChange, placeName,
}) => {
  const handleStarPress = (n: number) => {
    Haptics.selectionAsync();
    onRatingChange(n);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Rate {placeName ? `"${placeName}"` : 'this place'}
      </Text>

      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => handleStarPress(n)}
            style={styles.starBtn}
            activeOpacity={0.7}
          >
            <Star
              color={n <= rating ? colors.gold : colors.border2}
              fill={n <= rating ? colors.gold : 'transparent'}
              size={28}
              strokeWidth={2}
            />
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Quick note (optional)"
        placeholderTextColor={colors.text3}
        multiline
        numberOfLines={2}
      />

      <Text style={styles.hint}>
        Saved to your Places list
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    backgroundColor: colors.bg2,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 12,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  starBtn: { padding: 6 },
  notesInput: {
    backgroundColor: colors.card, color: colors.text, fontSize: 13,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border2,
    minHeight: 60, textAlignVertical: 'top',
  },
  hint: {
    color: colors.text3, fontSize: 11, fontStyle: 'italic',
    textAlign: 'center', marginTop: 8,
  },
});
