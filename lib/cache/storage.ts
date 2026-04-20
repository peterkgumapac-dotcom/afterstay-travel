// MMKV singleton — falls back to a Map-based shim in Expo Go
// (react-native-mmkv is a native module, unavailable in Expo Go)

let storage: {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
};

try {
  const { createMMKV } = require('react-native-mmkv');
  storage = createMMKV();
} catch {
  // Expo Go fallback — in-memory only, no persistence
  const map = new Map<string, string>();
  storage = {
    getString: (key: string) => map.get(key),
    set: (key: string, value: string) => { map.set(key, value); },
    remove: (key: string) => { map.delete(key); },
  };
}

export { storage };
