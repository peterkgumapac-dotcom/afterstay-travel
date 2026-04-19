import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';

interface AfterStayLoaderProps {
  readonly message?: string;
}

export default function AfterStayLoader({ message }: AfterStayLoaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? (
        <Text style={[styles.message, { color: colors.text2 }]}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
