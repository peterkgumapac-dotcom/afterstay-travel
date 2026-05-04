const PROFILE_HANDLE_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

export function normalizeProfileHandle(value?: string | null): string {
  return (value ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export function isValidProfileHandle(value?: string | null): boolean {
  return PROFILE_HANDLE_REGEX.test(normalizeProfileHandle(value));
}
