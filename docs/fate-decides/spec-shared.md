# Fate Decides — Shared infrastructure

## File structure
```
/app/(tabs)/budget/fate-decides/
  index.tsx                   — Tab container with Wheel/Touch switcher

/components/fate/
  shared/
    FateHeader.tsx            — Kicker + headline block, reusable
    NameList.tsx              — Add/remove/edit names
    ModeTabs.tsx              — Wheel | Touch of Fate switcher
    DuoToggle.tsx             — Solo | Duo switcher
    RecentChips.tsx           — Last 5 results display
    PrimaryButton.tsx
    SecondaryButton.tsx

/hooks/fate/
  useFateHistory.ts           — AsyncStorage wrapper
  useSounds.ts                — Preload and play audio
  useHaptics.ts               — Wrapped haptic helpers
  useFateNames.ts             — Shared name list state with persistence

/constants/
  fateTheme.ts                — See spec-theme.md
  
/utils/fate/
  randomWinner.ts             — Crypto-random name selection
```

## NameList component

Props:
```ts
interface NameListProps {
  names: string[];
  onChange: (names: string[]) => void;
  minNames: number;  // 2 for solo, 3 for duo
  maxNames: number;  // 10
}
```

Behavior:
- Shows list of names as chips, each with an X to remove
- Empty input with + button to add a new name
- Validation: no duplicates (case-insensitive), no empty strings, max length 20 chars
- Haptic tap on add/remove (selectionAsync)
- Persists via useFateNames hook to AsyncStorage key `fate_names`

## useSounds hook

```ts
type SoundName = 'rattle' | 'scratch' | 'drumroll' | 'reveal' | 'heartbeat' | 'boom' | 'chime';

interface UseSoundsReturn {
  play: (name: SoundName) => Promise<void>;
  stop: (name: SoundName) => Promise<void>;
  isLoaded: boolean;
  setMuted: (muted: boolean) => void;
}

export function useSounds(): UseSoundsReturn;
```

Implementation rules:
- Preload all sounds on first mount
- Store Audio.Sound instances in a ref
- `play()` resets position to 0 before playing (so rapid re-plays work)
- On unmount, unload all sounds
- Respect global mute preference from AsyncStorage key `fate_muted`
- Set `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` on init — critical for iOS
- If loading fails, don't crash — just log and continue silently

## useHaptics hook

```ts
interface UseHapticsReturn {
  tap: () => void;              // light selection
  light: () => void;
  medium: () => void;
  heavy: () => void;
  success: () => void;
  warning: () => void;
  error: () => void;
  heartbeatTick: (intensity: 'light' | 'medium' | 'heavy') => void;
}
```

Implementation:
- All methods fire and forget (no await)
- Check `Haptics.impactAsync` availability before calling (older Androids)
- On Android devices with weak haptic motors, fall back to `Vibration.vibrate(50)` from react-native
- Throttle `tap` calls to max once per 80ms (prevents queueing during rapid spin ticks)

## useFateHistory hook

```ts
interface FateResult {
  id: string;
  mode: 'wheel' | 'touch';
  winner: string;
  duoWinner?: string;
  timestamp: number;
}

interface UseFateHistoryReturn {
  history: FateResult[];
  addResult: (result: Omit<FateResult, 'id' | 'timestamp'>) => Promise<void>;
  clearHistory: () => Promise<void>;
  recentWinners: string[];  // last 5 winner names
}
```

Implementation:
- AsyncStorage key: `fate_decides_history`
- Max 5 entries (older ones truncated on add)
- Load on mount, return stable array reference
- Use `useState` + update in place on add

## randomWinner utility

```ts
export function pickWinner(names: string[]): string;
export function pickTwoWinners(names: string[]): [string, string];
```

Implementation:
```ts
function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
  }
  return Math.random();
}

export function pickWinner(names: string[]): string {
  if (names.length === 0) throw new Error('Cannot pick from empty list');
  const index = Math.floor(secureRandom() * names.length);
  return names[index];
}

export function pickTwoWinners(names: string[]): [string, string] {
  if (names.length < 2) throw new Error('Need at least 2 names for duo');
  const first = pickWinner(names);
  const remaining = names.filter(n => n !== first);
  const second = pickWinner(remaining);
  return [first, second];
}
```

## ModeTabs component

Props:
```ts
interface ModeTabsProps {
  activeMode: 'wheel' | 'touch';
  onModeChange: (mode: 'wheel' | 'touch') => void;
}
```

Styling: see spec-theme.md "Tab bar" section. Two pills, active one has cream background with shadow, inactive is transparent. Haptic tap on switch.

## Layout root wrap
The Fate route must be wrapped in `<GestureHandlerRootView style={{ flex: 1 }}>` — required for Touch of Fate's multi-touch handling. Add to the fate-decides layout or higher if not already there.

## Screen orientation
Lock to portrait when entering the Fate route:
```ts
import * as ScreenOrientation from 'expo-screen-orientation';

useEffect(() => {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
  return () => { ScreenOrientation.unlockAsync(); };
}, []);
```
