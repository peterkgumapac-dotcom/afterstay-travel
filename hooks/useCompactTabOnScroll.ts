import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { type CompactTabName, useTabBarVisibility } from '@/app/(tabs)/_layout';

const COLLAPSE_OFFSET = 72;
const COLLAPSE_DELTA = 8;
const EXPAND_DELTA = -12;
const TOP_RESTORE_OFFSET = 18;

export function useCompactTabOnScroll(tab: CompactTabName) {
  const { setVisible, setFabVisible, setCompactTab } = useTabBarVisibility();
  const lastYRef = useRef(0);
  const compactRef = useRef(false);

  const restoreTabBar = useCallback(() => {
    compactRef.current = false;
    lastYRef.current = 0;
    setCompactTab(null);
    setVisible(true);
    setFabVisible(true);
  }, [setCompactTab, setFabVisible, setVisible]);

  useFocusEffect(
    useCallback(() => {
      restoreTabBar();
      return restoreTabBar;
    }, [restoreTabBar]),
  );

  const handleScrollY = useCallback((value: number) => {
    const y = Math.max(0, value);
    const delta = y - lastYRef.current;
    lastYRef.current = y;

    if (!compactRef.current && y > COLLAPSE_OFFSET && delta > COLLAPSE_DELTA) {
      compactRef.current = true;
      setCompactTab(tab);
      setFabVisible(false);
      setVisible(false);
      return;
    }

    if (compactRef.current && (y <= TOP_RESTORE_OFFSET || delta < EXPAND_DELTA)) {
      compactRef.current = false;
      setCompactTab(null);
      setVisible(true);
      setFabVisible(true);
    }
  }, [setCompactTab, setFabVisible, setVisible, tab]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleScrollY(event.nativeEvent.contentOffset.y);
  }, [handleScrollY]);

  return { handleScroll, handleScrollY, restoreTabBar };
}
