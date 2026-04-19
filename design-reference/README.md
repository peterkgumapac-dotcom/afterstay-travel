# Design Reference — Afterstay Prototype

**This folder is the source of truth for the Afterstay app's UI.** The production React Native app in the parent repo must match these files 1:1 — layout, copy, color, animation, timing, easing, choreography, and all states.

Do **not** redesign. Do **not** simplify animations. Do **not** change copy. If something looks off, the prototype wins.

---

## What's here

```
design-reference/
  Afterstay.html           The shell — tweaks panel, device frame, router
  styles/
    tokens.css             Design tokens (colors, spacing, typography, shadows)
  components/
    shell.jsx              StatusBar, TabBar, shared chrome
    icons.jsx              Icon set used across screens
  screens/
    login.jsx              Login screen — animated constellation hero
    loader.jsx             Itinerary loader — 5 SVG vignettes cycling
    home.jsx               Trip dashboard
    guide.jsx              Property guide
    discover.jsx           Places / Planner / Saved (3 tabs)
    budget.jsx             Expense tracking (3 states: cruising/low/over)
    trip.jsx               Trip detail (4 phases: upcoming/inflight/arrived/active)
    moments.jsx            Memories tab (3 layouts: mosaic/diary/map)
```

## How to view the prototype

Open `design-reference/Afterstay.html` in a browser. Use the Tweaks panel (top right) to switch theme, density, start screen, trip phase, budget state, moments layout, and summary state.

Every variant the production app needs to support is toggleable there.

---

## Porting rules — read this before touching any screen

### 1. Match pixel-for-pixel

| What | Rule |
|---|---|
| Colors | Use `@/constants/theme` tokens. If a prototype color isn't in theme yet, add it to theme — don't hardcode. |
| Spacing / radius / typography | Same — theme tokens only. Prototype values in `styles/tokens.css` map 1:1 to `constants/theme.ts`. |
| Copy | Verbatim. Don't "improve" microcopy. |
| Empty states | Port them. They matter as much as populated states. |
| Hit targets | ≥ 44pt on touchable elements. |

### 2. Translate HTML/CSS/JSX → React Native

| Prototype | Production |
|---|---|
| `<div>` + inline styles | `<View>` + `StyleSheet.create` |
| `<span>`, `<p>`, `<h1>` | `<Text>` with the right `typography.*` token |
| `<button onClick>` | `<Pressable>` or `<TouchableOpacity>` |
| `<img>` | `expo-image`'s `<Image>` |
| `<svg>` | `react-native-svg` — copy paths exactly |
| CSS `background: linear-gradient(...)` | `expo-linear-gradient` |
| CSS `backdrop-filter: blur(...)` | `expo-blur`'s `<BlurView>` |
| `localStorage` | `AsyncStorage` via `lib/cache.ts` |
| `window.claude.complete()` | `lib/anthropic.ts` → (eventually) Supabase Edge Function |
| `setInterval` / `setTimeout` loops | `react-native-reanimated` `withRepeat` / `withSequence` |
| Fixed-pixel sizes | Scale to device width with `useWindowDimensions()` where it makes sense; keep absolute values for icons, chips, and controls. |

### 3. Animations — preserve every one

Animation is part of the product, not decoration. Use `react-native-reanimated` v4 + `react-native-worklets`.

| Prototype CSS | React Native |
|---|---|
| `@keyframes` + `animation: x 2s infinite` | `useSharedValue` + `withRepeat(withTiming(...), -1)` |
| `transform: translateX(...)` | `useAnimatedStyle` → `transform: [{ translateX: sv.value }]` |
| `transition: all 0.3s ease-out` | `withTiming(target, { duration: 300, easing: Easing.out(Easing.cubic) })` |
| SVG `<animate>` / `<animateMotion>` | `react-native-svg` `<AnimatedPath>` + `useAnimatedProps` |
| Staggered entries (`animation-delay`) | Loop with `withDelay(i * stagger, withTiming(...))` |
| Shake / wobble | `withSequence` of alternating translateX values |

**Match durations and easings exactly.** If prototype says `2400ms ease-out`, production says `duration: 2400, easing: Easing.out(Easing.cubic)`.

### 4. Animations to port — checklist

#### Login (`screens/login.jsx`)
- [ ] Constellation stars twinkle (opacity + scale loop)
- [ ] Dashed lines draw between stars progressively
- [ ] Plane travels along arc path
- [ ] Auth buttons fade in with stagger (Apple → Google → email → phone)
- [ ] Order is **Apple first**, then Google, email, phone

#### Loader (`screens/loader.jsx`)
- [ ] 5 vignettes cycle: plane arc → pins dropping on map → sunrise over water → postcards stacking with stamp → compass finding north
- [ ] Personalized line per vignette (e.g. "Packing your passport, Peter", "Dropping pins around Boracay")
- [ ] Progress dots at bottom advance with each vignette
- [ ] On final vignette complete, fade out → Home

#### Home (`screens/home.jsx`)
- [ ] Anticipation hero (starfield + constellation arc + plane animation)
- [ ] Countdown ticker
- [ ] Flight card with live progress if in-flight phase
- [ ] Weather forecast card with translucent blur
- [ ] Quick access grid with press-scale feedback
- [ ] Constellation mark in header (3 connected stars + accent)

#### Guide (`screens/guide.jsx`)
- [ ] Pulsing hotel pin on map header
- [ ] Section reveals on scroll
- [ ] Wi-Fi password copy-to-clipboard with haptic + confirm toast

