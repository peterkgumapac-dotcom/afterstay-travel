const INTERNAL_QA_TESTER_EMAIL = process.env.EXPO_PUBLIC_INTERNAL_QA_TESTER_EMAIL?.trim().toLowerCase() ?? '';
const INTERNAL_QA_FLAG_ENABLED = process.env.EXPO_PUBLIC_ENABLE_INTERNAL_QA === 'true';

export function isInternalQaBuildEnabled(): boolean {
  return __DEV__ || (INTERNAL_QA_FLAG_ENABLED && Boolean(INTERNAL_QA_TESTER_EMAIL));
}

export function canUseInternalQaTools(email?: string | null): boolean {
  return isInternalQaBuildEnabled() && Boolean(INTERNAL_QA_TESTER_EMAIL) && email?.trim().toLowerCase() === INTERNAL_QA_TESTER_EMAIL;
}
