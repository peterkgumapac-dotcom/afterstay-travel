# Drag Paper Album Turn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current canned recap album flip with a finger-driven paper-drag page turn that visibly follows the user's touch and settles forward/backward naturally.

**Architecture:** Keep the existing trip recap data, page templates, and album layout, but replace the `Animated` + `PanResponder` flip overlay with a Reanimated/Gesture Handler controller. The page turn should expose a stable next page underneath, a drag-controlled outgoing page region, a paper back face, and fold shadows/highlights derived from gesture progress.

**Tech Stack:** React Native, Expo, `react-native-reanimated` 4.2.1, `react-native-gesture-handler` ~2.30.0, existing `expo-image` and `expo-linear-gradient`.

---

## Current Findings

The current implementation in `components/summary/TripAlbumPreview.tsx` does not behave like dragged paper because:

- `PanResponder` only detects a left swipe and calls `openNextPage()` on release.
- `openNextPage()` starts `Animated.timing(flipAnim, { toValue: 1 })`, so the flip is a canned animation, not gesture progress.
- The visible fold is a fixed-width `curledPageSheet` animated by time, not by finger position.
- The page content opacity swaps between front and paper back, which reads like fading panels rather than paper deformation.
- There is no cancel path. A real paper drag should spring back if the user releases before the threshold.

This is OTA-safe because the project already has Reanimated and Gesture Handler installed.

## File Structure

- Modify: `components/summary/TripAlbumPreview.tsx`
  - Keep album page rendering, data building, buttons, and stats.
  - Replace `PanResponder`, `Animated.Value`, and `Animated.timing` page-turn state with Reanimated shared values.
  - Add drag-progress-driven styles for next page, current page, fold, paper back, and shadow.
- No new backend/data files.
- Optional later split if the component remains large:
  - Create `components/summary/AlbumPageTurn.tsx` for gesture/animation only.

## Task 1: Remove Canned Flip State

**Files:**
- Modify: `components/summary/TripAlbumPreview.tsx`

- [ ] **Step 1: Replace imports**

Change the top imports from React Native Animated/PanResponder usage to Gesture Handler/Reanimated:

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
```

Remove `PanResponder`, `NativeTouchEvent`, and React Native `Animated` imports.

- [ ] **Step 2: Remove old swipe helpers**

Delete:

```ts
function shouldTurnBySwipe(dx: number, dy: number, canTurnPage: boolean, isFlipping: boolean) {
  const horizontal = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15;
  return canTurnPage && !isFlipping && horizontal && dx < 0;
}
```

Delete `swipeStartRef`, `handleTouchStart`, `handleTouchEnd`, and `pageSwipeResponder`.

- [ ] **Step 3: Add Reanimated turn state**

Inside `TripAlbumPreview`, replace `flipAnim`/`flippingPage`/`flippingToPage` with:

```tsx
const dragX = useSharedValue(0);
const turnProgress = useSharedValue(0);
const isTurning = useSharedValue(false);
const [turningFromIndex, setTurningFromIndex] = useState<number | null>(null);
const [turningToIndex, setTurningToIndex] = useState<number | null>(null);
```

Keep `pageIndex`, `flatListRef`, and `scrollX` only if still needed for the existing list. `scrollX` can remain as React Native Animated for page rendering outside the flip if we keep the `Animated.FlatList`; otherwise convert the static page to a plain `View` in Task 2.

- [ ] **Step 4: Verify TypeScript catches removed references**

Run:

```bash
npx tsc --noEmit --pretty false --incremental false
```

Expected: fail only on references to removed `flipAnim`, `flippingPage`, `flippingToPage`, `PanResponder`, or `onTouchStart/onTouchEnd`. Fix those in the next task.

## Task 2: Build A Gesture-Driven Turn Controller

**Files:**
- Modify: `components/summary/TripAlbumPreview.tsx`

- [ ] **Step 1: Add page-turn commit helpers**

Add these callbacks inside `TripAlbumPreview`:

```tsx
const beginTurn = useCallback(() => {
  if (!canTurnPage || turningFromIndex !== null) return false;
  const nextIndex = Math.min(pageIndex + 1, pages.length - 1);
  if (nextIndex === pageIndex) return false;
  setTurningFromIndex(pageIndex);
  setTurningToIndex(nextIndex);
  return true;
}, [canTurnPage, pageIndex, pages.length, turningFromIndex]);

