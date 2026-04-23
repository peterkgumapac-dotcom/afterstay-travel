# Fate Decides — Touch of Fate mode

## File structure
```
/components/fate/touch/
  TouchScreen.tsx              — Container with state machine
  FingerTracker.tsx            — GestureHandler multi-touch root
  FingerCircle.tsx             — Individual finger indicator
  Spotlight.tsx                — Animated spotlight element
  CountdownHeartbeat.tsx       — Heartbeat bars visualization
  useHeartbeat.ts              — Haptic + visual pulse hook
  useSpotlightSweep.ts         — Spotlight animation hook

/utils/fate/
  generateSpotlightPath.ts    — The sweep choreography
```

## State machine
```
empty → collecting → ready → countdown → sweep → result → [empty OR finalize]
```

Transitions:
- empty → collecting: first finger touches down
- collecting → ready: 2+ fingers down for 500ms
- ready → countdown: user taps "Start"
- countdown → sweep: countdown duration elapses
- sweep → result: spotlight animation completes
- ANY STATE → empty: someone lifts a finger during countdown or sweep (ABORT)
- result → empty: user taps "Play again"

## FingerTracker component

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

interface Finger {
  id: number;           // touch ID from gesture handler
  x: number;
  y: number;
  colorIndex: number;   // stable color assignment
  name?: string;        // optional name if user entered one
}

interface FingerTrackerProps {
  gameState: GameState;
  onFingersChange: (fingers: Finger[]) => void;
  onAbort: () => void;  // called if finger lifts during countdown or sweep
}
```

Implementation:
```tsx
function FingerTracker({ gameState, onFingersChange, onAbort }: FingerTrackerProps) {
  const [fingers, setFingers] = useState<Map<number, Finger>>(new Map());
  
  const gesture = Gesture.Manual()
    .onTouchesDown((event) => {
      'worklet';
      const touches = event.changedTouches;
      for (const touch of touches) {
        runOnJS(addFinger)(touch.id, touch.x, touch.y);
      }
    })
    .onTouchesMove((event) => {
      'worklet';
      const touches = event.changedTouches;
      for (const touch of touches) {
        runOnJS(updateFinger)(touch.id, touch.x, touch.y);
      }
    })
    .onTouchesUp((event) => {
      'worklet';
      const touches = event.changedTouches;
      for (const touch of touches) {
        runOnJS(removeFinger)(touch.id);
      }
    })
    .onTouchesCancelled((event) => {
      'worklet';
      // Treat same as up — Android sometimes fires this spuriously
      const touches = event.changedTouches;
      for (const touch of touches) {
        runOnJS(removeFinger)(touch.id);
      }
    });
  
  function addFinger(id: number, x: number, y: number) {
    setFingers(prev => {
      if (prev.has(id) || prev.size >= 10) return prev;
      const next = new Map(prev);
      next.set(id, {
        id, x, y,
        colorIndex: prev.size,  // assign in order of arrival
      });
      return next;
    });
  }
  
  function updateFinger(id: number, x: number, y: number) {
    setFingers(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      const existing = next.get(id)!;
      next.set(id, { ...existing, x, y });
      return next;
    });
  }
  
  function removeFinger(id: number) {
    // If we're in countdown or sweep, abort
    if (gameState === 'countdown' || gameState === 'sweep') {
      onAbort();
    }
    setFingers(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }
  
  useEffect(() => {
    onFingersChange(Array.from(fingers.values()));
  }, [fingers]);
  
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }}>
        {/* render children: FingerCircle for each finger, Spotlight, etc. */}
      </View>
    </GestureDetector>
  );
}
```

Notes:
- Must be wrapped in GestureHandlerRootView at app or screen level
- On Android 13+, ensure `android.enableEdgeToEdge: false` in app.json or edge gestures interfere
- Max 10 touches (iOS/Android hardware limit)
- Colors assigned in order of finger arrival (first finger = color 0)

## FingerCircle component

```tsx
interface FingerCircleProps {
  finger: Finger;
  isSpotlighted: boolean;
  gameState: GameState;
  heartbeatIntensity: number;  // 0-1, drives scale pulse
}
```

Visual states:
- Default (collecting/ready): white circle, 2px colored border, colored inner circle with initial
- Countdown: pulses scale 1.0 → 1.08 → 1.0 on each heartbeat
- Sweep non-spotlighted: dimmed to 55% opacity
- Sweep spotlighted: full opacity, 3px border, glowing shadow in accent color
- Result loser: large scale, bright glow, stays lit
- Result non-loser: faded 30% opacity

Position: absolute at `finger.x - 36, finger.y - 36` (centered on touch point, 72px circle)

Animation: use Reanimated's `useSharedValue` for scale and opacity, update via `useAnimatedStyle`.

## Spotlight component

```tsx
interface SpotlightProps {
  targetPosition: SharedValue<{ x: number; y: number }>;
  isActive: boolean;
}
```

Visual: a radial gradient "spotlight" that moves around the screen, landing on finger positions. Implementation:
- Absolute positioned circle, 160px diameter
- Background: `radial-gradient` (use react-native-linear-gradient or SVG for this)
- Soft glow shadow in `fateColors.accent` (#C59820)
- Only rendered when `isActive` is true
- Position animated via shared values

## useSpotlightSweep hook

```ts
interface UseSpotlightSweepReturn {
  position: SharedValue<{ x: number; y: number }>;
  isActive: boolean;
  currentTargetId: number | null;
  sweep: (fingers: Finger[], victimId: number) => Promise<void>;
  abort: () => void;
}

