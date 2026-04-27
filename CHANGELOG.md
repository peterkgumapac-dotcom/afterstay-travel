# Changelog

## [1.3.1] — 2026-04-27

### Bug Fixes
- Fixed photo upload failures — replaced fragile base64 pipeline with memory-efficient fetch+ArrayBuffer approach
- Fixed compression fallback returning unreadable content:// URIs on Android
- Upload errors now surface actual error messages instead of generic "0 of N uploaded"
- Fixed notifications not working — created missing `notifications` table, indexes, and RLS policies
- Added missing `notification_prefs`, `expo_push_token`, `push_enabled` columns to profiles
- Fixed "Clear all" not clearing notifications — read notifications now hidden from list
- Fixed local alert dismissals not persisting across screen navigation
- Fixed location autocomplete dropdown rendering behind other form fields (z-index)

### Infrastructure
- `readFileAsBytes()` shared helper for all Supabase Storage uploads
- `notifications` table migration with full RLS policy set
- Dev-mode diagnostic logging for notification insert/fetch failures

---

## [1.3.0] — 2026-04-26

### Group Voting
- Per-member voting on recommended places with `voteByMember` JSONB
- GroupVotingSheet modal: member vote list, "I'm In" / "Pass" buttons, multi-place navigation
- Vote consensus row on place cards (overlapping avatars + "3/5 yes")
- "Recommend to Group" button on place cards in Places and Saved tabs
- Dedicated Group Voting section at top of Saved tab (Needs your vote / Decided)
- Empty states: solo traveler prompt, all caught up, no places to vote on
- Realtime vote updates across devices via `useVoteSubscription` hook

### Rock Paper Scissors Tiebreaker
- "Can't decide? Settle it!" button appears on tied group votes
- Each member picks rock/paper/scissors with realtime waiting state
- Winner's vote decides the place (Going / Skipped)
- Staggered reveal animation showing all moves + winner highlight
- Rematch support, auto-reset on RPS ties
- Fixed consensus bias on even splits (2v2 no longer defaults to Yes)

### Transport Onboarding
- New step 3 of 4: "How are you getting there?" (Plane / Car / Bus / Ferry / Not sure)
- Auto-infers "plane" from uploaded flight bookings
- Feature gating based on transport mode:
  - Flight cards, boarding nudges hidden for car/bus/ferry
  - Discover distance mode defaults to car for car/bus travelers
  - Nearby radius expanded from 2km to 10km for car travelers
  - FAB hides "Plan Trip" for non-plane transport

### Push Notifications
- Firebase Cloud Messaging (FCM) integrated for Android
- `usePushNotifications` hook wired in root layout
- Supabase edge function (`send-push-notification`) deployed with DB trigger
- 7 notification types: trip lifecycle, departure, check-in/out, budget, expense, group activity, packing
- Transport-aware: flight boarding (plane only), departure prep (car/bus/ferry only)
- Group-aware: expense alerts, vote needed, member joined (2+ members only)
- Notification preferences UI in Settings (7 toggles with descriptions)
- Preferences synced to Supabase `profiles.notification_prefs` for edge function filtering
- Deep link routing: each notification type opens the correct screen

### Google Sign-In
- Unified all OAuth credentials under Firebase project (704335704962)
- Android OAuth client registered with SHA-1 fingerprint
- `GoogleSignin.revokeAccess()` on sign out — account picker shows on re-login
- Supabase Auth configured with matching Web Client ID + Secret

### Curation Gestures
- Swipe up (favorite) / swipe down (skip) in CurationLightbox
- Same gestures added to MomentLightbox (single photo viewer)
- Gesture overlay above FlatList to avoid touch conflicts
- `activeOffsetY` + `failOffsetX` for precise gesture activation
- `GestureHandlerRootView` wraps Modal content for Android compatibility

### Trip Options Menu
- Custom themed bottom sheet replaces generic `Alert.alert()`
- Edit Trip Details → routes to `/trip-overview` (was incorrectly going to `/onboarding`)
- Finish Trip → confirmation + generates Trip Memory
- Archive Trip → destructive confirmation + moves to past trips
- Each option has icon, title, subtitle matching app design system

### HD Photos
- HD photo upload pipeline with disk-cached thumbnails
- Quality chooser toggle in lightbox

### UX & Empty States
- ProfileRow visible on empty home screen (new users can access settings/sign out)
- User name resolved from auth metadata when no trip exists
- Android notification icon (white-on-transparent AfterStay logo)
- Notification channel configured with brand accent color (#d8ab7a)

### Infrastructure
- `vote_by_member` JSONB column added to places table
- `rps_game_state` JSONB column added to places table
- `notification_prefs` JSONB column added to profiles table
- INSERT RLS policy added to notifications table
- `pg_net` extension enabled for DB webhook triggers
- Notification type check constraint expanded with new types
- `trip-lifecycle-notifications` edge function (cron) for scheduled alerts
- Expo Go compatibility: dynamic import for expo-notifications

---

## [1.2.0] — 2026-04-21

### Features
- UI/UX audit fixes — dark mode, dynamic data, imports cleanup
- Home tab gentle nudge cards for empty sections
- Remove all hardcoded Boracay/Peter/Canyon references
- Multi-user safety — each user sees only their own data
- Upgrade to Expo SDK 55

---

## [1.1.0] — 2026-04-19

- Initial release with Supabase migration
- Trip dashboard, discover, budget, moments, packing
- Anthropic AI integration (recommendations, itinerary, receipt scan)
- Google Places API integration
