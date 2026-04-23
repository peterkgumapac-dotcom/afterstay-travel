import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/fate/shared/PrimaryButton';
import { fateColors } from '@/constants/fateTheme';
import { useFateHistory } from '@/hooks/fate/useFateHistory';
import { useHaptics } from '@/hooks/fate/useHaptics';
import { useSounds } from '@/hooks/fate/useSounds';
import { pickWinner } from '@/utils/fate/randomWinner';

import Wheel from './Wheel';
import WheelPointer from './WheelPointer';
import WinnerReveal from './WinnerReveal';
import { useWheelSpin } from './useWheelSpin';

type GameState = 'idle' | 'spinning' | 'result';

interface WheelScreenProps {
  names: string[];
}

const WHEEL_SIZE = 260;

export default function WheelScreen({ names }: WheelScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [winnerName, setWinnerName] = useState('');
  const [winnerIdx, setWinnerIdx] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const history = useFateHistory();
  const wheelSpin = useWheelSpin(sounds, haptics);

  const handleSpin = useCallback(async () => {
    if (names.length < 2) return;

    const winner = pickWinner(names);
    const idx = names.indexOf(winner);

    setGameState('spinning');
    await wheelSpin.spin(names.length, idx);
    setWinnerName(winner);
    setWinnerIdx(idx);
    setGameState('result');

    history.addResult({ mode: 'wheel', winner });
  }, [names, wheelSpin, history]);

  const handleSpinAgain = useCallback(() => {
    setGameState('idle');
  }, []);

  const handleDone = useCallback(() => {
    setGameState('idle');
  }, []);

  const handleSkip = useCallback(() => {
    if (gameState === 'spinning') {
      wheelSpin.skip();
    }
  }, [gameState, wheelSpin]);

  return (
    <View style={styles.container}>
      {/* Wheel area — tap to skip during spin */}
      <Pressable
        onPress={gameState === 'spinning' ? handleSkip : undefined}
        style={styles.wheelContainer}
      >
        <View style={styles.wheelWrapper}>
          <WheelPointer wheelSize={WHEEL_SIZE} />
          <Wheel
            names={names}
            rotation={wheelSpin.rotation}
            size={WHEEL_SIZE}
          />
        </View>
      </Pressable>

      {/* Spin button */}
      {gameState === 'idle' && (
        <View style={styles.buttonArea}>
          <PrimaryButton
            label="Spin the wheel"
            onPress={handleSpin}
            disabled={names.length < 2}
          />
        </View>
      )}

      {/* Winner reveal overlay */}
      {gameState === 'result' && (
        <WinnerReveal
          winner={winnerName}
          winnerIndex={winnerIdx}
          onSpinAgain={handleSpinAgain}
          onDone={handleDone}
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
  buttonArea: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
