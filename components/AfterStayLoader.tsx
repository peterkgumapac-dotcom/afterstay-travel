import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import PlaneScene from './loader/PlaneScene';
import CompassScene from './loader/CompassScene';
import SunriseScene from './loader/SunriseScene';

interface AfterStayLoaderProps {
  readonly message?: string;
}

const SCENES = [PlaneScene, CompassScene, SunriseScene];

export default function AfterStayLoader({ message }: AfterStayLoaderProps) {
  const { colors } = useTheme();
  const Scene = useMemo(() => SCENES[Math.floor(Math.random() * SCENES.length)], []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.sceneBox}>
        <Scene />
      </View>
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
  sceneBox: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
