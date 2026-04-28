# Fate Decides — AfterStay feature

A playful "who pays the bill" feature in the Budget section. Two game modes with real randomness but theatrical reveal.

## Stack
- Expo SDK latest, TypeScript, React Native
- react-native-reanimated v3 (animations)
- react-native-gesture-handler v2.9+ (multi-touch for Touch of Fate)
- react-native-svg (wheel and icons)
- expo-haptics, expo-audio, expo-linear-gradient
- @react-native-async-storage/async-storage (history)

## Feature routes
- /app/(tabs)/budget/fate-decides/index.tsx — tab container

## Feature structure
Two tabs under the Fate route:
1. Wheel — classic spin-the-wheel with 0-3 random fake-outs (hidden from user)
2. Touch of Fate — multi-touch, spotlight sweeps to victim, restarts if anyone lifts

## Theme
See docs/fate-decides/spec-theme.md. Cream (#F5EEDC) + burnt orange (#B8541A) + espresso text (#3C2814). Georgia serif for headlines, sans for body. See also the existing AfterStay palette in /constants/theme.ts — match exactly.

## Build phases
See docs/fate-decides/todo.md. Do NOT skip phases. Each phase ends with a committable unit.

## Active phase
See docs/fate-decides/progress.md (update at end of each session).

## Non-negotiables
1. Truly random winner selection — never bias toward anyone. Use crypto.getRandomValues if available, fall back to Math.random.
2. Fake-outs land on the pre-selected winner after all theatrics. The winner is decided first, drama is choreographed second.
3. Touch of Fate restarts the round entirely if any finger lifts during countdown. No partial recoveries.
4. All audio must preload before the first game starts.
5. Every animation must be cancellable — user tap anywhere skips to final state.
