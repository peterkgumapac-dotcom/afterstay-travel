import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import PrimaryButton from '@/components/fate/shared/PrimaryButton';
import RecentChips from '@/components/fate/shared/RecentChips';
import { fateColors } from '@/constants/fateTheme';
import { useFateHistory } from '@/hooks/fate/useFateHistory';
import { useHaptics } from '@/hooks/fate/useHaptics';
import { useSounds } from '@/hooks/fate/useSounds';
import { pickWinner, pickTwoWinners } from '@/utils/fate/randomWinner';

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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function WheelScreen({ names, duo = false }: WheelScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle');
  const [winnerName, setWinnerName] = useState('');
  const [winnerIdx, setWinnerIdx] = useState(0);
  const [duoWinnerName, setDuoWinnerName] = useState<string | undefined>();
  const [duoWinnerIdx, setDuoWinnerIdx] = useState<number | undefined>();

  const sounds = useSounds();
  const haptics = useHaptics();
  const history = useFateHistory();
  const wheelSpin = useWheelSpin(sounds, haptics);

  const handleSpin = useCallback(async () => {
    if (names.length < 2) return;
    setDuoWinnerName(undefined);
    setDuoWinnerIdx(undefined);

    if (duo && names.length >= 3) {
      // Duo: two sequential spins
      const [first, second] = pickTwoWinners(names);
      const idx1 = names.indexOf(first);

      setGameState('spinning');
      await wheelSpin.spin(names.length, idx1);

      // Pause between spins
      await sleep(1000);

      const idx2 = names.indexOf(second);
      await wheelSpin.spin(names.length, idx2);

      setWinnerName(first);
      setWinnerIdx(idx1);
      setDuoWinnerName(second);
      setDuoWinnerIdx(idx2);
      setGameState('result');

      history.addResult({ mode: 'wheel', winner: first, duoWinner: second });
    } else {
      // Solo spin
      const winner = pickWinner(names);
      const idx = names.indexOf(winner);

      setGameState('spinning');
      await wheelSpin.spin(names.length, idx);
      setWinnerName(winner);
      setWinnerIdx(idx);
      setGameState('result');

      history.addResult({ mode: 'wheel', winner });
    }
  }, [names, duo, wheelSpin, history]);

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

      {gameState === 'idle' && (
        <View style={styles.buttonArea}>
          <PrimaryButton
            label={duo ? 'Spin for two' : 'Spin the wheel'}
            onPress={handleSpin}
            disabled={names.length < 2 || (duo && names.length < 3)}
          />
        </View>
      )}

      {gameState === 'result' && (
        <WinnerReveal
          winner={winnerName}
          winnerIndex={winnerIdx}
          duoWinner={duoWinnerName}
          duoWinnerIndex={duoWinnerIdx}
          onSpinAgain={handleSpinAgain}
          onDone={handleDone}
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
  buttonArea: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
});
