import { useCallback, useRef, useState } from 'react';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import type { UseHapticsReturn } from '@/hooks/fate/useHaptics';
import type { UseSoundsReturn } from '@/hooks/fate/useSounds';

// Minimum velocity (deg/s) to trigger a spin
const MIN_VELOCITY = 100;
// Minimum spin velocity — even a light swipe gets a big spin
const MIN_SPIN_VELOCITY = 3500;
// Deceleration rate — 0.9998 gives ~10-15s spins
const DECELERATION = 0.9998;

export interface UseWheelSpinReturn {
  rotation: ReturnType<typeof useSharedValue<number>>;
  isSpinning: boolean;
  fling: (velocity: number, onFinish: () => void) => void;
  getWinnerIndex: (nameCount: number) => number;
}

export function useWheelSpin(
  sounds: UseSoundsReturn,
  haptics: UseHapticsReturn,
): UseWheelSpinReturn {
  const rotation = useSharedValue(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const onFinishRef = useRef<(() => void) | null>(null);

  const handleFinished = useCallback(() => {
    setIsSpinning(false);
    sounds.stop('rattle');
    sounds.play('reveal');
    haptics.heavy();
    haptics.success();
    onFinishRef.current?.();
    onFinishRef.current = null;
  }, [sounds, haptics]);

  const fling = useCallback(
    (velocity: number, onFinish: () => void) => {
      if (Math.abs(velocity) < MIN_VELOCITY) return;

      // Enforce minimum spin speed — even a light swipe gives a satisfying spin
      const sign = velocity > 0 ? 1 : -1;
      const boostedVelocity = sign * Math.max(Math.abs(velocity), MIN_SPIN_VELOCITY);

      onFinishRef.current = onFinish;
      setIsSpinning(true);
      sounds.play('rattle');
      haptics.medium();

      cancelAnimation(rotation);

      rotation.value = withDecay(
        {
          velocity: boostedVelocity,
          deceleration: DECELERATION,
        },
        (finished) => {
          if (finished) {
            runOnJS(handleFinished)();
          }
        },
      );
    },
    [rotation, sounds, haptics, handleFinished],
  );

  const getWinnerIndex = useCallback(
    (nameCount: number): number => {
      const sliceAngle = 360 / nameCount;
      const normalized = ((rotation.value % 360) + 360) % 360;
      const pointerAngle = (360 - normalized + 360) % 360;
      const index = Math.floor(pointerAngle / sliceAngle);
      return index % nameCount;
    },
    [rotation],
  );

  return { rotation, isSpinning, fling, getWinnerIndex };
}
