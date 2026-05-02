import * as SecureStore from 'expo-secure-store'

/**
 * Supabase-compatible storage adapter backed by expo-secure-store.
 * Encrypts auth tokens at rest (Keychain on iOS, EncryptedSharedPreferences on Android).
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value)
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key)
  },
}
