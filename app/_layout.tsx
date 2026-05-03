import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import AfterStayLoader from '@/components/AfterStayLoader';
import { ThemeProvider, useTheme } from '@/constants/ThemeContext';
import { AuthProvider, useAuth } from '@/lib/auth';
import { UserSegmentProvider } from '@/contexts/UserSegmentContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useBackgroundTasks } from '@/hooks/useBackgroundTasks';
import { useAppUpdates } from '@/hooks/useAppUpdates';
import { verifyConfig } from '@/lib/config';
import { queryClient } from '@/lib/queryClient';
import { refreshAllWidgets } from '@/widgets/refresh';

export { ErrorBoundary } from 'expo-router';

// Initialize Sentry — DSN from EAS environment variable
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });
}

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const { mode, colors: c } = useTheme();
  const { loading: authLoading } = useAuth();
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

  if (authLoading) {
    return (
      <NavThemeProvider value={navTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <AfterStayLoader
          message="Opening AfterStay..."
          steps={['Restoring your session', 'Preparing your travel workspace', 'Checking account data']}
        />
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
          options={{
            presentation: 'modal',
            title: 'Trip Planner',
            headerShown: true,
            animation: 'fade_from_bottom',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="add-expense"
          options={{
            presentation: 'modal',
            title: 'Add Expense',
            headerShown: true,
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
        />
        <Stack.Screen name="add-place" options={{ presentation: 'modal', title: 'Add Place', headerShown: true }} />
        <Stack.Screen
          name="add-moment"
          options={{
            presentation: 'modal',
            title: 'Add Moment',
            headerShown: true,
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
        />
        <Stack.Screen
          name="compose-moment"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
        />
        <Stack.Screen name="add-member" options={{ presentation: 'modal', title: 'Add Member', headerShown: true }} />
        <Stack.Screen name="scan-trip" options={{ presentation: 'modal', title: 'Scan Trip', headerShown: true }} />
        <Stack.Screen name="invite" options={{ presentation: 'modal', title: 'Invite Members', headerShown: true }} />
        <Stack.Screen name="join-trip" options={{ presentation: 'modal', title: 'Join Trip', headerShown: true }} />
        <Stack.Screen
          name="profile/[userId]"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
        />
        <Stack.Screen name="group-chat" options={{ headerShown: false }} />
        <Stack.Screen name="add-file" options={{ presentation: 'modal', title: 'Add File', headerShown: true }} />
        <Stack.Screen
          name="moments-slideshow"
          options={{
            presentation: 'fullScreenModal',
            title: 'Photo Gallery',
            headerShown: false,
            animation: 'fade',
            animationDuration: 200,
          }}
        />
        <Stack.Screen
          name="trip-overview"
          options={{
            presentation: 'modal',
            title: 'Trip Overview',
            headerShown: true,
            animation: 'fade_from_bottom',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="scan-receipt"
          options={{
            presentation: 'modal',
            title: 'Scan Receipt',
            headerShown: true,
            animation: 'slide_from_bottom',
            animationDuration: 250,
          }}
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
        <Stack.Screen name="create-post" options={{ presentation: 'modal', title: 'New Post', headerShown: false }} />
        <Stack.Screen
          name="trip-memory"
          options={{ presentation: 'modal', title: 'Trip Memory', headerShown: false }}
        />
        <Stack.Screen name="new-album" options={{ presentation: 'modal', title: 'New Album', headerShown: false }} />
        <Stack.Screen name="album-detail" options={{ presentation: 'modal', title: 'Album', headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip-wrapped"
          options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }}
        />
      </Stack>
    </NavThemeProvider>
  );
}

function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    CrimsonPro_400Regular: require('@expo-google-fonts/crimson-pro/400Regular/CrimsonPro_400Regular.ttf'),
    CrimsonPro_400Regular_Italic: require('@expo-google-fonts/crimson-pro/400Regular_Italic/CrimsonPro_400Regular_Italic.ttf'),
    CrimsonPro_600SemiBold: require('@expo-google-fonts/crimson-pro/600SemiBold/CrimsonPro_600SemiBold.ttf'),
    CrimsonPro_600SemiBold_Italic: require('@expo-google-fonts/crimson-pro/600SemiBold_Italic/CrimsonPro_600SemiBold_Italic.ttf'),
    CrimsonPro_700Bold: require('@expo-google-fonts/crimson-pro/700Bold/CrimsonPro_700Bold.ttf'),
    CrimsonPro_700Bold_Italic: require('@expo-google-fonts/crimson-pro/700Bold_Italic/CrimsonPro_700Bold_Italic.ttf'),
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

  // Refresh Android widgets when app comes to foreground
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        refreshAllWidgets();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <UserSegmentProvider>
              <RootLayoutInner />
            </UserSegmentProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
