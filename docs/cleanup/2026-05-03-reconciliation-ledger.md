# AfterStay Cleanup Reconciliation Ledger

Date: 2026-05-03

## Release Rule

Freeze remains active. No feature work, OTA publish, migration, stash drop, or deploy should happen from the shared `otas` worktree until this reconciliation branch is verified.

Clean source of truth:

- Worktree: `/Users/peterkarlgumapac/.config/superpowers/worktrees/afterstay-travel/reconciliation-clean-baseline`
- Branch: `cleanup/reconciliation-clean-baseline`
- Baseline commit: `436fb4a fix auth network recovery`
- Main shared repo: `/Users/peterkarlgumapac/afterstay-travel`
- Shipped-fix reference only: `/tmp/afterstay-ota-pushfix`

## Current Source State

Keep:

- `436fb4a fix auth network recovery`
- `effa9f7 fix: tighten profile visual polish`

Park:

- `/Users/peterkarlgumapac/afterstay-travel/app/(tabs)/discover.tsx`
  - Agent 1 Discover simplification is local-only and should not be included in the stabilization baseline until separately reviewed.

Do not touch:

- Existing git stashes in `/Users/peterkarlgumapac/afterstay-travel`
- Temporary OTA worktrees except as read-only references

## Live OTA Drift

Production latest:

- Android only: `Tighten profile visual polish`
- Group: `ab9122a7-60bf-4511-96c2-e65464cb0671`
- Risk: Android is newer than iOS, so platform parity is broken.

Preview latest:

- Android only: `Tighten profile visual polish`
- Group: `8132cfc1-3693-42b2-9129-a00af9cf2213`
- Risk: preview also lacks matching iOS update.

Previous shared Android+iOS stabilization OTAs:

- `Show public moments on profiles`
  - Production: `6ea63264-0ca7-499b-976d-366483276060`
  - Preview: `ca3f9f49-28fb-43f6-9999-dbd9e3eb46e0`
- `Clean up profile navigation`
  - Production: `87db588e-c754-4ba8-a022-d314292a1757`
  - Preview: `ca1ef2cb-5032-4ff2-a093-e7750a26df57`
- `Show clearer loading step progress`
  - Production: `851942c7-d996-44b6-b393-458365ac6141`
  - Preview: `5b254f93-9ee2-468f-b19e-983f5cc0a991`

Next OTA must be a single Android+iOS publish from this clean reconciliation branch after checks pass.

## Candidate Stabilization Work To Reconcile

From `/tmp/afterstay-ota-pushfix`, port only reviewed stabilization changes:

- Media upload reliability
  - Moment upload destinations must not spin forever.
  - Trip Album upload must handle storage upload fallbacks.
  - Public Explore upload must create the intended public post/media rows.
  - Essentials files must upload to private `trip-files` storage and refresh after returning.
- Invite and companion safety
  - Pending invite should survive auth.
  - Join by code should prefer the backend RPC when available.
  - Invite/admin UI should not imply non-admin capabilities.
- Profile navigation and public moments
  - Public feed posts should open the author profile.
  - Public profile moments should be visible without regressing profile polish.
- Loading and tab switching
  - Avoid loading inactive tab data.
  - Use scoped pull-to-refresh per visible tab.
  - Keep stale content visible while refreshing.
  - Add visible loading stage text for app boot, scan, upload, and essentials file actions.
- Checklist and hero polish
  - Checklist hide/collapse state must hydrate before showing.
  - Hero image should always render a styled fallback behind remote images.
- Notification registration
  - Token save should support Firebase-first registration with Expo fallback where available.

Do not port:

- Agent 1's large Discover simplification until after baseline stabilization.
- FPS logger instrumentation unless needed for a focused performance branch.
- New profile UI expansion beyond reconciling already-shipped profile polish.

## Backend State To Verify Before OTA

Known user-applied migrations from this session:

- `20260501_handle_availability_rpc.sql`
- `20260502_group_invite_admin_fixes.sql`
- `20260502_moments_upload_write_policies.sql`
- `20260502_replace_trip_flights_rpc.sql`
- `20260502_media_storage_stabilization.sql`
- `20260502_replace_trip_flights_rpc_v2.sql`
- `20260503_companion_link_update_trigger.sql`
- Profile onboarding/profile/push-token migrations reported by the user

Still needs explicit verification before the clean OTA:

- `moments` bucket exists and is public. Verified 2026-05-03.
- `trip-files` bucket exists and is private. Verified 2026-05-03.
- `trip_files` metadata columns exist: `storage_path`, `content_type`, `size_bytes`, `uploaded_by`. Verified 2026-05-03.
- Write policies exist for `moments`, `personal_photos`, `feed_posts`, `post_media`, and `trip_files`. Verified 2026-05-03.
- Storage object policies exist for `trip-files` storage. Verified 2026-05-03.
- Functions exist and are executable by authenticated users. Verified 2026-05-03:
  - `replace_trip_flights_from_scan`
  - `upsert_own_profile`
  - `update_own_onboarding_state`
  - `is_handle_available`
  - `save_own_push_tokens`
  - `search_public_profiles`
  - `get_public_profiles`
  - `get_public_profile_posts`
  - `join_trip_by_invite_code`

Backend cleanup watchlist:

- `upsert_own_profile` currently has both the original 5-argument overload and the newer cover-photo overload. Keep both until old OTA clients are no longer expected, then remove the old overload in a separate reviewed migration.
- Storage still has older `moments` bucket policies alongside newer scoped policies. They are not blocking the clean OTA, but should be audited separately before any destructive cleanup.

