# Fate Decides — Overview

## What this is
A feature in AfterStay's Budget section for deciding who pays the bill (or who pays among two people). Mobile-first, designed for passing one phone around a table or holding up for a group to see.

## User flow
1. User opens Budget → Fate tab
2. Sees tab switcher: Wheel | Touch of Fate
3. Wheel mode: tap "Spin the wheel" → 2-6 second dramatic spin with 0-3 random fake-outs → winner reveal
4. Touch of Fate mode: everyone places fingers → countdown with haptic heartbeat → spotlight sweeps → stops on the loser
5. Winner card shows who pays → "Spin again" or "Done"

## Modes detail
### Wheel
- Classic roulette wheel, 3-10 name slices in AfterStay palette colors
- Spin direction random (CW or CCW)
- Total spin duration 3-7 seconds depending on fake-out count
- Fake-outs are random 0-3 per spin, user never knows it's coming
- Each fake-out: slows to near-stop near a name, then accelerates past it
- Final landing is smooth ease-out to the pre-selected winner
- Sound: rattle during spin, record scratch on fake-out, soft chime on landing

### Touch of Fate
- Users place fingers on screen, each gets a colored circle tracking their touch
- "Start" button appears when 2+ fingers are down
- Tap start → countdown begins (5-12 second random duration)
- Haptic heartbeat pulses on all phones — starts slow, accelerates
- Circles pulse visually in sync with haptic
- At end of countdown: spotlight sweep animation visits each finger, slows, lands on one
- That finger is the loser
- If any finger lifts during countdown, round aborts and restarts (no partial games)

## Duo mode (both)
- Toggle at top right of each mode: "Solo" | "Duo"
- Solo: 1 loser
- Duo: 2 losers (split the bill)
- Wheel duo: spin twice, 1-second pause between
- Touch of Fate duo: spotlight eliminates one, then sweeps again for the second

## History
- Last 5 results shown on result screen as small chips
- Stored in AsyncStorage with key `fate_decides_history`
- Shape: `{ mode: 'wheel' | 'touch', winner: string, timestamp: number, duo?: string }`

## Out of scope (v1)
- Custom dice faces / emoji per person
- Sharing results to Slack/Messages
- Weighted randomness ("Fathy has paid 3 times, reduce probability")
- Anything requiring backend

## Mockup reference
See chat conversation where visual design was finalized. Key states:
- Wheel idle, wheel fake-out, wheel result
- Touch of Fate waiting, Touch of Fate spotlight
All use cream #F5EEDC background, burnt orange #B8541A primary, espresso #3C2814 text, Georgia serif headlines.
