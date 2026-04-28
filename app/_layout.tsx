import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import AfterStayLoader from '@/components/AfterStayLoader';
import { ThemeProvider, useTheme } from '@/constants/ThemeContext';
import { AuthProvider, useAuth } from '@/lib/auth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
import { useAppUpdates } from '@/hooks/useAppUpdates';
import { verifyConfig } from '@/lib/config';
import { queryClient } from '@/lib/queryClient';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { mode, colors: c } = useTheme();
  const { loading } = useAuth();
  usePushNotifications();
  useBackgroundTasks();
  useAppUpdates();

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: c.bg,
      card: c.card,
      border: c.border,
      text: c.text,
      primary: c.accent,
      notification: c.accent,
    },
  };

  if (loading) {
    return (
      <NavThemeProvider value={navTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <AfterStayLoader />
      </NavThemeProvider>
    );
  }

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip-planner"
          options={{ presentation: 'modal', title: 'Trip Planner', headerShown: true }}
        />
        <Stack.Screen
          name="add-expense"
          options={{ presentation: 'modal', title: 'Add Expense', headerShown: true }}
        />
        <Stack.Screen
          name="add-place"
          options={{ presentation: 'modal', title: 'Add Place', headerShown: true }}
        />
        <Stack.Screen
          name="add-moment"
          options={{ presentation: 'modal', title: 'Add Moment', headerShown: true }}
        />
        <Stack.Screen
          name="add-member"
          options={{ presentation: 'modal', title: 'Add Member', headerShown: true }}
        />
        <Stack.Screen
          name="scan-trip"
          options={{ presentation: 'modal', title: 'Scan Trip', headerShown: true }}
        />
        <Stack.Screen
          name="invite"
          options={{ presentation: 'modal', title: 'Invite Members', headerShown: true }}
        />
        <Stack.Screen
          name="join-trip"
          options={{ presentation: 'modal', title: 'Join Trip', headerShown: true }}
        />
        <Stack.Screen
          name="group-chat"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="add-file"
          options={{ presentation: 'modal', title: 'Add File', headerShown: true }}
        />
        <Stack.Screen
          name="moments-slideshow"
          options={{ presentation: 'modal', title: 'Photo Gallery', headerShown: true }}
        />
        <Stack.Screen
          name="trip-overview"
          options={{ presentation: 'modal', title: 'Trip Overview', headerShown: true }}
        />
        <Stack.Screen
          name="scan-receipt"
          options={{ presentation: 'modal', title: 'Scan Receipt', headerShown: true }}
        />
        <Stack.Screen
          name="place-details"
          options={{ presentation: 'modal', title: 'Place Details', headerShown: true }}
        />
        <Stack.Screen
          name="trip-summary"
          options={{ presentation: 'modal', title: 'Trip Summary', headerShown: false }}
        />
        <Stack.Screen
          name="trip-recap"
          options={{ presentation: 'fullScreenModal', title: 'Trip Recap', headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="photo-viewer"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="quick-trip-create"
          options={{ presentation: 'modal', title: 'Quick Trip', headerShown: false }}
        />
        <Stack.Screen
          name="quick-trip-detail"
          options={{ presentation: 'modal', title: 'Quick Trip', headerShown: false }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{ presentation: 'modal', title: 'Notifications', headerShown: false }}
        />
        <Stack.Screen
          name="trip-memory"
          options={{ presentation: 'modal', title: 'Trip Memory', headerShown: false }}
        />
        <Stack.Screen
          name="new-album"
          options={{ presentation: 'modal', title: 'New Album', headerShown: false }}
        />
        <Stack.Screen
          name="album-detail"
          options={{ presentation: 'modal', title: 'Album', headerShown: false }}
        />
      </Stack>
    </NavThemeProvider>
  );
}


export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    verifyConfig();
  }, []);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RootLayoutInner />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