const finishTurn = useCallback(
  (nextIndex: number) => {
    setPageIndex(nextIndex);
    flatListRef.current?.scrollToOffset({ offset: nextIndex * SNAP_W, animated: false });
    setTurningFromIndex(null);
    setTurningToIndex(null);
  },
  [],
);

const cancelTurn = useCallback(() => {
  setTurningFromIndex(null);
  setTurningToIndex(null);
}, []);
```

- [ ] **Step 2: Add drag gesture**

Create a gesture that updates progress continuously:

```tsx
const pageTurnGesture = useMemo(
  () =>
    Gesture.Pan()
      .enabled(canTurnPage)
      .activeOffsetX([-8, 8])
      .failOffsetY([-18, 18])
      .onBegin(() => {
        if (turningFromIndex !== null) return;
        isTurning.value = true;
        dragX.value = 0;
        turnProgress.value = 0;
        runOnJS(beginTurn)();
      })
      .onUpdate((event) => {
        if (event.translationX >= 0) return;
        dragX.value = event.translationX;
        turnProgress.value = Math.min(1, Math.max(0, -event.translationX / (PAGE_W * 0.72)));
      })
      .onEnd((event) => {
        const shouldCommit = turnProgress.value > 0.45 || event.velocityX < -650;
        if (shouldCommit && turningToIndex !== null) {
          turnProgress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }, () => {
            isTurning.value = false;
            dragX.value = 0;
            runOnJS(finishTurn)(turningToIndex);
          });
        } else {
          turnProgress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, () => {
            isTurning.value = false;
            dragX.value = 0;
            runOnJS(cancelTurn)();
          });
        }
      }),
  [beginTurn, cancelTurn, canTurnPage, dragX, finishTurn, isTurning, turnProgress, turningFromIndex, turningToIndex],
);
```

- [ ] **Step 3: Replace wrapper**

Replace:

```tsx
<View style={styles.bookViewport} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} {...pageSwipeResponder.panHandlers}>
```

with:

```tsx
<GestureDetector gesture={pageTurnGesture}>
  <View style={styles.bookViewport}>
```

Close the `GestureDetector` after the `bookViewport` closing `</View>`.

- [ ] **Step 4: Make the button use the same progress**

Replace `openNextPage` with a helper that starts the same Reanimated progress:

```tsx
const openNextPage = useCallback(() => {
  const started = beginTurn();
  if (!started) return;
  const nextIndex = Math.min(pageIndex + 1, pages.length - 1);
  turnProgress.value = 0;
  turnProgress.value = withTiming(1, { duration: PAGE_TURN_DURATION_MS, easing: Easing.inOut(Easing.cubic) }, () => {
    isTurning.value = false;
    dragX.value = 0;
    runOnJS(finishTurn)(nextIndex);
  });
}, [beginTurn, dragX, finishTurn, isTurning, pageIndex, pages.length, turnProgress]);
```

## Task 3: Replace Thin Strip With Finger-Visible Paper Geometry

**Files:**
- Modify: `components/summary/TripAlbumPreview.tsx`

- [ ] **Step 1: Derive animated styles**

Add these animated styles inside `TripAlbumPreview`:

```tsx
const nextPageStyle = useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(turnProgress.value, [0, 1], [0.992, 1]) }],
  opacity: interpolate(turnProgress.value, [0, 0.08, 1], [0.96, 1, 1]),
}));

const currentPageMaskStyle = useAnimatedStyle(() => ({
  opacity: interpolate(turnProgress.value, [0, 0.72, 1], [1, 0.95, 0]),
  transform: [{ translateX: interpolate(turnProgress.value, [0, 1], [0, -PAGE_W * 0.08]) }],
}));

