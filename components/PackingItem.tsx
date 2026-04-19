import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import type { PackingItem } from '@/lib/types';

interface Props {
  item: PackingItem;
  onToggle: (packed: boolean) => void;
  busy?: boolean;
}

export default function PackingItemRow({ item, onToggle, busy }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const toggle = async () => {
    if (busy) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(!item.packed);
  };

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [styles.row, pressed ? { opacity: 0.7 } : null]}
    >
      <View style={[styles.checkbox, item.packed ? styles.checkboxOn : null]}>
        {item.packed ? <Check size={14} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.label,
            item.packed ? styles.labelDone : null,
          ]}
        >
          {item.item}
        </Text>
        {item.owner ? <Text style={styles.owner}>{item.owner}</Text> : null}
      </View>
      <Text style={styles.category}>{item.category}</Text>
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
  owner: { color: colors.text3, fontSize: 11, marginTop: 2 },
  category: { color: colors.text3, fontSize: 11, fontWeight: '600' },
});
