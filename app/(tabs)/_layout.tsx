import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { useTheme } from '@/constants/ThemeContext';
import { UserSegmentProvider } from '@/contexts/UserSegmentContext';

/* ---------- Tab bar visibility context (kept for backward compat) ---------- */

interface TabBarVisibilityContextValue {
  visible: boolean;
  setVisible: (v: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  visible: true,
  setVisible: () => {},
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

  const visibilityValue = useMemo(
    () => ({ visible: tabBarVisible, setVisible: setTabBarVisible }),
    [tabBarVisible],
  );

  return (
    <UserSegmentProvider>
      <TabBarVisibilityContext.Provider value={visibilityValue}>
        <NativeTabs
          backgroundColor={colors.card}
          tintColor={colors.accent}
          iconColor={{ default: colors.text3, selected: colors.accent }}
          blurEffect="systemChromeMaterial"
          shadowColor={colors.border}
          hidden={!tabBarVisible}
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
          <Tabs.Screen name="guide" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
        </NativeTabs>

        {/* Global FAB — rendered above native tabs */}
        {tabBarVisible && Platform.OS === 'ios' && <FloatingActionButton />}
      </TabBarVisibilityContext.Provider>
    </UserSegmentProvider>
  );
}
