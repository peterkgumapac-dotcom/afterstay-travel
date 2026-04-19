import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';

interface Props<T extends string> {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}

export default function Select<T extends string>({ label, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map(o => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              style={({ pressed }) => [
                styles.pill,
                active ? styles.pillActive : null,
                pressed ? { opacity: 0.7 } : null,
              ]}
            >
              <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{o}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  label: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: { gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillActive: {
    backgroundColor: colors.green + '22',
    borderColor: colors.green,
  },
  pillText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.green2 },
});
