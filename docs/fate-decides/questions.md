# Fate Decides — Spec ambiguities and resolutions

Generated before Phase 1 to eliminate spec questions during build.

---

## Routing & Navigation

**Q1: How does the user reach Fate Decides from the Budget tab?**
The spec says `/app/(tabs)/budget/fate-decides/index.tsx`. But budget.tsx is currently a flat tab file, not a directory layout. We need to convert budget into a nested layout.

**A1:** Create `app/(tabs)/budget/_layout.tsx` as a Stack navigator with two screens: the main budget view (renamed `index.tsx`) and `fate-decides/index.tsx`. The Budget tab bar item continues to point to the budget group. A "Fate Decides" entry point (button/card) on the main budget screen navigates into the sub-route.

**Q2: Should Fate Decides be a modal or an inline screen?**
**A2:** Inline screen within the budget stack, not a modal. The spec shows it as a tab container with its own sub-tabs (Wheel | Touch of Fate), which implies a full screen.

---

## Theme Integration

**Q3: The spec defines `fateTheme.ts` with its own color palette (cream/burnt orange). Does this conflict with the main AfterStay dark theme?**
**A3:** No conflict — Fate Decides is a self-contained light-themed screen. It imports from `fateTheme.ts` exclusively, not from the main `useTheme()` context. The cream palette is intentional for the playful "game" feel. The main app dark theme doesn't apply here.

**Q4: The spec says `fateFonts.serif: 'Georgia'`. Is Georgia available on both iOS and Android?**
**A4:** Georgia is available on both platforms natively. iOS ships it; Android includes it in the system font stack. No need to bundle a custom font. If Georgia isn't rendering, fall back to the system serif via `fontFamily: 'serif'`.

**Q5: The spec says `fateFonts.sans: 'System'`. What does that mean concretely?**
**A5:** Use the platform default: omit `fontFamily` entirely (React Native defaults to the system sans-serif). On iOS that's SF Pro, on Android that's Roboto.

---

## Wheel Mode

**Q6: The spec says "pointer at top" and "wheel rotates clockwise." The generateSpinPlan math calculates `targetSettleRotation = 360 - winnerAngle`. Does this assume slice 0 starts at 12 o'clock?**
**A6:** Yes. Slice 0 starts at 0 degrees (12 o'clock position). Slices are laid out clockwise. The pointer is fixed at the top (0 degrees). When the wheel rotates, the pointer "reads" whichever slice passes under it.

**Q7: The spec says the wheel `size` defaults to 260. Is that the diameter or radius? And is 260 enough on larger phones?**
**A7:** 260 is the diameter in logical pixels. This is fine for most phones (works well centered in a ~375pt-wide screen). Make it responsive: `Math.min(Dimensions.get('window').width - 80, 300)` capped at 300.

**Q8: Wheel text shows "initial letter large (22px Georgia), then full name below (10px caps)." What if the name is very long (e.g., "Christopher")?**
**A8:** Truncate names on the slice to 8 characters + ellipsis. The full name shows in the winner reveal. Slice text is decorative, not the primary readout.

**Q9: What happens with 2 names on the wheel? That's only 2 slices — each 180 degrees. Will it look weird?**
**A9:** Yes, 2 slices looks odd. Minimum 3 slices visually — if only 2 names, duplicate each name once to create 4 visual slices (but still only 2 logical choices). The winner selection still picks from the original 2 names.

**Q10: In Duo mode, the spec says "spin twice, 1-second pause between." Does the wheel reset rotation between spins?**
**A10:** No. Second spin starts from wherever the first spin ended. This looks more natural than snapping back to 0.

---

## Touch of Fate

**Q11: The spec says "restart on lift" — does this mean ALL fingers must lift and re-place, or just the countdown resets?**
**A11:** Per spec: "round aborts and restarts." State goes back to `empty`. All finger circles disappear. Everyone must re-place fingers and tap Start again. This is intentional — prevents gaming by strategic lifts.

**Q12: Touch of Fate uses `Gesture.Manual()`. Does this work with React Native's New Architecture (Fabric)?**
**A12:** Yes. `react-native-gesture-handler` 2.28 supports Fabric and the New Architecture. `Gesture.Manual` works correctly.

**Q13: The spec references `GestureHandlerRootView`. Where should it be placed — at the fate-decides route level or higher?**
**A13:** At the fate-decides route level (`index.tsx`). The main app may already have one at the root layout (expo-router adds one internally), but wrapping the fate screen explicitly ensures gesture handling works correctly for multi-touch.

**Q14: The spotlight uses "radial gradient." React Native doesn't have native radial gradients. How to implement?**
**A14:** Use `react-native-svg` with a `<RadialGradient>` inside a `<Circle>`. This is more reliable than trying to fake it with `expo-linear-gradient`. The spotlight is a 160px SVG circle with a radial gradient from accent color (center) to transparent (edge).

**Q15: What if the user has only 2 fingers in Touch of Fate and we need Duo mode (2 losers)? That eliminates everyone.**
**A15:** Duo mode requires minimum 3 fingers (3 participants). The "Start" button in Duo mode should only appear when 3+ fingers are down. Update `minNames` validation accordingly.

---

## Sounds & Haptics

**Q16: The spec says `playsInSilentModeIOS: true`. Does this conflict with user expectations? Users might have their phone on silent during dinner.**
**A16:** This is intentional per spec — the game experience relies on audio. But there's a mute toggle in Phase 9 settings, so users can opt out. The mute state persists in AsyncStorage.

**Q17: The spec says throttle haptic `tap` to 80ms. Should other haptic types also be throttled?**
**A17:** Only `tap` (used during rapid wheel ticks and spotlight hops). The other haptic types (`light`, `medium`, `heavy`, `success`, `error`) fire at controlled moments and don't need throttling.

**Q18: What if sound files fail to load on a device? Should we block the game?**
**A18:** No. Per spec: "If loading fails, don't crash — just log and continue silently." The game works without sound. The `useSounds.play()` should be a no-op if the sound isn't loaded.

---

## Data & Persistence

**Q19: The spec stores names in AsyncStorage key `fate_names`. Should names be per-trip or global?**
**A19:** Global for v1. The names represent the travel group, which is typically the same across the trip. Per-trip scoping is future work.

**Q20: History stores last 5 results. Should history be per-trip?**
**A20:** Global for v1, same reasoning as names.

**Q21: The `FateResult.id` field — what format?**
**A21:** Use `Date.now().toString(36) + Math.random().toString(36).slice(2, 6)` for a simple unique ID. No need for UUID since this is local-only storage.

---

## Edge Cases

**Q22: What if the user navigates away mid-spin or mid-countdown? Should state persist?**
**A22:** No. On unmount, cancel all animations, sounds, and timers. When the user returns, they see the idle state. No mid-game persistence needed.

**Q23: What about accessibility? The wheel spin is entirely visual/haptic.**
**A23:** Add `accessibilityLabel` to the spin button ("Spin the wheel to randomly select who pays"), and announce the winner via `AccessibilityInfo.announceForAccessibility()` when the result is revealed. The wheel animation itself doesn't need to be accessible — the result announcement is what matters.

**Q24: The spec mentions "confetti dots" on the winner reveal. What exactly?**
**A24:** Small colored circles (8-12) that fade in at random positions around the winner card after 200ms delay. Colors from `personColors[]`. Simple opacity animation from 0 to 0.6, no physics. Keep it subtle.
