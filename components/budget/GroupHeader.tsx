import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface GroupHeaderProps {
  kicker?: string;
  title: string;
  action?: React.ReactNode;
}

export default function GroupHeader({ kicker, title, action }: GroupHeaderProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      <View>
        {kicker ? (
          <Text style={[styles.eyebrow, { color: colors.text3 }]}>{kicker}</Text>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 10,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 20,
      fontWeight: '500',
      letterSpacing: -0.6,
      marginTop: 3,
      lineHeight: 23,
    },
  });