Backend verification attempt from this worktree:

- `npx supabase db query "select current_date as today;" --linked --workdir /Users/peterkarlgumapac/afterstay-travel`
  - Result: blocked by Supabase CLI 401 login-role error, requiring `SUPABASE_DB_PASSWORD`.
- Supabase Management API with local `SUPABASE_ACCESS_TOKEN`
  - Result: blocked with HTTP 401 Unauthorized.
- Supabase SQL Editor live apply, 2026-05-03:
  - `supabase/migrations/20260503_invite_join_rpc_hardening.sql`
  - Result: `Success. No rows returned`.
  - Local migration was patched before apply to also drop stale broad `trip_invites_select` and `trip_invites_insert` policies.
- Supabase SQL Editor live policy verification, 2026-05-03:
  - `group_members_insert` is now admin-only: `auth.uid() is not null and is_trip_admin(trip_id, auth.uid())`.
  - `trip_invites_delete_admin`, `trip_invites_insert_admin`, `trip_invites_select_admin`, and `trip_invites_update_admin` are present.
  - Old broad `trip_invites_select`, old broad `trip_invites_insert`, and `trips_select_via_invite` did not appear in the verification result.
- Supabase direct DB read-only verification, 2026-05-03:
  - `join_trip_by_invite_code` exists with arguments `p_code text, p_name text DEFAULT NULL::text`.
  - `authenticated_can_execute` returned `true`.
- Supabase direct DB consolidated read-only verification, 2026-05-03:
  - All backend checklist rows returned `ok = true`.
  - Verified `moments` public bucket, `trip-files` private bucket, `trip_files` metadata columns, insert policies for media/file tables, `trip-files` storage policies, and authenticated execute grants for required functions.

New backend file in this clean branch, already applied live:

- `supabase/migrations/20260503_invite_join_rpc_hardening.sql`
  - Creates `join_trip_by_invite_code(text, text)`.
  - Restricts direct `group_members` inserts to trip admins.
  - Makes invite rows admin-managed.
  - Drops stale broad reusable-invite read/write policies that survived the first draft.
- `supabase/verification/20260503_invite_join_rpc_verification.sql`
  - Read-only confirmation for the RPC and policies.

## Stabilization Batch Ported

- Media upload reliability:
  - `lib/supabase.ts`
  - `lib/moments/exploreMomentsService.ts`
  - `app/add-moment.tsx`
- Essentials reliability and scoped refresh:
  - `app/(tabs)/trip.tsx`
  - `components/trip/EssentialsTab.tsx`
- Invite/admin cleanup:
  - `lib/pendingInvite.ts`
  - `lib/tripPermissions.ts`
  - `lib/auth.ts`
  - `app/auth/login.tsx`
  - `app/invite.tsx`
  - `app/add-member.tsx`
  - `components/trip/OverviewTab.tsx`
- Loading/performance polish:
  - `components/AfterStayLoader.tsx`
  - `hooks/useHomeScreen.ts`
  - `app/(tabs)/discover.tsx`
  - `components/discover/TopPicksSection.tsx`
  - `components/discover/ExploreStoryRow.tsx`
  - `components/home/AnticipationHero.tsx`
  - `components/home/TripReadinessCard.tsx`
- Push registration:
  - `lib/pushRegistration.ts`
  - `hooks/usePushNotifications.ts`
  - `app/notification-settings.tsx`

## Verification Run

- `npx tsc --noEmit --pretty false`
  - Result: exit 0.
- Targeted ESLint on changed files
  - Result: exit 0 with warnings only. Warnings are existing import-order/unused-hook-dep noise in large tab files; no errors.
- `npx jest --runTestsByPath lib/__tests__/base64.test.ts lib/__tests__/discoverPlaceFilters.test.ts lib/__tests__/wishlist.test.ts --runInBand`
  - Result: 3 suites passed, 13 tests passed.
- `git diff --check`
  - Result: exit 0.
- `npx expo export --platform android --output-dir /tmp/afterstay-reconciliation-android`
  - Result: exported Android JS bundle successfully.
- `npx expo export --platform ios --output-dir /tmp/afterstay-reconciliation-ios`
  - Result: exported iOS JS bundle successfully.

ADB snapshot:

- Device: `emulator-5554`, package `com.afterstay.travel`, version `1.3.0`.
- Launch did not show a native crash.
- Current installed app surfaced a dev LogBox toast from `ExploreStoryRow` story timeout. The clean branch downgrades that recoverable optional-story failure from `console.error` to a quiet dev log.

## Agent Resume Rules

- Use a named worktree for any further work.
- Do not edit `/Users/peterkarlgumapac/afterstay-travel` directly during the freeze.
- Do not drop or pop stashes.
- Do not publish OTA or deploy Edge Functions without the reconciliation branch passing checks.
- Handoff must list exact files changed, commands run, migrations touched, and remaining risks.
- Run at minimum:
  - `npx tsc --noEmit`
  - targeted ESLint for changed files
  - relevant Jest tests
  - `git diff --check`

## Release Gates

Local:

- TypeScript passes.
- Targeted lint passes.
- Targeted tests pass.
- Diff check passes.

QA:

- New user login and handle gate.
- Google login, logout, and account switch.
- No cross-account cache bleed.
- Round-trip scan creates outbound and return flights.
- Personal Album, Trip Album, and Public Explore uploads complete or show useful errors.
- Essentials upload opens preview or a clear unavailable state.
- Invite link/code joins the correct trip and shows shared trip context.
- Profile search and public profile moments open correctly.
- Home, Discover, Moments, Budget, and My Trips switch without full-app reload behavior.
