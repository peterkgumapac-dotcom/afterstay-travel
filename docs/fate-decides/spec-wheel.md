# Fate Decides — Wheel mode

## File structure
```
/components/fate/wheel/
  WheelScreen.tsx             — Container for idle/spinning/result states
  Wheel.tsx                   — The SVG wheel itself
  WheelPointer.tsx            — Triangle pointer at top
  WinnerReveal.tsx            — Result card with winner
  useWheelSpin.ts             — Animation hook
  
/utils/fate/
  generateSpinPlan.ts         — The fake-out choreography
```

## WheelScreen states
State machine:
```
idle → spinning → (fakeout*) → landing → result → idle
```

Transitions:
- idle → spinning: user taps "Spin the wheel"
- spinning → result: animation completes
- result → idle: user taps "Spin again" OR adds/removes a name

Skip gesture: during any spinning/fakeout/landing state, a tap anywhere skips to the final state instantly.

## Wheel component

Props:
```ts
interface WheelProps {
  names: string[];
  rotation: SharedValue<number>;  // from Reanimated
  size?: number;  // default 260
}
```

Rendering:
- SVG root, size × size
- Each name gets an equal slice (360 / names.length degrees)
- Slice colors cycle from personColors[] (see spec-theme)
- Slice dividers: 2px white lines between slices
- Center hub: cream circle with burnt orange dot
- Rotation is applied via `Animated.createAnimatedComponent(Svg)` wrapping the slices group — only the slices rotate, not the pointer

Text on slices:
- Position text at 60% radius from center, rotated to slice angle
- Show initial letter large (22px Georgia), then full name below (10px caps)
- Text color: cream #F5EEDC

## WheelPointer

