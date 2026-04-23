import { useCallback, useRef, useState } from 'react';
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { UseHapticsReturn } from '@/hooks/fate/useHaptics';
import type { UseSoundsReturn } from '@/hooks/fate/useSounds';
import { generateSpinPlan, type SpinPlan, type SpinStep } from '@/utils/fate/generateSpinPlan';

const EASINGS = {
  easeOut: Easing.out(Easing.cubic),
  easeIn: Easing.in(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
};

export interface UseWheelSpinReturn {
  rotation: ReturnType<typeof useSharedValue<number>>;
  isSpinning: boolean;
  currentStepType: SpinStep['type'] | null;
  spin: (nameCount: number, winnerIndex: number, forceFakeouts?: number) => Promise<void>;
  skip: () => void;
}

export function useWheelSpin(
  sounds: UseSoundsReturn,
  haptics: UseHapticsReturn,
): UseWheelSpinReturn {
  const rotation = useSharedValue(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentStepType, setCurrentStepType] = useState<SpinStep['type'] | null>(null);
  const planRef = useRef<SpinPlan | null>(null);
  const skippedRef = useRef(false);
  const resolveRef = useRef<(() => void) | null>(null);

  const fireStepEffects = useCallback(
    (step: SpinStep) => {
      if (step.onStart?.sound) {
        sounds.play(step.onStart.sound);
      }
      if (step.onStart?.haptic) {
        haptics[step.onStart.haptic]();
      }
    },
    [sounds, haptics],
  );

  const spin = useCallback(
    (nameCount: number, winnerIndex: number, forceFakeouts?: number): Promise<void> => {
      return new Promise<void>((resolve) => {
        const plan = generateSpinPlan(nameCount, winnerIndex, {
          forceFakeouts,
        });
        planRef.current = plan;
        skippedRef.current = false;
        resolveRef.current = resolve;
        setIsSpinning(true);

        let stepIndex = 0;

        const runStep = () => {
          if (skippedRef.current || stepIndex >= plan.steps.length) {
            // Finished
            sounds.stop('rattle');
            setIsSpinning(false);
            setCurrentStepType(null);
            resolveRef.current?.();
            resolveRef.current = null;
            return;
          }

          const step = plan.steps[stepIndex];
          setCurrentStepType(step.type);
          fireStepEffects(step);

          rotation.value = withTiming(
            step.toRotation,
            {
              duration: step.duration,
              easing: EASINGS[step.easing],
            },
            (finished) => {
              if (finished) {
                stepIndex++;
                runOnJS(runStep)();
              }
            },
          );
        };

        runStep();
      });
    },
    [rotation, sounds, haptics, fireStepEffects],
  );

  const skip = useCallback(() => {
    if (!planRef.current || !isSpinning) return;
    skippedRef.current = true;
    sounds.stop('rattle');
    rotation.value = planRef.current.finalRotation;
    setIsSpinning(false);
    setCurrentStepType(null);

    // Fire final effects
    haptics.heavy();
    haptics.success();
    sounds.play('reveal');

    resolveRef.current?.();
    resolveRef.current = null;
  }, [isSpinning, rotation, sounds, haptics]);

  return { rotation, isSpinning, currentStepType, spin, skip };
}
