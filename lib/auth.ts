import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router as expoRouter } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStorage';
import { clearTripLocalData, setCacheUserId } from './cache';
import { clearGoogleSession } from './googleAuth';
import { supabase, clearTripCache } from './supabase';
import { clearTabDataCache, setTabDataCacheUserId } from './tabDataCache';
import { consumePendingInviteCode, storePendingInviteCode } from './pendingInvite';
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
const AUTH_TIMEOUT_MS = 12_000;
const PROFILE_TIMEOUT_MS = 8_000;
const AUTH_BOOT_TIMEOUT_MS = 15_000;
const SESSION_MIGRATION_TIMEOUT_MS = 4_000;

function withAuthTimeout<T>(promise: PromiseLike<T>, message: string, ms = AUTH_TIMEOUT_MS): Promise<T> {
  const wrapped = Promise.resolve(promise);
  return Promise.race([
    wrapped,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      wrapped.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer),
      );
    }),
  ]);
}

function authErrorMessage(err: unknown, fallback = 'Network error. Please check your connection and try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

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
  const existing = await withAuthTimeout(
    getProfile(user.id).catch(() => null),
    'Profile lookup timed out.',
    PROFILE_TIMEOUT_MS,
  ).catch(() => null);
  if (existing) return;

  const name =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Traveler';

  await withAuthTimeout(ensureProfile(user.id, name), 'Profile setup timed out.', PROFILE_TIMEOUT_MS).catch(async (err) => {
    if (__DEV__) console.warn('[auth] ensureProfile failed, retrying:', err);
    await withAuthTimeout(ensureProfile(user.id, name), 'Profile setup timed out.', PROFILE_TIMEOUT_MS).catch(() => {});
  });
}

async function clearAccountState(): Promise<void> {
  clearTripCache();
  clearTabDataCache();
  await clearTripLocalData();
  setCacheUserId(undefined);
  setTabDataCacheUserId(undefined);
}

let pendingInviteResumeUntil = 0;

export function isResumingPendingInvite(): boolean {
  return Date.now() < pendingInviteResumeUntil;
}

async function resumePendingInvite(s: Session | null): Promise<void> {
  if (!s?.user?.id) return;
  const code = await consumePendingInviteCode().catch(() => null);
  if (!code) return;
  pendingInviteResumeUntil = Date.now() + 8000;
  setTimeout(() => {
    expoRouter.replace({ pathname: '/join-trip', params: { code } });
  }, 100);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const finishLoading = () => {
      if (!cancelled) setLoading(false);
    };

    const watchdog = setTimeout(() => {
      if (__DEV__) console.warn('[auth] boot watchdog released loading state');
      finishLoading();
    }, AUTH_BOOT_TIMEOUT_MS);

    (async () => {
      try {
        await withAuthTimeout(
          migrateSessionToSecureStore(),
          'Session migration timed out.',
          SESSION_MIGRATION_TIMEOUT_MS,
        ).catch((err) => {
          if (__DEV__) console.warn('[auth] session migration skipped:', err);
        });

        const { data: { session: s } } = await withAuthTimeout(
          supabase.auth.getSession(),
          'Session restore timed out.',
        );
        if (cancelled) return;

        applyAccountScope(s);
        await ensureSessionProfile(s);
        if (cancelled) return;

        setSession(s);
        await resumePendingInvite(s);
      } catch (err) {
        if (__DEV__) console.warn('[auth] initial session restore failed:', err);
        if (!cancelled) setSession(null);
      } finally {
        clearTimeout(watchdog);
        finishLoading();
      }
    })();

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
        await resumePendingInvite(s);
      },
    );

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const updateAutoRefresh = (state: AppStateStatus = AppState.currentState) => {
      const task = session && state === 'active'
        ? supabase.auth.startAutoRefresh()
        : supabase.auth.stopAutoRefresh();

      task.catch((err) => {
        if (__DEV__ && active) console.warn('[auth] auto-refresh lifecycle failed:', err);
      });
    };

    updateAutoRefresh();
    const sub = AppState.addEventListener('change', updateAutoRefresh);

    return () => {
      active = false;
      sub.remove();
    };
  }, [session]);

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
          await withAuthTimeout(
            supabase.auth.exchangeCodeForSession(codeMatch[1]),
            'Magic link sign-in timed out. Please try again.',
          ).catch((err) => {
            expoRouter.replace({
              pathname: '/auth/login',
              params: { error: authErrorMessage(err, 'Magic link failed. Please request a new link.') },
            });
          });
          return;
        }
        const fragment = url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await withAuthTimeout(
              supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
              'Magic link sign-in timed out. Please try again.',
            ).catch((err) => {
              expoRouter.replace({
                pathname: '/auth/login',
                params: { error: authErrorMessage(err, 'Magic link failed. Please request a new link.') },
              });
            });
          }
        }
        return;
      }

      // Invite deep link: afterstay://join-trip?code=X
      const joinParamMatch = url.match(/[?&]code=([^&#]+)/);
      if (url.includes('join-trip') && joinParamMatch) {
        const code = decodeURIComponent(joinParamMatch[1]);
        const {
          data: { user: currentUser },
        } = await withAuthTimeout(supabase.auth.getUser(), 'Session restore timed out.').catch(() => ({
          data: { user: null },
        }));
        if (currentUser?.id) {
          expoRouter.push({ pathname: '/join-trip', params: { code } });
        } else {
          await storePendingInviteCode(code);
          expoRouter.push('/auth/login');
        }
        return;
      }

      // Universal link: https://afterstay.travel/join/CODE
      const joinPathMatch = url.match(/\/join\/([A-Za-z0-9]+)/);
      if (joinPathMatch) {
        const code = decodeURIComponent(joinPathMatch[1]);
        const {
          data: { user: currentUser },
        } = await withAuthTimeout(supabase.auth.getUser(), 'Session restore timed out.').catch(() => ({
          data: { user: null },
        }));
        if (currentUser?.id) {
          expoRouter.push({ pathname: '/join-trip', params: { code } });
        } else {
          await storePendingInviteCode(code);
          expoRouter.push('/auth/login');
        }
        return;
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'Sign in timed out. Please check your connection and try again.',
      );
      if (error) return { error: error.message };

      const { data } = await withAuthTimeout(
        supabase.auth.getSession(),
        'Session restore timed out. Please try again.',
      );
      applyAccountScope(data.session);
      await ensureSessionProfile(data.session);
      setSession(data.session);
      await resumePendingInvite(data.session);
      return { error: null };
    } catch (err) {
      return { error: authErrorMessage(err) };
    }
  };

  const signInWithMagicLink = async (email: string) => {
    try {
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: Linking.createURL('/auth/callback'),
          },
        }),
        'Sending magic link timed out. Please check your connection and try again.',
      );
      return { error: error?.message ?? null };
    } catch (err) {
      return { error: authErrorMessage(err, 'Could not send magic link. Please check your connection and try again.') };
    }
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
