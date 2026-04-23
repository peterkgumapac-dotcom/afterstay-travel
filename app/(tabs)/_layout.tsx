import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { BookOpen, Compass, Home, Plane, Wallet } from 'lucide-react-native';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { useTheme } from '@/constants/ThemeContext';

/* ---------- Tab bar visibility context ---------- */

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

const TAB_ICONS = {
  home: Home,
  guide: BookOpen,
  discover: Compass,
  budget: Wallet,
  trip: Plane,
} as const;

const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  guide: 'Guide',
  discover: 'Discover',
  budget: 'Budget',
  trip: 'Our Trip',
};

function TabBarOverlay({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { visible } = useTabBarVisibility();
  const bottomOffset = Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : 16;

  if (!visible) return null;

  const visibleRoutes = state.routes.filter(
    (route) => (descriptors[route.key]?.options as Record<string, unknown>)?.href !== null
  );

  const tabBar = (
    <View
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 10,
        right: 10,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 28,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
          },
          android: { elevation: 8 },
        }),
      }}
    >
      {visibleRoutes.map((route) => {
        const originalIndex = state.routes.indexOf(route);
        const focused = state.index === originalIndex;
        const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
        if (!Icon) return null;

        const color = focused ? colors.accent : colors.text3;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={TAB_LABELS[route.name] ?? route.name}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 9,
              borderRadius: 18,
            }}
          >
            <Icon size={20} color={color} strokeWidth={1.8} />
            <Text
              style={{
                fontSize: 10.5,
                fontWeight: '600',
                color,
                marginTop: 3,
                letterSpacing: -0.1,
              }}
            >
              {TAB_LABELS[route.name] ?? route.name}
            </Text>
            {focused && (
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.accent,
                  marginTop: 3,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{tabBar}</FullWindowOverlay>;
  }

  return tabBar;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [tabBarVisible, setTabBarVisible] = useState(true);

  const visibilityValue = useMemo(
    () => ({ visible: tabBarVisible, setVisible: setTabBarVisible }),
    [tabBarVisible],
  );

  return (
    <TabBarVisibilityContext.Provider value={visibilityValue}>
      <Tabs
        tabBar={(props) => <TabBarOverlay {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: { color: colors.text, fontWeight: '600' },
          headerShown: false,
          headerShadowVisible: false,
          headerTintColor: colors.text,
        }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="guide" options={{ title: 'Guide' }} />
        <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
        <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
        <Tabs.Screen name="trip" options={{ title: 'Our Trip' }} />

        {/* Hidden tabs — accessible via FAB and gear icon */}
        <Tabs.Screen name="moments" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </TabBarVisibilityContext.Provider>
  );
}