- Triangle pointing down from top of wheel
- Fill: `fateColors.textPrimary` (#3C2814)
- Static, does NOT rotate
- Points at where the "current result" would be if wheel stopped right now

## generateSpinPlan utility

This is the core fake-out logic. It's a PURE FUNCTION — no side effects, easy to unit test.

```ts
interface SpinStep {
  toRotation: number;       // absolute rotation in degrees (cumulative)
  duration: number;         // ms
  easing: 'easeOut' | 'easeIn' | 'easeInOut';
  type: 'main' | 'fake-slow' | 'fake-push' | 'final';
  onStart?: {
    sound?: SoundName;
    haptic?: 'light' | 'medium' | 'heavy';
  };
}

interface SpinPlan {
  steps: SpinStep[];
  finalRotation: number;
  winnerIndex: number;
  fakeoutCount: number;      // for debugging/analytics
}

export function generateSpinPlan(
  nameCount: number,
  winnerIndex: number,
  options?: { forceFakeouts?: number }  // for testing
): SpinPlan;
```

Logic:
```ts
export function generateSpinPlan(nameCount, winnerIndex, options = {}) {
  const fakeouts = options.forceFakeouts ?? Math.floor(Math.random() * 4);  // 0-3
  const sliceAngle = 360 / nameCount;
  
  // The pointer is at 0 degrees (top). The wheel rotates clockwise.
  // Winner's center should end at 0 degrees relative to pointer.
  // Winner's natural center is at (winnerIndex * sliceAngle + sliceAngle/2) degrees.
  // So we need the wheel to rotate so that this position ends at 0.
  // Final rotation = 360 - (winnerIndex * sliceAngle + sliceAngle/2) + some full rotations
  
  const baseFullRotations = 4 + Math.random() * 2;  // 4-6 full spins for main
  const winnerAngle = winnerIndex * sliceAngle + sliceAngle / 2;
  const targetSettleRotation = 360 - winnerAngle;  // final position modulo 360
  
  const steps: SpinStep[] = [];
  let currentRotation = 0;
  
  // Main fast spin
  const mainEndRotation = 360 * baseFullRotations + targetSettleRotation - 30;
  steps.push({
    toRotation: mainEndRotation,
    duration: 2500,
    easing: 'easeOut',
    type: 'main',
    onStart: { sound: 'rattle' },
  });
  currentRotation = mainEndRotation;
  
  // Fake-outs
  for (let i = 0; i < fakeouts; i++) {
    // Slow down as if stopping at a wrong slice
    const fakeOffset = sliceAngle * (1 + Math.random() * 2);  // slow past 1-3 slices
    steps.push({
      toRotation: currentRotation + fakeOffset,
      duration: Math.max(600, 1200 - i * 200),
      easing: 'easeOut',
      type: 'fake-slow',
      onStart: { sound: 'scratch', haptic: 'medium' },
    });
    currentRotation += fakeOffset;
    
    // Tiny hold at the fake position (handled by ending one step and starting next)
    // Then push forward again
    const pushOffset = sliceAngle * (0.5 + Math.random() * 1);
    steps.push({
      toRotation: currentRotation + pushOffset,
      duration: 700,
      easing: 'easeIn',
      type: 'fake-push',
    });
    currentRotation += pushOffset;
  }
  
  // Final landing — recalculate to ensure we land exactly on winner
  const targetModulo = currentRotation % 360;
  const neededAddition = (360 - targetModulo + targetSettleRotation) % 360 + 360;
  steps.push({
    toRotation: currentRotation + neededAddition,
    duration: 1800,
    easing: 'easeOut',
    type: 'final',
    onStart: { sound: 'reveal', haptic: 'heavy' },
  });
  currentRotation += neededAddition;
  
  return {
    steps,
    finalRotation: currentRotation,
    winnerIndex,
    fakeoutCount: fakeouts,
  };
}
```

### Unit tests for generateSpinPlan
Create `/utils/fate/__tests__/generateSpinPlan.test.ts`:
- With 0 fakeouts, plan has exactly 2 steps (main + final)
- With 3 fakeouts, plan has 8 steps (main + 3*(slow+push) + final)
- Final rotation modulo 360 always lands on winner's slice center (±sliceAngle/2)
- Winner index 0 through nameCount-1 all produce valid plans
- Run 1000 times with random inputs, verify winner always matches

## useWheelSpin hook

```ts
interface UseWheelSpinReturn {
  rotation: SharedValue<number>;
  isSpinning: boolean;
  currentStepType: SpinStep['type'] | null;
  spin: (nameCount: number, winnerIndex: number) => Promise<void>;
  skip: () => void;
}

export function useWheelSpin(sounds: UseSoundsReturn, haptics: UseHapticsReturn): UseWheelSpinReturn;
```

Implementation notes:
- Use Reanimated's `useSharedValue` for rotation
- Use `withSequence` + `withTiming` to chain steps
- `withTiming` requires a different easing object per type:
  ```ts
  import { Easing } from 'react-native-reanimated';
  const easings = {
    easeOut: Easing.out(Easing.cubic),
    easeIn: Easing.in(Easing.cubic),
    easeInOut: Easing.inOut(Easing.cubic),
  };
  ```
- Fire sound and haptic effects at start of each step using `runOnJS` since Reanimated runs on UI thread
- Track step index in a ref so skip() can immediately set rotation to `plan.finalRotation`
- When animation completes, call final sound/haptic and set isSpinning false
- Return a Promise from spin() that resolves when fully complete

## WinnerReveal component

Props:
```ts
interface WinnerRevealProps {
  winner: string;
  winnerIndex: number;      // for color lookup
  duoWinner?: string;
  duoWinnerIndex?: number;
  onSpinAgain: () => void;
  onDone: () => void;
}
```

Layout: See mockup. White card on cream background, "CHOSEN" badge floating above, big initial circle in person's color, name in Georgia serif at 36px, italic subline "is picking up the tab tonight" (for duo: "are picking up the tab tonight").

Animation on mount:
- Scale from 0.8 to 1.0 with spring (damping 12)
- Initial circle rotates slightly on entry (reanimated)
- Confetti dots fade in around the card after 200ms delay
- `haptics.success()` fires on mount

## Integration: full spin flow

```ts
// In WheelScreen.tsx (pseudocode)
async function handleSpin() {
  const winnerIdx = names.indexOf(pickWinner(names));
  const plan = generateSpinPlan(names.length, winnerIdx);
  
  setGameState('spinning');
  await wheelSpin.spin(names.length, winnerIdx);
  setGameState('result');
  
  await history.addResult({ mode: 'wheel', winner: names[winnerIdx] });
  
  // For duo: second spin after 1 second
  if (duoMode) {
    setTimeout(async () => {
      const remaining = names.filter((_, i) => i !== winnerIdx);
      const duoWinnerIdx = names.indexOf(pickWinner(remaining));
      const duoPlan = generateSpinPlan(names.length, duoWinnerIdx);
      setGameState('spinning');
      await wheelSpin.spin(names.length, duoWinnerIdx);
      setGameState('result');
    }, 1000);
  }
}
```

## Known Reanimated gotchas
1. `withSequence` cannot be interrupted mid-step. To skip, set the shared value directly: `rotation.value = plan.finalRotation;`
2. Callbacks inside `withTiming` must use `runOnJS(callback)()` to touch React state
3. On very old Android devices, sequences longer than ~6 steps can stutter. Break long plans into promise chains with await instead of one big withSequence if you see this.
4. Do NOT use `style={{ transform: [{ rotate: '${rotation.value}deg' }] }}` — that breaks. Use `useAnimatedStyle` hook.

## Testing the fake-outs manually
Add a debug toggle (hidden, dev-only) to force fakeout count:
```ts
<DebugPanel onForceFakeouts={setForceFakeouts} />
```
Allows you to test 0, 1, 2, 3 fakeout counts deterministically without waiting for random hits.
