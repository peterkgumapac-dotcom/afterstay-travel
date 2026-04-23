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
 * Phase 3: no fake-outs (main + final only).
 * Phase 4 will add fake-out logic.
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

  const baseFullRotations = 4 + Math.random() * 2; // 4-6 full spins
  const steps: SpinStep[] = [];
  let currentRotation = 0;

  // Main fast spin — ends just before the target
  const mainEndRotation = 360 * baseFullRotations + targetSettleRotation - 30;
  steps.push({
    toRotation: mainEndRotation,
    duration: 2500,
    easing: 'easeOut',
    type: 'main',
    onStart: { sound: 'rattle' },
  });
  currentRotation = mainEndRotation;

  // Fake-outs — dramatic near-stops then re-acceleration
  for (let i = 0; i < fakeouts; i++) {
    // Crawl to a near-stop: only move ~0.5-1 slice over a long duration
    const crawlOffset = sliceAngle * (0.4 + Math.random() * 0.6);
    steps.push({
      toRotation: currentRotation + crawlOffset,
      duration: Math.max(800, 1500 - i * 200),
      easing: 'easeOut',
      type: 'fake-slow',
      onStart: { sound: 'scratch', haptic: 'medium' },
    });
    currentRotation += crawlOffset;

    // Re-accelerate past — fast push covering 2-4 full rotations + extra
    const pushRotations = 2 + Math.random() * 2;
    const pushOffset = 360 * pushRotations + sliceAngle * (1 + Math.random() * 2);
    steps.push({
      toRotation: currentRotation + pushOffset,
      duration: 1800,
      easing: 'easeOut',
      type: 'fake-push',
    });
    currentRotation += pushOffset;
  }

  // Final landing — recalculate to land exactly on winner
  const targetModulo = currentRotation % 360;
  const neededAddition = ((360 - targetModulo + targetSettleRotation) % 360) + 360;
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
