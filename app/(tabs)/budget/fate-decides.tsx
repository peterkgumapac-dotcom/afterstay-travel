import * as ScreenOrientation from 'expo-screen-orientation';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FateHeader from '@/components/fate/shared/FateHeader';
import ModeTabs from '@/components/fate/shared/ModeTabs';
import NameList from '@/components/fate/shared/NameList';
import { fateColors } from '@/constants/fateTheme';
import { useFateNames } from '@/hooks/fate/useFateNames';

type FateMode = 'wheel' | 'touch';

export default function FateDecidesScreen() {
  const [mode, setMode] = useState<FateMode>('wheel');
  const { names, setNames } = useFateNames();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <FateHeader
          kicker="Fate Decides"
          headline={mode === 'wheel' ? 'Spin the Wheel' : 'Touch of Fate'}
          body={
            mode === 'wheel'
              ? 'Add names, spin, and let fate decide who picks up the tab.'
              : 'Everyone places a finger. Fate chooses the unlucky one.'
          }
        />

        <ModeTabs activeMode={mode} onModeChange={setMode} />

        <NameList
          names={names}
          onChange={setNames}
          minNames={2}
          maxNames={10}
        />

        {/* Phase 3+: WheelScreen / TouchScreen will render here based on mode */}
        <View style={styles.gameArea} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: fateColors.background },
  container: { flex: 1, paddingHorizontal: 20 },
  gameArea: { flex: 1 },
});