#### Discover (`screens/discover.jsx`)
- [ ] Three segments: Planner · Places · Saved (counts live in tab labels)
- [ ] Filter bar chips (Open now, Nearby, ★ 4.5+) + Filters dropdown
- [ ] OPEN / CLOSED pill per place
- [ ] "Recommend to group" button flips to "Recommended ✓" on tap
- [ ] Save (bookmark) toggles and updates Saved count

#### Budget (`screens/budget.jsx`) — **3 states**
- [ ] **Cruising**: accent progress bar fills left-to-right, category dots pulse softly
- [ ] **Low**: warning strip slides down from top, progress bar shifts to gold, suggestion card fades in
- [ ] **Over**: danger banner with shake-on-mount, progress bar overshoots with red tail, overspend categories highlighted
- [ ] Who Pays wheel/dice interaction
- [ ] Quick split widget
- [ ] Receipt scan entry point (→ `lib/anthropic.ts` `scanReceipt`)

#### Trip phases — **IMPORTANT: live in `screens/home.jsx`, NOT `screens/trip.jsx`**

The Home dashboard is phase-aware. `HomeScreen` holds a `phase` state (`upcoming` | `inflight` | `arrived` | `active`) and swaps the primary card based on it:

- **Upcoming** → `<CountdownCard>` (countdown ticker, "Board flight" CTA)
- **In-flight** → `<FlightProgressCard>` (plane-on-arc animation, pulse rings, play/pause, ETA, "Land" CTA)
- **Arrived** → `<ArrivedCard>` (welcome, "Start trip" CTA, pin ripple)
- **Active** → `<TripActiveCard>` (day-of itinerary, weather pill, activity stagger)

Port this phase state machine to the production Home screen. In production, phase derives from **real data** (`daysUntil()`, flight depart/arrive times, current time) — not from the Tweaks toggle.

Animations to port from `home.jsx`:
- [ ] `FlightProgressCard` — plane computed along quadratic Bezier `M 24 72 Q 150 -10 276 72`, rotation follows tangent, pulse rings on origin/destination (`pulseRing` 2s ease-out infinite), play/pause toggle drives progress drift (~0.008 per 900ms tick), MNL → MPH labels
- [ ] `CountdownCard` — live ticker, star-twinkle hero, "Board flight" CTA
- [ ] `ArrivedCard` — welcome eyebrow + "You've arrived" display text, "Start trip" CTA
- [ ] `TripActiveCard` — day-of itinerary, activity cards, weather pill

Animations elsewhere (not in Home):
- [ ] `VoiceNote` pill (in `moments.jsx`) — tap-to-play voice-note bar with progress fill; 36-bar pseudo-random but stable bar pattern; rAF-driven progress
- [ ] Moments slideshow scrubber (in `moments.jsx`) — play/pause toggle advances `cursor` through moments every 520ms
- [ ] `WhoPaysWheel` (in `budget.jsx`) — wheel-spin with `cubic-bezier(0.17, 0.67, 0.2, 1.0)` 3.4s transition, OR dice tumble at 0.12s linear infinite

#### Trip detail screen (`screens/trip.jsx`)

Separate from phase-aware Home. Segmented control with Overview / Flights / Packing / Files. Port as-is — this is the `app/(tabs)/trip.tsx` equivalent.

#### Moments (`screens/moments.jsx`) — **3 layouts**
- [ ] **Mosaic**: photo grid with varied tile sizes, tap-to-zoom
- [ ] **Diary**: chronological journal entries, photo + caption + date
- [ ] **Map**: geo-pinned memories, pan/zoom map, tap pin → moment card
- [ ] Slideshow modal with swipe + auto-advance

#### Summary (in `screens/trip.jsx`) — **2 states**
- [ ] **Populated**: travel stats 2×2 grid, past trips list, highlights strip (8 cards horizontal scroll), constellation star map (Manila → destinations with drawing lines)
- [ ] **Empty**: invitation to add a past trip, friendly empty illustration
- [ ] Add Trip sheet (upcoming / past toggle, destination, dates, companions)

### 5. Theme

Prototype has dark + light. Both must work. Use `useTheme()` from `@/constants/ThemeContext` and the `getStyles(colors)` factory pattern documented in the parent repo's `CLAUDE.md`.

### 6. What NOT to do

- Don't swap `react-native-reanimated` for `Animated` API. Reanimated only.
- Don't skip animations because "they're not critical." They are.
- Don't ship a phase/state without all animations wired.
- Don't change the order or content of auth buttons on Login. Apple / Google / email / phone, in that order.
- Don't use emoji except where prototype explicitly uses them.
- Don't introduce new colors. If you need one, add it to theme tokens first.

---

## Checklist before marking a screen "done"

- [ ] Side-by-side visual diff against prototype (open `Afterstay.html` in browser, run app in simulator, compare).
- [ ] All animations from the checklist above present and timed correctly.
- [ ] Dark + light theme both work.
- [ ] All states/phases toggle-able via real data (no hardcoded state prop in production).
- [ ] Copy verbatim from prototype.
- [ ] No hardcoded colors, spacing, radii, or font sizes.
- [ ] `@/constants/theme` + `useTheme()` + `getStyles(colors)` pattern used.
- [ ] Data reads through `lib/supabase.ts` (not `lib/notion.ts`).
- [ ] `npm test` passes.

---

## When in doubt

Open `Afterstay.html` locally. Toggle the Tweak. That's what it should look like.
