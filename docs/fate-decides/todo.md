# Fate Decides — Build phases

Work through these in order. Each phase ends with a committable unit. Do NOT start the next phase until the previous one works on a real device.

## Phase 0 — Prep (before any code)

- [ ] Read all spec docs in `/docs/fate-decides/`
- [ ] Install dependencies:
  ```
  npx expo install react-native-reanimated react-native-gesture-handler react-native-svg expo-haptics expo-av expo-linear-gradient expo-screen-orientation @react-native-async-storage/async-storage
  ```
- [ ] Verify `react-native-gesture-handler` is v2.9 or higher
- [ ] Add babel plugin `react-native-reanimated/plugin` to babel.config.js (last in plugins array)
- [ ] Source sound files, place in `/assets/sounds/fate/`:
  - spin-rattle.mp3, record-scratch.mp3, drumroll.mp3, fate-reveal.mp3, heartbeat.mp3, boom.mp3, soft-chime.mp3
- [ ] Generate `docs/fate-decides/questions.md` with Claude Code — list every ambiguity in the spec and answer before proceeding
- [ ] Commit: "Add Fate Decides spec docs and dependencies"

## Phase 1 — Scaffolding (no game logic)

- [ ] Create `/constants/fateTheme.ts` per spec-theme.md
- [ ] Create `/app/(tabs)/budget/fate-decides/index.tsx` as empty tab container
- [ ] Create `ModeTabs.tsx` with two tabs, no content yet
- [ ] Create `FateHeader.tsx` (kicker + headline + body)
- [ ] Create `PrimaryButton.tsx` and `SecondaryButton.tsx` per spec
- [ ] Create `NameList.tsx` with add/remove/edit functionality
- [ ] Create `useFateNames.ts` hook with AsyncStorage persistence
- [ ] Lock screen to portrait on mount
- [ ] Wire up tabs to switch between two empty placeholder screens
- [ ] Test: navigate to Fate tab, see cream theme, switch tabs, add/remove names, persistence works
- [ ] Commit: "Fate Decides Phase 1: scaffolding and shared components"

## Phase 2 — Sounds + haptics infrastructure

- [ ] Create `/utils/fate/randomWinner.ts` with pickWinner and pickTwoWinners
- [ ] Create `/hooks/fate/useSounds.ts` with preload and playback
- [ ] Create `/hooks/fate/useHaptics.ts` with wrapped helpers
- [ ] Create `/hooks/fate/useFateHistory.ts` with AsyncStorage
- [ ] Build a debug panel with buttons to trigger each sound and haptic (dev-only, remove before ship)
- [ ] Test on real Android device: all sounds play, haptics fire, history persists across app restarts
- [ ] Verify: playing sound while silent mode on iOS works (playsInSilentModeIOS)
- [ ] Commit: "Fate Decides Phase 2: sound, haptics, and history infra"

## Phase 3 — Wheel basic spin (no fake-outs)

- [ ] Create `/utils/fate/generateSpinPlan.ts` per spec — WITHOUT fake-out logic yet, just main + final
- [ ] Write unit tests for generateSpinPlan in `__tests__/generateSpinPlan.test.ts`
- [ ] Create `Wheel.tsx` SVG component with slice rendering and text
- [ ] Create `WheelPointer.tsx`
- [ ] Create `useWheelSpin.ts` hook
- [ ] Create `WheelScreen.tsx` with idle/spinning/result states
- [ ] Create `WinnerReveal.tsx` basic version
- [ ] Wire "Spin the wheel" button → runs 2-step plan → reveals winner
- [ ] Test: spin 20 times, verify winner distribution looks random, winner matches what's displayed
- [ ] Commit: "Fate Decides Phase 3: basic wheel spin"

## Phase 4 — Wheel fake-outs

- [ ] Add fake-out logic to generateSpinPlan (slow + push pairs)
- [ ] Add unit tests covering 0, 1, 2, 3 fake-out plans
- [ ] Update useWheelSpin to execute multi-step plans with proper sound/haptic triggers per step
- [ ] Add tap-anywhere-to-skip gesture
- [ ] Add `forceFakeouts` debug panel control
- [ ] Polish WinnerReveal with scale animation and confetti dots
- [ ] Test on device: 3-fakeout spin feels dramatic without being tedious, 0-fakeout spin feels clean
- [ ] Commit: "Fate Decides Phase 4: wheel fake-outs and polish"

## Phase 5 — Touch of Fate basic multi-touch

- [ ] Wrap fate-decides route in GestureHandlerRootView
- [ ] Create `FingerTracker.tsx` with Gesture.Manual
- [ ] Create `FingerCircle.tsx` for visual representation
- [ ] Create `TouchScreen.tsx` with state machine
- [ ] Implement empty → collecting → ready transitions
- [ ] "Start" button appears when 2+ fingers down
- [ ] Test on device: 4 fingers register and display correctly, removing a finger removes circle
- [ ] Commit: "Fate Decides Phase 5: multi-touch tracking"

## Phase 6 — Touch of Fate countdown and heartbeat

- [ ] Create `useHeartbeat.ts` with accelerating rhythm
- [ ] Create `CountdownHeartbeat.tsx` for bar visualization
- [ ] Implement abort-on-lift: if finger lifts during countdown, restart
- [ ] Integrate haptic heartbeat across rhythm
- [ ] Test: countdown feels tense without being too long, abort works instantly
- [ ] Commit: "Fate Decides Phase 6: countdown with heartbeat"

## Phase 7 — Touch of Fate spotlight reveal

- [ ] Create `/utils/fate/generateSpotlightPath.ts`
- [ ] Write unit tests for spotlight path generation
- [ ] Create `Spotlight.tsx` with position animation
- [ ] Create `useSpotlightSweep.ts` hook
- [ ] Integrate spotlight with FingerCircle dimming
- [ ] Final boom sound + heavy haptic on landing
- [ ] Build `TouchResultOverlay` for showing who lost
- [ ] Test: sweep feels cinematic, fake-out stop works, landing is satisfying
- [ ] Commit: "Fate Decides Phase 7: spotlight reveal"

## Phase 8 — Duo mode

- [ ] Add DuoToggle component
- [ ] Wheel duo: sequential spins with 1-second pause
- [ ] Touch duo: sweep eliminates one, "...and one more" overlay, second sweep
- [ ] Update WinnerReveal and TouchResultOverlay to handle two winners
- [ ] Test both modes end-to-end
- [ ] Commit: "Fate Decides Phase 8: duo mode"

## Phase 9 — Polish and history

- [ ] Add RecentChips to result screens
- [ ] Add sound mute toggle in settings (persists via AsyncStorage)
- [ ] Add haptic intensity preference (off/light/full)
- [ ] Ensure all animations are cancellable via skip gesture
- [ ] Profile on older Android device, optimize any stuttering sequences
- [ ] Review accessibility: all text readable, buttons min 44px tap target
- [ ] Remove debug panels
- [ ] Commit: "Fate Decides Phase 9: polish and ship"

## Cross-cutting checklist

Before calling it done:
- [ ] Works on Pixel and Samsung test devices
- [ ] Works on at least one iOS device (iPhone 12+)
- [ ] No console warnings in release build
- [ ] Sound works with silent mode on
- [ ] Haptics work on test devices
- [ ] 20 consecutive spins/touches without crash
- [ ] Names persist across app restarts
- [ ] History shows last 5 correctly
- [ ] Back navigation out and back in resumes cleanly
