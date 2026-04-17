import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface PillProps {
  label: string;
  tone?: 'default' | 'green' | 'blue' | 'amber' | 'red' | 'purple';
}

export default function Pill({ label, tone = 'default' }: PillProps) {
  const bg = toneBg(tone);
  const fg = toneFg(tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: fg + '40' }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

function toneBg(t: PillProps['tone']): string {
  switch (t) {
    case 'green': return colors.green + '22';
    case 'blue': return colors.blue + '22';
    case 'amber': return colors.amber + '22';
    case 'red': return colors.red + '22';
    case 'purple': return colors.purple + '22';
    default: return colors.bg3;
  }
}
function toneFg(t: PillProps['tone']): string {
  switch (t) {
    case 'green': return colors.green2;
    case 'blue': return colors.blue;
    case 'amber': return colors.amber;
    case 'red': return colors.red;
    case 'purple': return colors.purple;
    default: return colors.text2;
  }
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
