import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router as expoRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStorage';
import { clearTripLocalData, setCacheUserId } from './cache';
import { clearGoogleSession } from './googleAuth';
import { supabase, clearTripCache } from './supabase';
import { clearTabDataCache, setTabDataCacheUserId } from './tabDataCache';
import type { Session, User } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signInWithMagicLink: async () => ({ error: null }),
  signOut: async () => {},
});

/**
 * One-time migration: move Supabase auth session from AsyncStorage to SecureStore.
 * After migration, the key is deleted from AsyncStorage so this only runs once.
 */
const SUPABASE_SESSION_KEY = 'sb-' + (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/https?:\/\//, '').split('.')[0] + '-auth-token';

async function migrateSessionToSecureStore(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(SUPABASE_SESSION_KEY);
    if (!existing) return;
    // Already migrated if SecureStore has the key
    const inSecure = await secureStorage.getItem(SUPABASE_SESSION_KEY);
    if (inSecure) {
      await AsyncStorage.removeItem(SUPABASE_SESSION_KEY);
      return;
    }
    await secureStorage.setItem(SUPABASE_SESSION_KEY, existing);
    await AsyncStorage.removeItem(SUPABASE_SESSION_KEY);
  } catch {
    // Non-fatal — worst case user re-authenticates
  }
}

function applyAccountScope(s: Session | null): void {
  const userId = s?.user?.id;
  setCacheUserId(userId);
  setTabDataCacheUserId(userId);
}

async function ensureSessionProfile(s: Session | null): Promise<void> {
  const user = s?.user;
  if (!user?.id) return;

  const { getProfile, ensureProfile } = await import('./supabase');
  const existing = await getProfile(user.id).catch(() => null);
  if (existing) return;

  const name =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Traveler';

  await ensureProfile(user.id, name).catch(async (err) => {
    if (__DEV__) console.warn('[auth] ensureProfile failed, retrying:', err);
    await ensureProfile(user.id, name).catch(() => {});
  });
}

async function clearAccountState(): Promise<void> {
  clearTripCache();
  clearTabDataCache();
  await clearTripLocalData();
  setCacheUserId(undefined);
  setTabDataCacheUserId(undefined);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000);

    migrateSessionToSecureStore().then(() => supabase.auth.getSession())
      .then(async ({ data: { session: s } }) => {
        applyAccountScope(s);
        await ensureSessionProfile(s);
        setSession(s);
      })
      .catch(() => {
        // Ignore — stay on login screen
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (_event === 'SIGNED_OUT') {
          await clearAccountState();
          setSession(null);
          return;
        }

        applyAccountScope(s);
        await ensureSessionProfile(s);
        setSession(s);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle deep link callbacks (OAuth + invite)
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // OAuth callback: afterstay://auth/callback?code=...
      if (url.includes('auth/callback')) {
        // Validate CSRF state parameter
        const stateMatch = url.match(/[?&]state=([^&#]+)/);
        if (stateMatch) {
          const returnedState = decodeURIComponent(stateMatch[1]);
          const savedState = await secureStorage.getItem('oauth_state');
          await secureStorage.removeItem('oauth_state');
          if (!savedState || returnedState !== savedState) {
            if (__DEV__) console.warn('[auth] OAuth state mismatch — possible CSRF');
            return;
          }
        }

        const codeMatch = url.match(/[?&]code=([^&#]+)/);
        if (codeMatch) {
          await supabase.auth.exchangeCodeForSession(codeMatch[1]);
          return;
        }
        const fragment = url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
        return;
      }

      // Invite deep link: afterstay://join-trip?code=X
      const joinParamMatch = url.match(/[?&]code=([^&#]+)/);
      if (url.includes('join-trip') && joinParamMatch) {
        expoRouter.push({ pathname: '/join-trip', params: { code: joinParamMatch[1] } });
        return;
      }

      // Universal link: https://afterstay.travel/join/CODE
      const joinPathMatch = url.match(/\/join\/([A-Za-z0-9]+)/);
      if (joinPathMatch) {
        expoRouter.push({ pathname: '/join-trip', params: { code: joinPathMatch[1] } });
        return;
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      const { data } = await supabase.auth.getSession();
      applyAccountScope(data.session);
      await ensureSessionProfile(data.session);
      setSession(data.session);
    }
    return { error: error?.message ?? null };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await clearGoogleSession();
    await clearAccountState();
    await supabase.auth.signOut();
    setSession(null);
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user: session?.user ?? null,
        session,
        loading,
        signIn,
        signInWithMagicLink,
        signOut,
      },
    },
    children,
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Generate and store a CSRF state parameter before initiating an OAuth flow.
 * Pass the returned state as the `state` query param in the authorization URL.
 */
export async function generateOAuthState(): Promise<string> {
  const state = Crypto.randomUUID();
  await secureStorage.setItem('oauth_state', state);
  return state;
}