const paperSheetStyle = useAnimatedStyle(() => {
  const p = turnProgress.value;
  return {
    opacity: interpolate(p, [0, 0.04, 0.96, 1], [0, 1, 1, 0]),
    transform: [
      { perspective: 1600 },
      { translateX: interpolate(p, [0, 0.5, 1], [PAGE_W * 0.22, -PAGE_W * 0.1, -PAGE_W * 0.42]) },
      { rotateY: `${interpolate(p, [0, 0.5, 1], [-8, -58, -126])}deg` },
      { scaleX: interpolate(p, [0, 0.5, 1], [1, 0.94, 0.62]) },
    ],
  };
});

const paperFrontStyle = useAnimatedStyle(() => ({
  opacity: interpolate(turnProgress.value, [0, 0.32, 0.52], [1, 1, 0]),
}));

const paperBackStyle = useAnimatedStyle(() => ({
  opacity: interpolate(turnProgress.value, [0.24, 0.42, 1], [0, 1, 1]),
}));

const foldShadowStyle = useAnimatedStyle(() => ({
  opacity: interpolate(turnProgress.value, [0, 0.22, 0.8, 1], [0, 0.5, 0.34, 0]),
  transform: [{ translateX: interpolate(turnProgress.value, [0, 1], [PAGE_W * 0.26, -PAGE_W * 0.3]) }],
}));
```

- [ ] **Step 2: Render the overlay from indices**

Replace the existing `{flippingPage ? (...) : null}` overlay with:

```tsx
{turningFromIndex !== null && turningToIndex !== null ? (
  <View pointerEvents="none" style={styles.flipOverlay}>
    <Animated.View style={[styles.pageShell, styles.nextPageUnderlay, nextPageStyle]}>
      {renderAlbumPageContent(pages[turningToIndex])}
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(71,41,20,0.16)']} style={styles.pageEdge} />
      <View style={styles.pageCorner} />
    </Animated.View>

    <Animated.View style={[styles.pageShell, styles.currentPageDuringDrag, currentPageMaskStyle]}>
      {renderAlbumPageContent(pages[turningFromIndex])}
      <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(71,41,20,0.16)']} style={styles.pageEdge} />
      <View style={styles.pageCorner} />
    </Animated.View>

    <Animated.View style={[styles.dragFoldShadow, foldShadowStyle]} />

    <Animated.View style={[styles.dragPaperSheet, paperSheetStyle]}>
      <Animated.View style={[styles.dragPaperFront, paperFrontStyle]}>
        <View style={styles.dragPaperFrontContent}>
          {renderAlbumPageContent(pages[turningFromIndex])}
        </View>
      </Animated.View>
      <Animated.View style={[styles.dragPaperBack, paperBackStyle]}>
        <LinearGradient colors={['#fffaf0', '#eadcc5', '#cbb08e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={styles.pageBackFold} />
        <View style={styles.pageBackLine} />
        <View style={[styles.pageBackLine, styles.pageBackLineShort]} />
        <View style={styles.pageBackPhotoGhost} />
        <View style={styles.pageBackLine} />
      </Animated.View>
      <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.12)', 'rgba(81,55,32,0.28)']} style={styles.dragPaperRidge} />
    </Animated.View>
  </View>
) : null}
```

- [ ] **Step 3: Add replacement styles**

Add these styles and remove unused `curledPageSheet`, `curledPageContent`, `curledPageBackFace`, `curlFaceShade`, `flipBackCurl`, `flipCurlHighlight`, `flipPageThickness`, and `revealedPageShadow` after the replacement compiles:

```tsx
currentPageDuringDrag: {
  position: 'absolute',
  zIndex: 2,
},
dragFoldShadow: {
  position: 'absolute',
  zIndex: 3,
  width: PAGE_W * 0.3,
  height: PAGE_H - 20,
  borderRadius: 24,
  backgroundColor: 'rgba(34,20,10,0.34)',
  shadowColor: '#000',
  shadowOpacity: 0.36,
  shadowRadius: 22,
  shadowOffset: { width: -14, height: 10 },
},
dragPaperSheet: {
  position: 'absolute',
  zIndex: 4,
  right: 20,
  width: PAGE_W * 0.62,
  height: PAGE_H,
  borderTopRightRadius: 18,
  borderBottomRightRadius: 18,
  overflow: 'hidden',
  backgroundColor: '#f4eadb',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.5)',
  shadowColor: '#000',
  shadowOpacity: 0.44,
  shadowRadius: 28,
  shadowOffset: { width: -20, height: 16 },
  elevation: 16,
},
dragPaperFront: {
  ...StyleSheet.absoluteFillObject,
  overflow: 'hidden',
},
dragPaperFrontContent: {
  width: PAGE_W,
  height: PAGE_H,
  transform: [{ translateX: -(PAGE_W * 0.38) }],
},
dragPaperBack: {
  ...StyleSheet.absoluteFillObject,
  paddingTop: 34,
  paddingHorizontal: 18,
  paddingBottom: 24,
  backgroundColor: '#f7efdf',
},
dragPaperRidge: {
  position: 'absolute',
  top: -8,
  right: -2,
  bottom: -8,
  width: 58,
  borderRadius: 28,
},
```

## Task 4: Acceptance Testing

**Files:**
- No code changes unless tests fail.

- [ ] **Step 1: Static validation**

Run:

```bash
npx tsc --noEmit --pretty false --incremental false
npx eslint components/summary/TripAlbumPreview.tsx --ext .ts,.tsx
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Export validation**

