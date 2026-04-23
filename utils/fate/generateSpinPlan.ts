import type { SoundName } from '@/hooks/fate/useSounds';

export interface SpinStep {
  toRotation: number;
  duration: number;
  easing: 'easeOut' | 'easeIn' | 'easeInOut';
  type: 'main' | 'fake-slow' | 'fake-push' | 'final';
  onStart?: {
    sound?: SoundName;
    haptic?: 'light' | 'medium' | 'heavy';
  };
}

export interface SpinPlan {
  steps: SpinStep[];
  finalRotation: number;
  winnerIndex: number;
  fakeoutCount: number;
}

/**
 * Generate a multi-step spin plan that always lands on the given winner.
 *
 * Structure:
 *   1. Fast spin (~5s, many rotations)
 *   2. 1-3 fake-outs (crawl to near-stop, then re-accelerate)
 *   3. Final slow-down (~3s, gentle ease to winner)
 */
export function generateSpinPlan(
  nameCount: number,
  winnerIndex: number,
  options: { forceFakeouts?: number } = {},
): SpinPlan {
  const fakeouts = options.forceFakeouts ?? (1 + Math.floor(Math.random() * 3)); // 1-3
  const sliceAngle = 360 / nameCount;

  // Winner's center angle on the wheel (slice 0 starts at 12 o'clock)
  const winnerAngle = winnerIndex * sliceAngle + sliceAngle / 2;
  // The pointer is at 0 (top). Wheel rotates CW.
  // Final position modulo 360 should place winnerAngle under the pointer.
  const targetSettleRotation = (360 - winnerAngle + 360) % 360;

  const steps: SpinStep[] = [];
  let currentRotation = 0;

  // ── Step 1: Fast spin — 5 seconds, 8-12 full rotations ──
  const fastRotations = 8 + Math.random() * 4;
  const mainEndRotation = 360 * fastRotations;
  steps.push({
    toRotation: mainEndRotation,
    duration: 5000,
    easing: 'easeInOut',
    type: 'main',
    onStart: { sound: 'rattle' },
  });
  currentRotation = mainEndRotation;

  // ── Step 2: Fake-outs — crawl then re-spin ──
  for (let i = 0; i < fakeouts; i++) {
    // Crawl: nearly stop over ~1 slice in 1.5-2s
    const crawlOffset = sliceAngle * (0.3 + Math.random() * 0.7);
    steps.push({
      toRotation: currentRotation + crawlOffset,
      duration: 1500 + Math.random() * 500,
      easing: 'easeOut',
      type: 'fake-slow',
      onStart: { sound: 'scratch', haptic: 'medium' },
    });
    currentRotation += crawlOffset;

    // Re-accelerate: 3-5 full rotations in 2.5s
    const pushRotations = 3 + Math.random() * 2;
    const pushOffset = 360 * pushRotations;
    steps.push({
      toRotation: currentRotation + pushOffset,
      duration: 2500,
      easing: 'easeInOut',
      type: 'fake-push',
    });
    currentRotation += pushOffset;
  }

  // ── Step 3: Final landing — 3 seconds, slow ease to winner ──
  const targetModulo = currentRotation % 360;
  // Add one more full rotation + the offset needed to land on winner
  const neededAddition = ((360 - targetModulo + targetSettleRotation) % 360) + 360;
  steps.push({
    toRotation: currentRotation + neededAddition,
    duration: 3000,
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
