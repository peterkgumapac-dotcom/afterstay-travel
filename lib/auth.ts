import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router as expoRouter } from 'expo-router';
import { setCacheUserId } from './cache';
import { supabase, clearTripCache } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInAsDemo: () => void;
  signOut: () => Promise<void>;
}

const HARDCODED_USER = {
  id: 'demo-user-001',
  email: 'demo@afterstay.travel',
  user_metadata: { name: 'Demo Traveler' },
} as unknown as User;

const HARDCODED_SESSION = {
  access_token: 'demo-token',
  refresh_token: 'demo-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: HARDCODED_USER,
} as unknown as Session;

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signInWithMagicLink: async () => ({ error: null }),
  signInAsDemo: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000);

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setCacheUserId(s?.user?.id);
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
        setSession(s);
        setCacheUserId(s?.user?.id);
        // Auto-create profile on first sign-in
        if ((_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') && s?.user?.id) {
          const { getProfile, ensureProfile } = await import('./supabase');
          const existing = await getProfile(s.user.id).catch(() => null);
          if (!existing) {
            const name = s.user.user_metadata?.name || s.user.user_metadata?.full_name || s.user.email?.split('@')[0] || 'Traveler';
            await ensureProfile(s.user.id, name).catch(() => {});
          }
        }
        if (_event === 'SIGNED_OUT') {
          clearTripCache();
          try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const keys = await AsyncStorage.getAllKeys();
            const tripKeys = keys.filter(k =>
              k.startsWith('trip:') || k.startsWith('flights:') ||
              k.startsWith('moments:') || k.startsWith('discover:')
            );
            if (tripKeys.length > 0) await AsyncStorage.multiRemove(tripKeys);
          } catch { /* ignore */ }
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // Handle deep link callbacks (OAuth + invite)
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // OAuth callback: afterstay://auth/callback?code=...
      if (url.includes('auth/callback')) {
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
      setSession(data.session);
    }
    return { error: error?.message ?? null };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  };

  const signInAsDemo = () => {
    setSession(HARDCODED_SESSION);
  };

  const signOut = async () => {
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
        signInAsDemo,
        signOut,
      },
    },
    children,
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
