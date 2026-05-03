import { secureStorage } from '@/lib/secureStorage';

const PENDING_INVITE_CODE_KEY = 'afterstay:pending_invite_code';

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

export async function storePendingInviteCode(code: string): Promise<void> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return;
  await secureStorage.setItem(PENDING_INVITE_CODE_KEY, normalized);
}

export async function consumePendingInviteCode(): Promise<string | null> {
  const code = await secureStorage.getItem(PENDING_INVITE_CODE_KEY);
  if (!code) return null;
  await secureStorage.removeItem(PENDING_INVITE_CODE_KEY);
  return normalizeInviteCode(code) || null;
}

export async function clearPendingInviteCode(code?: string): Promise<void> {
  if (code) {
    const current = await peekPendingInviteCode();
    if (current && current !== normalizeInviteCode(code)) return;
  }
  await secureStorage.removeItem(PENDING_INVITE_CODE_KEY);
}

export async function peekPendingInviteCode(): Promise<string | null> {
  const code = await secureStorage.getItem(PENDING_INVITE_CODE_KEY);
  return code ? normalizeInviteCode(code) || null : null;
}
