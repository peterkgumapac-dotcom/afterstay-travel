import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { fateColors } from '@/constants/fateTheme';
import { useFateHistory } from '@/hooks/fate/useFateHistory';
import { useHaptics } from '@/hooks/fate/useHaptics';
import { useSounds } from '@/hooks/fate/useSounds';

import Wheel from './Wheel';
import WheelPointer from './WheelPointer';
import WinnerReveal from './WinnerReveal';
import { useWheelSpin } from './useWheelSpin';

type GameState = 'idle' | 'spinning' | 'result';

interface WheelScreenProps {
  names: string[];
  duo?: boolean;
}

const WHEEL_SIZE = 260;

export default function WheelScreen({ names, duo = false }: WheelScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [winnerName, setWinnerName] = useState('');
  const [winnerIdx, setWinnerIdx] = useState(0);
  const [duoWinnerName, setDuoWinnerName] = useState<string | undefined>();
  const [duoWinnerIdx, setDuoWinnerIdx] = useState<number | undefined>();
  const spinCountRef = useRef(0);
  const firstWinnerRef = useRef('');
  const firstWinnerIdxRef = useRef(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const history = useFateHistory();
  const wheelSpin = useWheelSpin(sounds, haptics);

  const handleSpinFinished = useCallback(() => {
    const idx = wheelSpin.getWinnerIndex(names.length);
    const winner = names[idx] ?? names[0];

    if (duo && names.length >= 3 && spinCountRef.current === 0) {
      // First spin of duo done — store and prompt second swipe
      spinCountRef.current = 1;
      firstWinnerRef.current = winner;
      firstWinnerIdxRef.current = idx;
      setWinnerName(winner);
      setWinnerIdx(idx);
      setGameState('idle');
      return;
    }

    if (duo && spinCountRef.current === 1) {
      // Second spin of duo done
      setDuoWinnerName(winner);
      setDuoWinnerIdx(idx);
      setWinnerName(firstWinnerRef.current);
      setWinnerIdx(firstWinnerIdxRef.current);
      setGameState('result');
      history.addResult({
        mode: 'wheel',
        winner: firstWinnerRef.current,
        duoWinner: winner,
      });
      spinCountRef.current = 0;
      return;
    }

    // Solo
    setWinnerName(winner);
    setWinnerIdx(idx);
    setGameState('result');
    history.addResult({ mode: 'wheel', winner });
  }, [names, duo, wheelSpin, history]);

  const doFling = useCallback(
    (velocityX: number, velocityY: number) => {
      if (gameState === 'result') return;
      if (names.length < 2) return;

      // Convert pan velocity to angular velocity
      const velocity = Math.abs(velocityX) > Math.abs(velocityY) ? velocityX : -velocityY;
      const angularVelocity = velocity * 0.5;

      if (Math.abs(angularVelocity) < 100) return;

      setGameState('spinning');
      wheelSpin.fling(angularVelocity, handleSpinFinished);
    },
    [gameState, names, wheelSpin, handleSpinFinished],
  );

  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      'worklet';
      runOnJS(doFling)(event.velocityX, event.velocityY);
    })
    .minDistance(10);

  const handleSpinAgain = useCallback(() => {
    setGameState('idle');
    setDuoWinnerName(undefined);
    setDuoWinnerIdx(undefined);
    spinCountRef.current = 0;
  }, []);

  const isDuoSecondSpin = duo && spinCountRef.current === 1;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.wheelContainer}>
          <View style={styles.wheelWrapper}>
            <WheelPointer wheelSize={WHEEL_SIZE} />
            <Wheel
              names={names}
              rotation={wheelSpin.rotation}
              size={WHEEL_SIZE}
            />
          </View>

          <Text style={styles.hint}>
            {gameState === 'spinning'
              ? 'Spinning...'
              : isDuoSecondSpin
                ? `${winnerName} chosen! Swipe again for #2`
                : 'Swipe the wheel to spin'}
          </Text>
        </View>
      </GestureDetector>

      {gameState === 'result' && (
        <WinnerReveal
          winner={winnerName}
          winnerIndex={winnerIdx}
          duoWinner={duoWinnerName}
          duoWinnerIndex={duoWinnerIdx}
          onSpinAgain={handleSpinAgain}
          onDone={handleSpinAgain}
          history={history.history}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wheelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelWrapper: {
    position: 'relative',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  },
  hint: {
    marginTop: 24,
    fontSize: 14,
    fontStyle: 'italic',
    color: fateColors.textSecondary,
    textAlign: 'center',
  },
});
