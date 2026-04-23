import * as ScreenOrientation from 'expo-screen-orientation';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FateHeader from '@/components/fate/shared/FateHeader';
import ModeTabs from '@/components/fate/shared/ModeTabs';
import NameList from '@/components/fate/shared/NameList';
import TouchScreen from '@/components/fate/touch/TouchScreen';
import WheelScreen from '@/components/fate/wheel/WheelScreen';
import { fateColors } from '@/constants/fateTheme';
import { useFateNames } from '@/hooks/fate/useFateNames';

type FateMode = 'wheel' | 'touch';

export default function FateDecidesScreen() {
  const [mode, setMode] = useState<FateMode>('wheel');
  const { names, setNames } = useFateNames();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
        >
          <ArrowLeft size={22} color={fateColors.textPrimary} strokeWidth={2} />
        </Pressable>

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

        {mode === 'wheel' ? (
          <WheelScreen names={names} />
        ) : (
          <TouchScreen />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: fateColors.background },
  container: { flex: 1, paddingHorizontal: 20 },
  backButton: { marginBottom: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
