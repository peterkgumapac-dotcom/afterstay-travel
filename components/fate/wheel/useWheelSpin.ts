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
const MIN_VELOCITY = 200;
// Deceleration rate — lower = spins longer. 0.997 gives nice 5-8s spins
const DECELERATION = 0.997;

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

      onFinishRef.current = onFinish;
      setIsSpinning(true);
      sounds.play('rattle');
      haptics.medium();

      cancelAnimation(rotation);

      rotation.value = withDecay(
        {
          velocity,
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
