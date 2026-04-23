# Fate Decides — Theme

## Color tokens
All colors should go in `/constants/fateTheme.ts` and be imported everywhere. Do not hardcode hex values in components.

```ts
export const fateColors = {
  background: '#F5EEDC',          // cream, primary screen bg
  backgroundDeep: '#EDE3CC',       // slightly darker, for spotlight mode
  surface: '#FFFFFF',              // cards, finger circles
  surfaceBorder: 'rgba(139, 90, 43, 0.2)',  // card borders
  
  textPrimary: '#3C2814',          // espresso, headlines and primary text
  textSecondary: 'rgba(60, 40, 20, 0.65)',  // body copy
  textTertiary: 'rgba(60, 40, 20, 0.5)',    // captions, kickers
  textMuted: 'rgba(60, 40, 20, 0.4)',
  
  primary: '#B8541A',              // burnt orange, CTA accent
  primaryText: '#8B3A10',          // darker orange for text on primary-tinted bg
  secondary: '#DB7A3C',            // soft orange
  accent: '#C59820',               // mustard/gold
  warm: '#8B5A2B',                 // saddle brown
  
  divider: 'rgba(139, 90, 43, 0.15)',
  dividerStrong: 'rgba(139, 90, 43, 0.2)',
  
  buttonPrimary: '#3C2814',        // dark espresso CTAs
  buttonPrimaryText: '#F5EEDC',    // cream text on dark button
  
  shadow: 'rgba(60, 40, 20, 0.08)',
  shadowStrong: 'rgba(60, 40, 20, 0.15)',
};

// Person-color rotation for wheel slices and finger circles
export const personColors = [
  '#B8541A',  // burnt orange
  '#DB7A3C',  // soft orange
  '#C59820',  // mustard
  '#8B5A2B',  // saddle brown
  '#A84518',  // deep orange
  '#E8A854',  // light amber
  '#6B4423',  // dark brown
  '#D4A038',  // yellow-gold
  '#C2612E',  // rust
  '#7A4818',  // walnut
];

// Assign a person-color by index, stable across sessions
export function colorForName(name: string, index: number): string {
  return personColors[index % personColors.length];
}
```

## Typography
```ts
export const fateFonts = {
  serif: 'Georgia',   // or whatever AfterStay's serif is — MATCH EXISTING
  sans: 'System',     // or AfterStay's sans — MATCH EXISTING
};

export const fateText = {
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500' as const,
    color: fateColors.warm,
    textTransform: 'uppercase' as const,
  },
  headline: {
    fontFamily: fateFonts.serif,
    fontSize: 28,
    fontWeight: '500' as const,
    color: fateColors.textPrimary,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 14,
    color: fateColors.textSecondary,
    lineHeight: 21,
  },
  bodyItalic: {
    fontSize: 13,
    color: fateColors.textSecondary,
    fontStyle: 'italic' as const,
  },
};
```

## Component patterns

### Primary button
- Background: `fateColors.buttonPrimary` (dark espresso)
- Text: `fateColors.buttonPrimaryText` (cream)
- Padding: 16px vertical
- Border radius: 10px
- Font: 15px, weight 500, letter-spacing 1px
- No border

### Secondary button
- Background: transparent
- Text: `fateColors.textPrimary`
- Border: 1px solid rgba(60, 40, 20, 0.3)
- Same padding/radius as primary

### Card (winner reveal)
- Background: `fateColors.surface` (white)
- Border: 0.5px solid `fateColors.surfaceBorder`
- Border radius: 20px
- Padding: 36px 48px 32px
- Shadow: 0 8px 24px `fateColors.shadow`

### Kicker label
- 11px, letter-spacing 2px, weight 500
- Color varies by context: `warm` for neutral, `primary` for action, `accent` for celebration

### Tab bar (Wheel | Touch of Fate)
- Container: `rgba(139, 90, 43, 0.08)` background, 8px radius, 3px padding
- Active: cream background `#F5EEDC`, 6px radius, subtle shadow
- Inactive: transparent, muted text

## Animation timing standards
- Wheel main spin: 2500ms, easeOut cubic
- Wheel fake-out slow: 1200ms - (index * 200ms), easeOut
- Wheel fake-out re-accel: 800ms, easeIn
- Wheel final land: 1800ms, easeOut
- Spotlight sweep per hop: starts 300ms, decelerates to 80ms minimum
- Heartbeat: starts 1200ms interval, halves to 150ms minimum over countdown duration
- Winner reveal scale: 400ms spring, damping 12
- Page transitions: 240ms easeInOut

## Haptic mapping
- Wheel tick during spin: `selectionAsync()` throttled to 120ms
- Fake-out moment: `impactAsync(Medium)`
- Final landing: `impactAsync(Heavy)` + `notificationAsync(Success)`
- Heartbeat: `impactAsync(Light)` then `Medium` then `Heavy` as it accelerates
- Spotlight hop: `selectionAsync()` per hop
- Final boom: `notificationAsync(Error)` + `impactAsync(Heavy)` fired together

## Sound file specs
Place in `/assets/sounds/fate/`. All should be < 100KB, mp3 format:
- `spin-rattle.mp3` — looping wooden clicker sound, will be stopped on landing
- `record-scratch.mp3` — 400ms scratch for fake-out moment
- `drumroll.mp3` — building drumroll for spotlight sweep
- `fate-reveal.mp3` — 800ms resolving chime for winner landing
- `heartbeat.mp3` — single thump, will be played on rhythm
- `boom.mp3` — 500ms bass hit for Touch of Fate loser reveal
- `soft-chime.mp3` — button tap feedback

Sources: freesound.org (CC0), zapsplat.com, or ElevenLabs sound effects API.
