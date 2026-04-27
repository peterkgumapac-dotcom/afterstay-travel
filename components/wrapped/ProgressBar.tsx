import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface ProgressBarProps {
  total: number;
  current: number;
}

export default function ProgressBar({ total, current }: ProgressBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            i <= current ? styles.segmentActive : styles.segmentInactive,
          ]}
        />
      ))}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    segment: {
      flex: 1,
      height: 3,
      borderRadius: 2,
    },
    segmentActive: {
      backgroundColor: 'rgba(255,255,255,0.9)',
    },
    segmentInactive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
  });
