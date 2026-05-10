import { cacheGet, cacheGetForUser, cacheSet, cacheSetForUser } from './cache';
import { supabase } from './supabase';

export type OnboardingPath = 'plan' | 'upload' | 'invited';

export type OnboardingStage =
  | 'welcome'
  | 'path_picker'
  | 'planning_started'
  | 'planning_draft'
  | 'upload_started'
  | 'upload_review'
  | 'invited_code'
  | 'invited_joined_needs_details'
  | 'complete'
  | 'skipped';

export interface OnboardingProgress {
  status: 'in_progress' | 'complete' | 'skipped';
  stage: OnboardingStage;
  path?: OnboardingPath;
  tripId?: string;
  updatedAt: string;
  completedAt?: string;
  meta?: Record<string, unknown>;
}

const PROGRESS_KEY = 'onboarding:progress';
const SCAN_REVIEW_KEY = 'onboarding:scan_review';
const COMPLETE_KEY = 'onboarding_complete';

function keyFor(base: string, userId?: string): string {
  return userId ? `${base}:${userId}` : base;
}

function getScoped<T>(key: string, userId: string | undefined, ttlMs = 0): Promise<T | undefined> {
  return userId ? cacheGetForUser<T>(key, userId, ttlMs) : cacheGet<T>(key, ttlMs);
}

function setScoped<T>(key: string, value: T, userId: string | undefined): Promise<void> {
  return userId ? cacheSetForUser(key, value, userId) : cacheSet(key, value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeProgress(value: unknown): OnboardingProgress | undefined {
  if (!isObject(value)) return undefined;
  const stage = typeof value.stage === 'string' ? value.stage as OnboardingStage : undefined;
  const status = value.status === 'complete' || value.status === 'skipped'
    ? value.status
    : 'in_progress';
  if (!stage) return undefined;
  return {
    status,
    stage,
    path: typeof value.path === 'string' ? value.path as OnboardingPath : undefined,
    tripId: typeof value.tripId === 'string' ? value.tripId : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : undefined,
    meta: isObject(value.meta) ? value.meta : undefined,
  };
}

export function isOnboardingIncomplete(progress?: OnboardingProgress | null): boolean {
  return !!progress && progress.status === 'in_progress' && progress.stage !== 'complete';
}

export async function getOnboardingProgress(userId?: string): Promise<OnboardingProgress | undefined> {
  const cacheKey = keyFor(PROGRESS_KEY, userId);
  const cached = normalizeProgress(await getScoped<unknown>(cacheKey, userId, 0));

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_state,onboarded_at')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data) {
        const remote = normalizeProgress((data as Record<string, unknown>).onboarding_state);
        if (remote) {
          await setScoped(cacheKey, remote, userId);
          return remote;
        }
        if ((data as Record<string, unknown>).onboarded_at) {
          const complete = makeCompletionProgress('complete');
          await setScoped(cacheKey, complete, userId);
          return complete;
        }
      }
    } catch {
      // Backend column may not exist yet. Local scoped cache still works.
    }
  }

  return cached;
}

export async function setOnboardingProgress(
  patch: Partial<OnboardingProgress> & { stage: OnboardingStage },
  userId?: string,
): Promise<OnboardingProgress> {
  const cacheKey = keyFor(PROGRESS_KEY, userId);
  const current = normalizeProgress(await getScoped<unknown>(cacheKey, userId, 0));
  const hasPath = Object.prototype.hasOwnProperty.call(patch, 'path');
  const hasTripId = Object.prototype.hasOwnProperty.call(patch, 'tripId');
  const hasMeta = Object.prototype.hasOwnProperty.call(patch, 'meta');
  const next: OnboardingProgress = {
    status: patch.status ?? current?.status ?? 'in_progress',
    stage: patch.stage,
    path: hasPath ? patch.path : current?.path,
    tripId: hasTripId ? patch.tripId : current?.tripId,
    meta: hasMeta ? patch.meta : current?.meta,
    updatedAt: new Date().toISOString(),
    completedAt: patch.completedAt ?? current?.completedAt,
  };

  await setScoped(cacheKey, next, userId);
  if (userId) await syncProgressToProfile(userId, next);
  return next;
}

export async function completeOnboarding(userId?: string, skipped = false): Promise<void> {
  const complete = makeCompletionProgress(skipped ? 'skipped' : 'complete');
  await Promise.all([
    setScoped(keyFor(COMPLETE_KEY, userId), true, userId),
    setScoped(keyFor(PROGRESS_KEY, userId), complete, userId),
    setScoped(keyFor(SCAN_REVIEW_KEY, userId), null, userId),
  ]);
  if (userId) await syncProgressToProfile(userId, complete, true);
}

export async function saveOnboardingScanReview(scan: unknown, userId?: string): Promise<void> {
  await setScoped(keyFor(SCAN_REVIEW_KEY, userId), scan, userId);
}

export async function getOnboardingScanReview<T = unknown>(userId?: string): Promise<T | undefined> {
  const value = await getScoped<T | null>(keyFor(SCAN_REVIEW_KEY, userId), userId, 0);
  return value ?? undefined;
}

export async function clearOnboardingScanReview(userId?: string): Promise<void> {
  await setScoped(keyFor(SCAN_REVIEW_KEY, userId), null, userId);
}

function makeCompletionProgress(status: 'complete' | 'skipped'): OnboardingProgress {
  const now = new Date().toISOString();
  return {
    status,
    stage: status === 'skipped' ? 'skipped' : 'complete',
    updatedAt: now,
    completedAt: now,
  };
}

async function syncProgressToProfile(userId: string, progress: OnboardingProgress, markOnboarded = false): Promise<void> {
  try {
    const row: Record<string, unknown> = { onboarding_state: progress };
    if (markOnboarded) row.onboarded_at = progress.completedAt ?? new Date().toISOString();
    const { error: rpcError } = await supabase.rpc('update_own_onboarding_state', {
      p_state: progress,
      p_onboarded_at: markOnboarded ? row.onboarded_at : null,
    });
    if (!rpcError) return;
    await supabase.from('profiles').update(row).eq('id', userId);
  } catch {
    // Best-effort: the app can run before the backend migration lands.
  }
}
