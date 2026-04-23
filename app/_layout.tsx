import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/constants/ThemeContext';
import { AuthProvider, useAuth } from '@/lib/auth';
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
        <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.accent} size="large" />
          <Text style={{ color: c.text3, fontSize: 10, marginTop: 12 }}>v7 · Apr 22</Text>
        </View>
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
        <Stack.Screen name="auth" options={{ headerShown: false }} />
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutInner />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
