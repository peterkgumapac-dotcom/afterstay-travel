import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AfterStayLoader from '@/components/AfterStayLoader';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';

export default function AuthCallback() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    // The AuthProvider's deep link handler in lib/auth.ts
    // handles token extraction and session exchange.
    // This screen just waits for session to appear, then redirects.

    // Fallback: if session doesn't appear in 5s, go home anyway
    const timeout = setTimeout(() => router.replace('/'), 5000);
    return () => clearTimeout(timeout);
  }, [router]);

  // Redirect once session is available
  useEffect(() => {
    if (session) {
      router.replace('/');
    }
  }, [session, router]);

  return <AfterStayLoader />;
}