export function useSpotlightSweep(
  sounds: UseSoundsReturn,
  haptics: UseHapticsReturn
): UseSpotlightSweepReturn;
```

Sweep algorithm (via generateSpotlightPath):
```ts
interface SpotlightStop {
  fingerId: number;
  duration: number;  // ms to reach this stop from previous
  isFinal: boolean;
}

export function generateSpotlightPath(
  fingers: Finger[],
  victimId: number
): SpotlightStop[] {
  const fingerIds = fingers.map(f => f.id);
  const victimFinger = fingers.find(f => f.id === victimId);
  if (!victimFinger) throw new Error('Victim not in fingers');
  
  const path: SpotlightStop[] = [];
  const totalVisits = 12 + Math.floor(Math.random() * 8);  // 12-19 hops
  
  // Fast early hops
  for (let i = 0; i < totalVisits; i++) {
    const randomFinger = fingerIds[Math.floor(Math.random() * fingerIds.length)];
    const progress = i / totalVisits;
    // Start fast (80ms), decelerate to slow (260ms)
    const duration = 80 + Math.floor(progress * 180);
    path.push({ fingerId: randomFinger, duration, isFinal: false });
  }
  
  // One fake-out slow stop on a non-victim (if we have >2 fingers)
  if (fingerIds.length > 2) {
    const nonVictims = fingerIds.filter(id => id !== victimId);
    const fakeStop = nonVictims[Math.floor(Math.random() * nonVictims.length)];
    path.push({ fingerId: fakeStop, duration: 500, isFinal: false });
    // Tiny pause then one more hop before landing
    path.push({ fingerId: fingerIds[Math.floor(Math.random() * fingerIds.length)], duration: 280, isFinal: false });
  }
  
  // Final land on victim
  path.push({ fingerId: victimId, duration: 900, isFinal: true });
  
  return path;
}
```

Execution in hook:
```ts
async function sweep(fingers, victimId) {
  const path = generateSpotlightPath(fingers, victimId);
  sounds.play('drumroll');
  
  for (const stop of path) {
    const finger = fingers.find(f => f.id === stop.fingerId);
    if (!finger) continue;
    
    // Animate position to this finger
    position.value = withTiming(
      { x: finger.x, y: finger.y },
      { duration: stop.duration, easing: Easing.inOut(Easing.quad) }
    );
    
    if (!stop.isFinal) {
      haptics.tap();
    }
    
    await sleep(stop.duration);
  }
  
  // Final boom
  sounds.stop('drumroll');
  sounds.play('boom');
  haptics.error();
  haptics.heavy();
}
```

## useHeartbeat hook

```ts
interface UseHeartbeatReturn {
  intensity: SharedValue<number>;  // 0-1, for visual pulse
  start: (totalDurationMs: number) => void;
  stop: () => void;
}

