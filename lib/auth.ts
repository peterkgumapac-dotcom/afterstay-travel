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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout — never block more than 3s
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
        // Clear stale cache when user signs in or out
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
  // PKCE flow returns ?code=... in the URL, implicit flow returns #access_token=...
  useEffect(() => {
    const handleOAuthUrl = async (url: string) => {
      if (!url.includes('auth/callback')) return;

      // PKCE flow: exchange code for session
      const codeMatch = url.match(/[?&]code=([^&#]+)/);
      if (codeMatch) {
        const code = codeMatch[1];
        await supabase.auth.exchangeCodeForSession(code);
        return;
      }

      // Implicit flow fallback: extract tokens from fragment
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

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => { if (url) handleOAuthUrl(url); });

    // Listen for deep links while app is running
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
        signOut,
      },
    },
    children,
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
