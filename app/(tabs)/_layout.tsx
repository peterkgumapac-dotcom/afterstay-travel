// Note: guide and settings are routable screens outside the tab bar.
// They are configured as hidden triggers below per NativeTabs requirements.
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { useTheme } from '@/constants/ThemeContext';
import { useUserSegment } from '@/contexts/UserSegmentContext';

/* ---------- Tab bar visibility context (kept for backward compat) ---------- */

interface TabBarVisibilityContextValue {
  visible: boolean;
  setVisible: (v: boolean) => void;
  fabVisible: boolean;
  setFabVisible: (v: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  visible: true,
  setVisible: () => {},
  fabVisible: true,
  setFabVisible: () => {},
});

export function useTabBarVisibility(): TabBarVisibilityContextValue {
  return useContext(TabBarVisibilityContext);
}

/* ---------- Icon mapping: lucide → MaterialCommunityIcons ---------- */

const TAB_ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  home: 'home-outline',
  moments: 'camera-outline',
  discover: 'compass-outline',
  budget: 'wallet-outline',
  trip: 'airplane',
};

const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  moments: 'Moments',
  discover: 'Discover',
  budget: 'Budget',
  trip: 'My Trips',
};

/* ---------- Native Tabs Layout ---------- */

export default function TabLayout() {
  const { colors } = useTheme();
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const [fabVisible, setFabVisible] = useState(true);

  const visibilityValue = useMemo(
    () => ({ visible: tabBarVisible, setVisible: setTabBarVisible, fabVisible, setFabVisible }),
    [tabBarVisible, fabVisible],
  );

  return (
      <TabBarVisibilityContext.Provider value={visibilityValue}>
        <NativeTabs
          backgroundColor={colors.card}
          tintColor={colors.accent}
          iconColor={{ default: colors.text3, selected: colors.accent }}
          blurEffect="systemChromeMaterial"
          shadowColor={colors.border}
          hidden={!tabBarVisible}
          minimizeBehavior="onScrollDown"
        >
          <NativeTabs.Trigger name="home">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.home}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.home}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="moments">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.moments}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.moments}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="discover">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.discover}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.discover}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="budget">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.budget}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.budget}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="trip">
            <NativeTabs.Trigger.Icon
              src={
                <NativeTabs.Trigger.VectorIcon
                  family={MaterialCommunityIcons}
                  name={TAB_ICON_MAP.trip}
                />
              }
            />
            <NativeTabs.Trigger.Label>{TAB_LABELS.trip}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>

          {/* Hidden tabs — still routable but not shown in tab bar */}
          <NativeTabs.Trigger name="guide" hidden>
            <NativeTabs.Trigger.Label>Guide</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>

        {/* Global FAB — rendered above native tabs */}
        {tabBarVisible && fabVisible && <FloatingActionButton />}
        <TestModeBanner />
      </TabBarVisibilityContext.Provider>
  );
}

/* ---------- Test Mode Banner ---------- */

function TestModeBanner() {
  const { isTestMode, mockKeyLabel } = useUserSegment();
  const insets = useSafeAreaInsets();
  if (!isTestMode) return null;
  return (
    <View style={[testStyles.banner, { top: insets.top }]}>
      <Text style={testStyles.text}>
        TEST: {mockKeyLabel ?? 'unknown'}
      </Text>
    </View>
  );
}

const testStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#c4554a',
    paddingVertical: 4,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