Run:

```bash
npx expo export --platform ios
npx expo export --platform android
```

Expected: both export successfully.

- [ ] **Step 3: Live simulator validation**

Restart the iOS simulator app twice to pull OTA:

```bash
/Applications/Xcode.app/Contents/Developer/usr/bin/simctl terminate 7140699E-55A9-4BF2-8E57-DE3F86E96CAE com.afterstay.travel || true
sleep 2
/Applications/Xcode.app/Contents/Developer/usr/bin/simctl launch 7140699E-55A9-4BF2-8E57-DE3F86E96CAE com.afterstay.travel
sleep 14
/Applications/Xcode.app/Contents/Developer/usr/bin/simctl terminate 7140699E-55A9-4BF2-8E57-DE3F86E96CAE com.afterstay.travel || true
sleep 2
/Applications/Xcode.app/Contents/Developer/usr/bin/simctl launch 7140699E-55A9-4BF2-8E57-DE3F86E96CAE com.afterstay.travel
```

Manual path:

- Open Home.
- Tap `View recap`.
- Press and drag left on the album page, not just the button.
- Confirm the paper follows the finger while dragging.
- Release before halfway and confirm it snaps back.
- Drag past halfway and confirm it completes to the next page.
- Tap the arrow button and confirm it still completes a turn.

## Task 5: OTA Publish

**Files:**
- No code changes.

- [ ] **Step 1: Commit**

```bash
git add components/summary/TripAlbumPreview.tsx docs/superpowers/plans/2026-05-12-drag-paper-album-turn.md
git commit -m "fix(summary): make album page turn draggable"
git push origin HEAD:otas
```

- [ ] **Step 2: Publish OTA**

```bash
npx eas update --channel preview --message "Make recap album page turn draggable" --environment production --non-interactive
npx eas update --channel production --message "Make recap album page turn draggable" --environment production --non-interactive
```

- [ ] **Step 3: Report evidence**

Report:

- Commit SHA.
- Preview update group ID.
- Production update group ID.
- TypeScript/ESLint/export results.
- Live simulator result, including whether drag-follow, cancel, and commit were checked.

## Native-Build Follow-Up

If this still does not feel close enough after the Reanimated drag-follow implementation, stop polishing the OTA approximation and evaluate a native page-curl library or custom Skia mesh. That likely requires a new binary if the dependency includes native code. The OTA-safe ceiling is a convincing drag-controlled folded sheet, not true deformable paper physics.

