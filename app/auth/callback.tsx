import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AfterStayLoader from '@/components/AfterStayLoader';
import { isResumingPendingInvite, useAuth } from '@/lib/auth';
import { peekPendingInviteCode } from '@/lib/pendingInvite';

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
    if (!session) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || isResumingPendingInvite()) return;
      const pendingInviteCode = await peekPendingInviteCode().catch(() => null);
      if (cancelled || pendingInviteCode || isResumingPendingInvite()) return;
      router.replace('/');
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, router]);

  return <AfterStayLoader />;
}
