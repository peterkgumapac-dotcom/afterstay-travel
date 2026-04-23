import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import PrimaryButton from '@/components/fate/shared/PrimaryButton';
import RecentChips from '@/components/fate/shared/RecentChips';
import { colorForName, fateColors, fateFonts, fateLayout } from '@/constants/fateTheme';
import { useFateHistory } from '@/hooks/fate/useFateHistory';
import { useHaptics } from '@/hooks/fate/useHaptics';
import { useSounds } from '@/hooks/fate/useSounds';

interface Finger {
  id: number;
  x: number;
  y: number;
  colorIndex: number;
}

type GameState = 'empty' | 'collecting' | 'ready' | 'countdown' | 'sweep' | 'result';

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function secureRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }
  return Math.random();
}

interface TouchScreenProps {
  duo?: boolean;
}

export default function TouchScreen({ duo = false }: TouchScreenProps) {
  const [gameState, setGameState] = useState<GameState>('empty');
  const [fingers, setFingers] = useState<Map<number, Finger>>(new Map());
  const [victimId, setVictimId] = useState<number | null>(null);
  const [victim2Id, setVictim2Id] = useState<number | null>(null);
  const [spotlightTarget, setSpotlightTarget] = useState<number | null>(null);
  const abortRef = useRef(false);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<GameState>('empty');

  const sounds = useSounds();
  const haptics = useHaptics();
  const history = useFateHistory();

  const heartbeatIntensity = useSharedValue(0);

  // Keep ref in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
    };
  }, []);

  const addFinger = useCallback((id: number, x: number, y: number) => {
    setFingers((prev) => {
      if (prev.has(id) || prev.size >= 10) return prev;
      const next = new Map(prev);
      next.set(id, { id, x, y, colorIndex: prev.size });
      return next;
    });
  }, []);

  const updateFinger = useCallback((id: number, x: number, y: number) => {
    setFingers((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      const existing = next.get(id)!;
      next.set(id, { ...existing, x, y });
      return next;
    });
  }, []);

  const doAbort = useCallback(() => {
    abortRef.current = true;
    sounds.stop('drumroll');
    sounds.stop('heartbeat');
    haptics.warning();
    setGameState('empty');
    setFingers(new Map());
    setVictimId(null);
    setSpotlightTarget(null);
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
  }, [sounds, haptics]);

  const removeFinger = useCallback(
    (id: number) => {
      const gs = gameStateRef.current;
      if (gs === 'countdown' || gs === 'sweep') {
        doAbort();
        return;
      }
      setFingers((prev) => {
        const next = new Map(prev);
        next.delete(id);
        if (next.size === 0) {
          setGameState('empty');
        }
        return next;
      });
    },
    [doAbort],
  );

  // Transition collecting → ready when 2+ fingers held for 500ms
  useEffect(() => {
    if (gameState === 'empty' && fingers.size >= 1) {
      setGameState('collecting');
    }
    if ((gameState === 'collecting' || gameState === 'empty') && fingers.size >= 2) {
      readyTimeoutRef.current = setTimeout(() => setGameState('ready'), 500);
      return () => {
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
      };
    }
  }, [fingers.size, gameState]);

  const gesture = Gesture.Manual()
    .onTouchesDown((event) => {
      'worklet';
      for (const touch of event.changedTouches) {
        runOnJS(addFinger)(touch.id, touch.x, touch.y);
      }
    })
    .onTouchesMove((event) => {
      'worklet';
      for (const touch of event.changedTouches) {
        runOnJS(updateFinger)(touch.id, touch.x, touch.y);
      }
    })
    .onTouchesUp((event) => {
      'worklet';
      for (const touch of event.changedTouches) {
        runOnJS(removeFinger)(touch.id);
      }
    })
    .onTouchesCancelled((event) => {
      'worklet';
      for (const touch of event.changedTouches) {
        runOnJS(removeFinger)(touch.id);
      }
    });

  const handleStart = useCallback(async () => {
    abortRef.current = false;
    setGameState('countdown');

    // Heartbeat countdown: 5-8 seconds
    const countdownDuration = 5000 + Math.random() * 3000;
    const startTime = Date.now();

    // Heartbeat loop
    const beatLoop = async () => {
      while (!abortRef.current) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= countdownDuration) break;

        const progress = elapsed / countdownDuration;
        const interval = 1200 - progress * (1200 - 150);

        // Haptic intensity
        if (progress < 0.33) haptics.light();
        else if (progress < 0.66) haptics.medium();
        else haptics.heavy();

        // Visual pulse
        heartbeatIntensity.value = withSequence(
          withTiming(1, { duration: 80 }),
          withTiming(0, { duration: Math.max(interval - 80, 50) }),
        );

        await sleep(interval);
      }
    };

    await beatLoop();
    if (abortRef.current) return;

    // Pick victim
    const fingerArr = Array.from(fingers.values());
    const victim = fingerArr[Math.floor(secureRandom() * fingerArr.length)];
    setVictimId(victim.id);
    setGameState('sweep');

    // Spotlight sweep
    sounds.play('drumroll');
    const totalHops = 12 + Math.floor(Math.random() * 8);

    for (let i = 0; i < totalHops; i++) {
      if (abortRef.current) return;
      const randomFinger = fingerArr[Math.floor(Math.random() * fingerArr.length)];
      setSpotlightTarget(randomFinger.id);
      haptics.tap();
      const progress = i / totalHops;
      const hopDuration = 80 + Math.floor(progress * 180);
      await sleep(hopDuration);
    }

    // Fake-out on non-victim (if 3+ fingers)
    if (fingerArr.length > 2 && !abortRef.current) {
      const nonVictims = fingerArr.filter((f) => f.id !== victim.id);
      const fakeStop = nonVictims[Math.floor(Math.random() * nonVictims.length)];
      setSpotlightTarget(fakeStop.id);
      await sleep(500);
      if (abortRef.current) return;

      // One more hop
      const randomFinger = fingerArr[Math.floor(Math.random() * fingerArr.length)];
      setSpotlightTarget(randomFinger.id);
      haptics.tap();
      await sleep(280);
    }

    if (abortRef.current) return;

    // Final landing
    setSpotlightTarget(victim.id);
    sounds.stop('drumroll');
    sounds.play('boom');
    haptics.error();
    haptics.heavy();
    await sleep(600);

    if (abortRef.current) return;

    // Duo mode: second sweep
    if (duo && fingerArr.length >= 3) {
      // Brief overlay
      setGameState('sweep'); // stay in sweep
      await sleep(1500);
      if (abortRef.current) return;

      // Pick second victim from remaining
      const remaining = fingerArr.filter((f) => f.id !== victim.id);
      const victim2 = remaining[Math.floor(secureRandom() * remaining.length)];
      setVictim2Id(victim2.id);

      // Second spotlight sweep
      sounds.play('drumroll');
      const hops2 = 10 + Math.floor(Math.random() * 6);
      for (let i = 0; i < hops2; i++) {
        if (abortRef.current) return;
        const rf = remaining[Math.floor(Math.random() * remaining.length)];
        setSpotlightTarget(rf.id);
        haptics.tap();
        const progress = i / hops2;
        await sleep(80 + Math.floor(progress * 180));
      }

      if (abortRef.current) return;
      setSpotlightTarget(victim2.id);
      sounds.stop('drumroll');
      sounds.play('boom');
      haptics.error();
      haptics.heavy();
      await sleep(600);

      if (abortRef.current) return;
      setGameState('result');

      history.addResult({
        mode: 'touch',
        winner: `Finger ${victim.colorIndex + 1}`,
        duoWinner: `Finger ${victim2.colorIndex + 1}`,
      });
    } else {
      setGameState('result');

      history.addResult({
        mode: 'touch',
        winner: `Finger ${victim.colorIndex + 1}`,
      });
    }
  }, [fingers, duo, haptics, sounds, history, heartbeatIntensity]);

  const handlePlayAgain = useCallback(() => {
    abortRef.current = true;
    setGameState('empty');
    setFingers(new Map());
    setVictimId(null);
    setVictim2Id(null);
    setSpotlightTarget(null);
  }, []);

  const fingerArr = Array.from(fingers.values());

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View style={styles.touchArea}>
          {/* Instruction text */}
          {(gameState === 'empty' || gameState === 'collecting') && (
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                {fingers.size === 0
                  ? 'Everyone place a finger on the screen'
                  : fingers.size === 1
                    ? 'Need at least 2 fingers...'
                    : `${fingers.size} fingers — hold steady!`}
              </Text>
            </View>
          )}

          {gameState === 'countdown' && (
            <View style={styles.instructionContainer}>
              <HeartbeatBars intensity={heartbeatIntensity} />
              <Text style={styles.countdownText}>Hold still...</Text>
            </View>
          )}

          {gameState === 'sweep' && (
            <View style={styles.instructionContainer}>
              <Text style={styles.countdownText}>Fate is choosing...</Text>
            </View>
          )}

          {/* Finger circles */}
          {fingerArr.map((f) => {
            const isSpotlit = spotlightTarget === f.id;
            const isVictim = gameState === 'result' && (victimId === f.id || victim2Id === f.id);
            const isDimmed =
              (gameState === 'sweep' || gameState === 'result') &&
              !isSpotlit &&
              !isVictim;

            return (
              <View
                key={f.id}
                style={[
                  styles.fingerCircle,
                  {
                    left: f.x - 36,
                    top: f.y - 36,
                    borderColor: colorForName('', f.colorIndex),
                    opacity: isDimmed ? 0.3 : 1,
                  },
                  isSpotlit && styles.fingerSpotlit,
                  isVictim && styles.fingerVictim,
                ]}
              >
                <View
                  style={[
                    styles.fingerInner,
                    { backgroundColor: colorForName('', f.colorIndex) },
                  ]}
                >
                  <Text style={styles.fingerInitial}>{f.colorIndex + 1}</Text>
                </View>
              </View>
            );
          })}

          {/* Start button */}
          {gameState === 'ready' && (
            <View style={styles.startButtonContainer}>
              <PrimaryButton label="Start" onPress={handleStart} />
            </View>
          )}

          {/* Result overlay */}
          {gameState === 'result' && victimId !== null && (
            <View style={styles.resultOverlay}>
              <View style={styles.resultCard}>
                <Text style={styles.resultBadge}>CHOSEN</Text>
                <View
                  style={[
                    styles.resultCircle,
                    {
                      backgroundColor: colorForName(
                        '',
                        fingers.get(victimId)?.colorIndex ?? 0,
                      ),
                    },
                  ]}
                >
                  <Text style={styles.resultInitial}>
                    {(fingers.get(victimId)?.colorIndex ?? 0) + 1}
                  </Text>
                </View>
                <Text style={styles.resultName}>
                  Finger {(fingers.get(victimId)?.colorIndex ?? 0) + 1}
                </Text>
                {victim2Id !== null && fingers.get(victim2Id) && (
                  <>
                    <Text style={styles.resultAnd}>&amp;</Text>
                    <View
                      style={[
                        styles.resultCircleSmall,
                        {
                          backgroundColor: colorForName(
                            '',
                            fingers.get(victim2Id)?.colorIndex ?? 0,
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.resultInitialSmall}>
                        {(fingers.get(victim2Id)?.colorIndex ?? 0) + 1}
                      </Text>
                    </View>
                    <Text style={styles.resultName}>
                      Finger {(fingers.get(victim2Id)?.colorIndex ?? 0) + 1}
                    </Text>
                  </>
                )}
                <Text style={styles.resultSubtitle}>
                  {victim2Id !== null
                    ? 'are picking up the tab tonight'
                    : 'is picking up the tab tonight'}
                </Text>
                <Pressable
                  onPress={handlePlayAgain}
                  style={styles.playAgainBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.playAgainText}>Play again</Text>
                </Pressable>
                <RecentChips history={history.history} />
              </View>
            </View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

// Heartbeat visualization bars
function HeartbeatBars({ intensity }: { intensity: SharedValue<number> }) {
  const heights = [20, 12, 24, 10, 22, 14, 18];

  return (
    <View style={styles.barsContainer}>
      {heights.map((h, i) => (
        <HeartbeatBar key={i} baseHeight={h} intensity={intensity} index={i} />
      ))}
    </View>
  );
}

function HeartbeatBar({
  baseHeight,
  intensity,
  index,
}: {
  baseHeight: number;
  intensity: SharedValue<number>;
  index: number;
}) {
  const style = useAnimatedStyle(() => ({
    height: baseHeight + intensity.value * 16,
    opacity: index % 2 === 0 ? 1 : 0.6,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: fateColors.primary },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  touchArea: {
    flex: 1,
    backgroundColor: fateColors.backgroundDeep,
    borderRadius: 16,
    overflow: 'hidden',
  },
  instructionContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  instructionText: {
    fontSize: 16,
    color: fateColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  countdownText: {
    fontSize: 18,
    fontWeight: '600',
    color: fateColors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
  },
  fingerCircle: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    backgroundColor: fateColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerSpotlit: {
    borderWidth: 3,
    shadowColor: fateColors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
  },
  fingerVictim: {
    borderWidth: 4,
    transform: [{ scale: 1.2 }],
    shadowColor: fateColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
  fingerInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fingerInitial: {
    fontFamily: fateFonts.serif,
    fontSize: 22,
    fontWeight: '500',
    color: fateColors.background,
  },
  startButtonContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 238, 220, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  resultCard: {
    backgroundColor: fateColors.surface,
    borderWidth: 0.5,
    borderColor: fateColors.surfaceBorder,
    borderRadius: fateLayout.cardRadius,
    paddingHorizontal: fateLayout.cardPaddingH,
    paddingTop: fateLayout.cardPaddingV,
    paddingBottom: 32,
    alignItems: 'center',
    shadowColor: fateColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  resultBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: fateColors.primary,
    marginBottom: 20,
  },
  resultCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultInitial: {
    fontFamily: fateFonts.serif,
    fontSize: 32,
    fontWeight: '500',
    color: fateColors.background,
  },
  resultName: {
    fontFamily: fateFonts.serif,
    fontSize: 36,
    fontWeight: '500',
    color: fateColors.textPrimary,
    letterSpacing: -0.5,
  },
  resultAnd: {
    fontFamily: fateFonts.serif,
    fontSize: 24,
    fontWeight: '500',
    color: fateColors.textSecondary,
    marginVertical: 8,
  },
  resultCircleSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  resultInitialSmall: {
    fontFamily: fateFonts.serif,
    fontSize: 24,
    fontWeight: '500',
    color: fateColors.background,
  },
  resultSubtitle: {
    fontSize: 13,
    fontStyle: 'italic',
    color: fateColors.textSecondary,
    marginTop: 8,
  },
  playAgainBtn: {
    marginTop: 28,
    backgroundColor: fateColors.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: fateLayout.buttonRadius,
  },
  playAgainText: {
    fontSize: 14,
    fontWeight: '600',
    color: fateColors.buttonPrimaryText,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 40,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
});
