# Live Cache Verification Standard

Use this before claiming an MVP flow is fixed or production-ready.

## Done Means

A flow is not done until live testing proves all three layers:

1. **DB truth**
   - The create/update/delete row exists in Supabase with the expected user and scope.
   - RLS still hides it from unrelated users.

2. **Cache invalidation**
   - The write path invalidates related in-memory and persisted caches.
   - A forced refresh bypasses stale cached promises.

3. **UI rehydration**
   - The screen updates after navigation away/back.
   - The data survives force-close/reopen.
   - Pull-to-refresh fetches network truth, not stale memory.

## MVP Modules To Check

- Auth, profile, onboarding
- Home active trip and no-trip state
- Quick Trips
- Moments grid, viewer, upload
- Discover, Explore Moments, Saved Ideas
- Budget: normal, quick-trip, trip, shared trip expenses
- Receipt scan and receipt split handoff
- My Trips and Essentials
- Invites and shared trip membership
- Notifications

## Required QA Report

For every fixed flow, report:

- Device tested: Android, iOS, or both
- Account tested
- Action performed
- Supabase row/table verified
- Cache invalidation path verified
- UI proof after navigation or restart
- Remaining blockers

If any layer cannot be verified, say **not fully live-validated**.
