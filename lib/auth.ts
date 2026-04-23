import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
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

  // Handle deep link OAuth callbacks
  useEffect(() => {
    const handleOAuthUrl = async (url: string) => {
      if (!url.includes('auth/callback')) return;

      const codeMatch = url.match(/[?&]code=([^&#]+)/);
      if (codeMatch) {
        const code = codeMatch[1];
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      const fragment = url.split('#')[1];
      if (fragment) {
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleOAuthUrl(url); });

    const sub = Linking.addEventListener('url', ({ url }) => handleOAuthUrl(url));
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
