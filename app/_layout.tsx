import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { verifyConfig } from '@/lib/config';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const AfterStayDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    text: colors.text,
    primary: colors.accent,
    notification: colors.accent,
  },
};

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
    <ThemeProvider value={AfterStayDarkTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
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
    </ThemeProvider>
  );
}
