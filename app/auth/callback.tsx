import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AfterStayLoader from '@/components/AfterStayLoader';
import { useAuth } from '@/lib/auth';

export default function AuthCallback() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace({
        pathname: '/auth/login',
        params: { error: 'Magic link expired or network failed. Please request a new link.' },
      });
    }, 10000);
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
