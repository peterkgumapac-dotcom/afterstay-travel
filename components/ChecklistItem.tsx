import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { ChecklistItem } from '@/lib/types';

interface Props {
  item: ChecklistItem;
  onToggle: (done: boolean) => void;
  doneBy?: string;
}

export default function ChecklistItemRow({ item, onToggle, doneBy }: Props) {
  const toggle = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onToggle(!item.done);
  };

  return (
    <Pressable onPress={toggle} style={({ pressed }) => [styles.row, pressed ? { opacity: 0.7 } : null]}>
      <View style={[styles.checkbox, item.done ? styles.checkboxOn : null]}>
        {item.done ? <Check size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, item.done ? styles.labelDone : null]}>{item.task}</Text>
        {item.done && item.doneBy ? (
          <Text style={styles.sub}>Done by {item.doneBy}</Text>
        ) : doneBy ? (
          <Text style={styles.sub}>Tap — will mark {doneBy}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: colors.green,
    backgroundColor: colors.green,
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '500' },
  labelDone: { color: colors.text3, textDecorationLine: 'line-through' },
  sub: { color: colors.text3, fontSize: 11, marginTop: 2 },
});
