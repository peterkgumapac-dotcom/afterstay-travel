import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/constants/ThemeContext';
import { AuthProvider, useAuth } from '@/lib/auth';
import { verifyConfig } from '@/lib/config';
import { queryClient, persister } from '@/lib/queryClient';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { mode, colors: c } = useTheme();
  const { session, loading } = useAuth();

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

  if (loading) return null; // splash screen still visible

  if (!session) {
    return (
      <NavThemeProvider value={navTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth/login" />
        </Stack>
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
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip-planner"
          options={{ presentation: 'modal', title: 'Trip Planner' }}
        />
        <Stack.Screen
          name="add-expense"
          options={{ presentation: 'modal', title: 'Add Expense' }}
        />
        <Stack.Screen
          name="add-place"
          options={{ presentation: 'modal', title: 'Add Place' }}
        />
        <Stack.Screen
          name="add-moment"
          options={{ presentation: 'modal', title: 'Add Moment' }}
        />
        <Stack.Screen
          name="add-file"
          options={{ presentation: 'modal', title: 'Add File' }}
        />
        <Stack.Screen
          name="moments-slideshow"
          options={{ presentation: 'modal', title: 'Photo Gallery' }}
        />
        <Stack.Screen
          name="trip-overview"
          options={{ presentation: 'modal', title: 'Trip Overview' }}
        />
        <Stack.Screen
          name="scan-receipt"
          options={{ presentation: 'modal', title: 'Scan Receipt' }}
        />
        <Stack.Screen
          name="place-details"
          options={{ presentation: 'modal', title: 'Place Details' }}
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
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutInner />
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
