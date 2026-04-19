import { StyleSheet, View, ViewProps } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { elevation, radius, spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export default function Card({ style, padded = true, children, ...rest }: CardProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View
      {...rest}
      style={[styles.card, padded && staticStyles.padded, style]}
    >
      {children}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.card,
  },
});

const staticStyles = StyleSheet.create({
  padded: {
    padding: spacing.xl,
  },
});