export function useHeartbeat(haptics: UseHapticsReturn): UseHeartbeatReturn;
```

Rhythm:
- Total duration is random 5000-12000ms (decided by caller)
- Start interval: 1200ms
- End interval: 150ms (minimum, for final crescendo)
- Interpolate interval linearly over duration
- Each tick: trigger haptic AND update intensity shared value for visual pulse
- First third: light haptic
- Second third: medium haptic
- Final third: heavy haptic

Implementation sketch:
```ts
function start(totalDuration: number) {
  const startTime = Date.now();
  let nextBeatTime = startTime;
  
  function scheduleNext() {
    const elapsed = Date.now() - startTime;
    if (elapsed >= totalDuration) {
      stop();
      return;
    }
    
    const progress = elapsed / totalDuration;
    const interval = 1200 - progress * (1200 - 150);
    
    nextBeatTime += interval;
    const delay = Math.max(0, nextBeatTime - Date.now());
    
    timeoutRef.current = setTimeout(() => {
      // Fire haptic based on progress
      if (progress < 0.33) haptics.light();
      else if (progress < 0.66) haptics.medium();
      else haptics.heavy();
      
      // Pulse visual intensity
      intensity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: interval - 80 }),
      );
      
      scheduleNext();
    }, delay);
  }
  
  scheduleNext();
}
```

## CountdownHeartbeat component (visual)

The bars shown at bottom of screen during countdown. Props:
```ts
interface CountdownHeartbeatProps {
  intensity: SharedValue<number>;  // from useHeartbeat
}
```

Renders 7 vertical bars that pulse in height based on intensity. See mockup. Taller bars at positions 0, 2, 4, 6 (odd indices are shorter). Color: `fateColors.primary` with partial opacity on odd bars.

## TouchScreen full integration

```tsx
function TouchScreen() {
  const [gameState, setGameState] = useState<GameState>('empty');
  const [fingers, setFingers] = useState<Finger[]>([]);
  const [victimId, setVictimId] = useState<number | null>(null);
  
  const haptics = useHaptics();
  const sounds = useSounds();
  const heartbeat = useHeartbeat(haptics);
  const spotlight = useSpotlightSweep(sounds, haptics);
  
  const handleFingersChange = (newFingers: Finger[]) => {
    setFingers(newFingers);
    if (gameState === 'empty' && newFingers.length >= 1) {
      setGameState('collecting');
    }
    if (gameState === 'collecting' && newFingers.length >= 2) {
      // Debounce before moving to ready
      setTimeout(() => setGameState('ready'), 500);
    }
  };
  
  const handleAbort = () => {
    heartbeat.stop();
    spotlight.abort();
    sounds.stop('drumroll');
    haptics.warning();
    setGameState('empty');
    setFingers([]);
  };
  
  const handleStart = async () => {
    setGameState('countdown');
    const countdownDuration = 5000 + Math.random() * 7000;  // 5-12 sec
    heartbeat.start(countdownDuration);
    await sleep(countdownDuration);
    heartbeat.stop();
    
    setGameState('sweep');
    const victim = fingers[Math.floor(secureRandom() * fingers.length)];
    setVictimId(victim.id);
    await spotlight.sweep(fingers, victim.id);
    
    setGameState('result');
  };
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FingerTracker
        gameState={gameState}
        onFingersChange={handleFingersChange}
        onAbort={handleAbort}
      />
      {fingers.map(f => (
        <FingerCircle
          key={f.id}
          finger={f}
          isSpotlighted={f.id === spotlight.currentTargetId}
          gameState={gameState}
          heartbeatIntensity={heartbeat.intensity}
        />
      ))}
      <Spotlight targetPosition={spotlight.position} isActive={gameState === 'sweep'} />
      {gameState === 'ready' && <StartButton onPress={handleStart} />}
      {gameState === 'countdown' && <CountdownHeartbeat intensity={heartbeat.intensity} />}
      {gameState === 'result' && <TouchResultOverlay victim={fingers.find(f => f.id === victimId)!} onPlayAgain={() => { setGameState('empty'); setFingers([]); }} />}
    </GestureHandlerRootView>
  );
}
```

## Duo mode variant

In duo mode, after the first victim is found, instead of going to result:
1. Announce "...and one more" overlay for 1.5 seconds
2. Remove victim from consideration
3. Run spotlight sweep again on remaining fingers
4. Land on second victim
5. Show duo result screen with both names

## Gotchas
1. Gesture.Manual requires react-native-gesture-handler v2.9+. Check package.json before building.
2. On web (if Expo runs web), Gesture.Manual may not work — add a feature flag or web fallback.
3. useEffect cleanup on TouchScreen must cancel heartbeat, sweep, and sounds to avoid orphaned timers.
4. Keep fingers in a Map not array for O(1) id lookup — arrays scale badly past ~6 fingers per render.
5. Don't put the FingerCircle inside GestureDetector as a sibling to the view that captures gestures — nest them correctly or touches won't register.
