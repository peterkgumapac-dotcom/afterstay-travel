import { StyleSheet, View, ViewProps } from 'react-native';

import { colors, elevation, radius, spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  padded?: boolean;
}

export default function Card({ style, padded = true, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[styles.card, padded && styles.padded, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.card,
  },
  padded: {
    padding: spacing.xl,
  },
});
