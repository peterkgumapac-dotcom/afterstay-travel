# AfterStay Travel Product Requirements Document

**Status:** Draft for product and engineering alignment

**Product:** AfterStay Travel

**Repository:** `peterkgumapac-dotcom/afterstay-travel`

**Current implementation reference:** `package.json` version `1.3.0` and the current Expo/React Native codebase
**Document owner:** AfterStay product team

> This PRD describes the product represented by the current repository and the requirements needed to make it a reliable, launchable travel workspace. Items marked **Proposed**, **Target**, or **Open** are not claims that the behavior is already shipped.

## 1. Executive Summary

AfterStay Travel is a mobile travel operating system for people planning, taking, and remembering trips with other people. It brings trip logistics, bookings, flights, places, packing, shared expenses, group decisions, photos, and post-trip memories into one persistent workspace instead of scattering them across booking apps, messages, screenshots, notes, and spreadsheets.

The product should help a traveler reach a useful first state quickly: create or import a trip, see what matters next, and give companions a shared place to coordinate. During the trip, it should reduce operational friction through live logistics, local discovery, budget visibility, and lightweight collaboration. After the trip, it should turn captured moments and trip data into a durable memory that encourages the traveler to return for the next trip.

## 2. Product Principles

1. **One trip workspace, not another inbox.** The product should make the next useful action obvious without requiring the traveler to search through a feed.
2. **Useful before beautiful.** Editorial visuals and motion should support comprehension, confidence, and memory—not hide critical dates, amounts, or actions.
3. **Group-aware by default.** Shared decisions, expenses, files, and moments must make ownership and visibility clear.
4. **Progressive capture.** A traveler may start with a destination, quick trip, or partial booking and enrich the trip later.
5. **Trust the latest verified data.** Fresh server state, cache state, and optimistic UI state must be distinguishable during sync and recovery.
6. **Private by default.** Personal travel data, receipts, files, location, and private moments must not become public through accidental defaults.

## 3. Problem Statement

### Who has the problem?

- Solo travelers who need a simple place to organize a trip without building a spreadsheet.
- Friends, couples, and families coordinating a shared trip across different devices and time zones.
- The trip organizer who carries the burden of dates, bookings, places, payments, and reminders.
- Returning travelers who want useful memories and travel history rather than a forgotten folder of photos.

### What is the problem?

Travel information is fragmented across booking confirmations, email, chat threads, maps, camera rolls, expense apps, and separate notes. The traveler must repeatedly reconstruct the same context: where the group is staying, what happens next, who has paid, which place everyone agreed on, and where the important files are.

### Why is it painful?

- Important logistics are difficult to find at the moment they matter.
- Group decisions are slow or become biased toward the loudest participant.
- Shared expenses create uncertainty and awkward manual reconciliation.
- Photos and notes are captured separately from the trip context that gives them meaning.
- Travelers may lose trust when stale cached data looks like current truth.

### Evidence available in the repository

The current implementation already models the problem through:

- Trip lifecycle states: `Planning`, `Active`, and `Completed`.
- Trips, flights, members, packing items, checklists, files, places, expenses, moments, albums, profiles, notifications, and travel statistics in `lib/types.ts`.
- Home, Moments, Discover, Budget, and My Trips tabs in `app/(tabs)/_layout.tsx`.
- Booking/itinerary scanning, manual trip creation, group invites, group chat, local discovery, shared place voting, expense splitting, receipt scanning, photo uploads, albums, trip memories, and profile statistics.
- Supabase-backed authentication, Postgres data, storage, realtime subscriptions, and edge-function integrations.
- A live-cache verification standard in `docs/qa-live-cache-verification.md` requiring database truth, cache invalidation, and UI rehydration proof.

This is repository evidence, not a substitute for customer interviews or production analytics. User research and baseline metrics remain open work.

## 4. Target Users and Jobs To Be Done

### Primary persona: Trip organizer

**Role:** The person who starts the trip, gathers booking information, invites companions, and keeps the group moving.

**Goals:**

- Create a usable trip workspace in minutes.
- Import or enter booking details without retyping everything.
- Give companions the right information without forwarding multiple messages.
- Get the group to decisions and cleanly settle shared costs.

**Pain points:**

- Becomes the human source of truth for the group.
- Needs high confidence that dates, files, amounts, and decisions are current.
- Has little patience for setup before a trip.

### Secondary persona: Participating companion

**Role:** A traveler invited to an existing trip.

**Goals:**

- Join with minimal friction.
- See what they need to know and contribute decisions, expenses, and moments.
- Understand what is shared, private, pending, or settled.

**Pain points:**

- Does not want to manage the whole itinerary.
- May use the app intermittently and needs strong re-entry points.
- Needs clear permissions around shared files, photos, and spending.

### Secondary persona: Solo traveler

**Role:** A traveler who wants planning, local discovery, spending, and memories without group complexity.

**Goals:**

- Explore a destination before a formal trip exists.
- Save places and create a lightweight trip or quick trip.
- Capture and revisit memories with low effort.

### Job stories

- **When I have a booking confirmation,** I want to scan or add it once, **so that** the trip workspace starts with the right dates and logistics.
- **When a trip is approaching,** I want the home screen to show the next important action, **so that** I do not need to inspect every section.
- **When my group is deciding where to go,** I want structured recommendations and votes, **so that** we can reach a decision without a long chat thread.
- **When someone pays for the group,** I want the expense and split recorded immediately, **so that** nobody has to reconstruct the debt later.
- **When I take a photo,** I want it attached to the right trip and visibility setting, **so that** it becomes part of a shared memory without losing privacy.
- **When a trip is over,** I want a useful recap, **so that** the trip remains valuable after the final checkout.

## 5. Strategic Context

### Product opportunity

AfterStay Travel can own the space between trip planning, in-trip coordination, and post-trip memory. Its differentiation is not merely a checklist or photo gallery; it is the combination of operational context, group coordination, spending, discovery, and memory in one travel object.

### Business goals

The following goals are proposed and require confirmation against the commercial model:

1. Increase the number of travelers who create a trip workspace and reach a first useful action.
2. Increase group participation by making invites, votes, expenses, and moments easy to contribute to.
3. Increase repeat usage by making completed trips and memories valuable after travel ends.
4. Build a trustworthy product foundation that can support premium trip features or partnerships later.

### Why now

The core product surface is already broad. The highest-leverage next step is reliability and coherence across the lifecycle, not adding more disconnected modules. The Supabase migration, cache behavior, AI security, and launch QA need to be treated as product requirements because they directly affect user trust.

### Reference product framing

The public reference at [travel.afterstay.org](https://travel.afterstay.org/) presents AfterStay as a five-step promise:

1. Organize a trip from screenshots, PDFs, or booking confirmations.
2. Scan receipts, split bills, and track spending.
3. Discover places and browse travel moments.
4. Capture memories in shared group albums.
5. Save the journey as an automatically generated trip summary.

This framing is useful for positioning and sequencing, but the app repository remains the authority for functional requirements. The reference site also contains waitlist, app-store, testimonial, and marketing-count content; those are not app capabilities or acceptance criteria. The mapping below is the intended product alignment:

| Reference promise      | App functionality to rely on                                                                     | Evidence in repository                                                                                                                      | Qualification                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Organize your trip     | Booking/itinerary scan, manual trip creation, trip overview, flights, files, packing             | `app/scan-trip.tsx`, `app/onboarding.tsx`, `app/trip-overview.tsx`, `lib/supabase.ts`                                                       | Extraction and persistence still require end-to-end live QA                      |
| Budget and split bills | Receipt scan, trip/personal budget, expense splits, balances, settlement helpers                 | `app/scan-receipt.tsx`, `app/(tabs)/budget/*`, `lib/supabase.ts`                                                                            | Payment completion must not be implied by a recorded settlement action           |
| Discover and explore   | Place search, filters, saved places, stays, Explore Moments, group voting, AI concierge surfaces | `app/(tabs)/discover.tsx`, `components/discover/*`                                                                                          | Community moderation and public-content policy remain open                       |
| Capture memories       | Moments upload/editing, visibility, albums, favorites, highlights                                | `app/(tabs)/moments.tsx`, `components/moments/*`, `lib/supabase.ts`                                                                         | Media upload, privacy, and restart persistence are P0 release gates              |
| Save your journey      | Trip summary, trip memory, recap/wrapped views, profile travel statistics                        | `app/trip-summary.tsx`, `app/trip-memory.tsx`, `app/trip-recap.tsx`, `app/trip-wrapped.tsx`, `components/summary/*`, `components/wrapped/*` | Recap quality depends on verified source data and graceful missing-data handling |

The reference site should therefore guide the product narrative and lifecycle order, while unsupported marketing claims—such as a fixed number of moments, store availability, or a waitlist conversion flow—must not be treated as shipped behavior.

## 6. Solution Overview

AfterStay Travel should be organized around a single trip workspace with lifecycle-aware navigation.

### Core lifecycle

```text
Discover or receive booking
        ↓
Create / import trip
        ↓
Invite companions and fill logistics
        ↓
Plan: places, files, flights, packing, budget
        ↓
Travel: next actions, guide, live coordination, expenses, moments
        ↓
Complete: settle, recap, memories, profile statistics
        ↓
Return: use history and saved ideas to start the next trip
```

### Primary navigation

| Surface  | User value                                                        | Current repository evidence                                            |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Home     | Lifecycle-aware next actions and trip snapshot                    | `app/(tabs)/home.tsx`, `components/home/*`                             |
| Moments  | Capture, edit, organize, and revisit trip media                   | `app/(tabs)/moments.tsx`, `components/moments/*`                       |
| Discover | Find places, stays, recommendations, and travel moments           | `app/(tabs)/discover.tsx`, `components/discover/*`                     |
| Budget   | Track personal/trip spending, splits, and settlement              | `app/(tabs)/budget/index.tsx`, `app/(tabs)/budget/settle-balances.tsx` |
| My Trips | Browse active, planning, completed, and archived trips            | `app/(tabs)/trip.tsx`, `components/trip/*`, `components/summary/*`     |
| Guide    | Surface stay details and arrival information when a trip has them | `app/(tabs)/guide.tsx`                                                 |

### Core data object

The product object model is:

```text
User / Profile
  ├── Active, planning, completed, or archived Trips
  │     ├── Members and permissions
  │     ├── Flights and transport context
  │     ├── Hotel / stay guide and checklist
  │     ├── Packing items and files
  │     ├── Places, saved ideas, and group votes
  │     ├── Expenses, splits, balances, and payment QR codes
  │     ├── Moments, albums, comments, and visibility
  │     └── Trip memory / recap
  ├── Quick Trips and wishlist items
  ├── Notifications and preferences
  └── Public/private travel profile and lifetime stats
```

## 7. Product Requirements

Priority definitions:

- **P0:** Required for a trustworthy MVP / release gate.
- **P1:** Important for the first meaningful growth iteration.
- **P2:** Valuable expansion after the core lifecycle is reliable.

### 7.1 Authentication, account, and privacy

**AUTH-01 — P0: Sign in and restore session**

- Support the configured authentication methods and restore the user session on app launch.
- Show a loading state while auth and profile state are resolved.
- Never display another account’s cached profile, trip, discover, budget, or moments data during account switching.

**AUTH-02 — P0: User-scoped data access**

- All private rows and storage objects must be protected by Supabase RLS and user/trip membership rules.
- A user can only edit their own profile, moments, expenses, and membership preferences, subject to trip permissions.
- Public profile and public moments must be an explicit visibility state, not a side effect of sharing to a trip.

**AUTH-03 — P0: Complete profile setup**

- Ask for the minimum identity fields needed to display the user and support invites.
- Provide handle/profile completion without blocking basic trip creation longer than necessary.
- Make sign-out and account state visible even when a user has no trip.

**AUTH-04 — P1: Account lifecycle controls**

- Define export, deletion, and recovery behavior before public launch.
- Clarify retention and deletion behavior for shared photos, files, comments, expenses, and trip memberships.

### 7.2 Onboarding and trip creation

**TRIP-01 — P0: Create a trip manually**

- A user can create a trip with destination, start date, end date, and transport mode.
- Dates must use the product’s canonical timezone/date utilities and must not shift across iOS and Android.
- New trips begin in a clear planning state and appear in Home and My Trips after successful persistence.

**TRIP-02 — P0: Import a booking or itinerary**

- A user can scan or upload supported booking content and review extracted fields before saving.
- The user must be able to correct extracted values before they become trip truth.
- Extraction failure must preserve the user’s draft and provide a manual fallback.

**TRIP-03 — P1: Quick trip / lightweight planning**

- A user can save a destination, dates, companions, photos, and expenses without completing a full itinerary.
- Quick trips must remain distinguishable from full trips while still appearing in relevant Moments, Budget, and Discover contexts.

**TRIP-04 — P0: Invite and join**

- A trip owner can create and share an invite code or link.
- A recipient can join after authentication and see the correct trip context.
- Joining must not expose private data from unrelated trips or the inviter’s account.

### 7.3 Home and lifecycle guidance

**HOME-01 — P0: Lifecycle-aware dashboard**

- Home adapts to new, planning, active, returning, and completed-trip states.
- The highest-priority next action is visible without opening several nested screens.
- Examples include adding a booking, inviting a companion, adding a flight, completing packing, checking a guide, or reviewing a budget.

**HOME-02 — P0: Reliable loading and recovery**

- Render cached state quickly when available, then reconcile with fresh server state.
- Show whether data is loading, stale, offline, or failed when the distinction matters.
- Pull-to-refresh must request network truth and update the visible screen.

**HOME-03 — P1: Smart nudges**

- Nudges must be based on actual missing or upcoming trip data, not static sample content.
- A dismissed nudge must not immediately reappear unless its underlying condition changes.

### 7.4 Trip workspace and logistics

**LOGISTICS-01 — P0: Trip overview**

- Show trip dates, destination, stay details, members, flights/transport, packing, checklist, saved places, expenses, and files through a coherent overview.
- Support editing of allowed trip properties with visible save/error feedback.

**LOGISTICS-02 — P0: Flights and transport-aware guidance**

- Support flight records with direction, carrier, flight number, airports, departure, and arrival times.
- Transport mode controls whether flight-specific cards and boarding nudges are shown.
- Dates and times must render consistently in the product timezone policy.

**LOGISTICS-03 — P0: Essentials and files**

- Store and preview supported files such as boarding passes, hotel confirmations, itineraries, insurance, identity documents, and receipts.
- Use expiring or authenticated preview URLs for private storage objects.
- File deletion and replacement must be explicit and recoverable where practical.

**LOGISTICS-04 — P1: Guide**

- Surface check-in/out, Wi-Fi, door code, booking reference, amenities, contacts, location, house rules, and notes when present.
- Sensitive stay details must only be visible to authorized trip members.

### 7.5 Discover and group decisions

**DISCOVER-01 — P0: Search and browse places**

- Search by destination/origin and category, with place details, distance, rating, and relevant metadata.
- Support hotel or current-location origin and travel-mode-aware radius behavior.
- Handle no location, no trip, API failure, and incomplete place data gracefully.

**DISCOVER-02 — P0: Save places and ideas**

- Save a place to the current trip or to a personal wishlist when no full trip exists.
- Saved state must remain correct after navigation, refresh, force-close, and account switching.

**DISCOVER-03 — P1: Recommend and vote as a group**

- A member can recommend a place to a trip group.
- Each eligible member can vote independently.
- The UI must show pending, decided, and participation state without treating an incomplete vote as consensus.

**DISCOVER-04 — P1: Tie resolution**

- When a configured group vote is tied, members can use the supported Rock Paper Scissors tiebreaker.
- Realtime waiting, winner reveal, rematch, and reset behavior must be deterministic and scoped to the place.

**DISCOVER-05 — P2: AI concierge and social discovery**

- Concierge recommendations must use explicit destination, timing, group, and preference inputs.
- Explore moments, comments, follows, stories, and public posts must have clear moderation, privacy, reporting, and abuse-handling rules before broad release.

### 7.6 Budget and expense coordination

**BUDGET-01 — P0: Record expenses**

- Add, edit, delete, and categorize personal or trip expenses.
- Store amount, currency, date, description, payer, and trip/quick-trip scope.
- Currency display must be explicit and must not silently convert amounts without showing the source and target currencies.

**BUDGET-02 — P0: Receipt capture and review**

- A user can attach or scan a receipt and review extracted data before saving.
- OCR/AI failure must not create a false expense or destroy the original receipt.

**BUDGET-03 — P0: Splits and balances**

- Split shared expenses among eligible members and show who owes whom.
- Support partial settlement and prevent duplicate settlement actions.
- The same expense must not be counted twice in trip totals, personal totals, or settlement balances.

**BUDGET-04 — P1: Settlement helpers**

- Provide payment QR storage/generation where supported, without claiming that an external payment was completed.
- Clearly distinguish recorded, unsettled, settled, failed, and unknown payment states.

**BUDGET-05 — P1: Budget guidance**

- Support trip budget mode, optional limit, progress, daily tracker, savings goal, and threshold notifications.
- Empty and zero-spend states should be useful and should not imply a data error.

### 7.7 Moments, albums, and memories

**MOMENTS-01 — P0: Capture and upload**

- Add photos or supported media to a trip or quick trip.
- Use a memory-safe upload path with progress, retry, and useful error messages.
- Preserve the local item if an upload fails.

**MOMENTS-02 — P0: Organize and control visibility**

- Support tags, captions, favorites, deletion, batch actions, and visibility states such as private, shared, album, and public.
- Visibility changes must be confirmed by server state and reflected after navigation/restart.

**MOMENTS-03 — P1: Albums and group highlights**

- Create albums with owner/member roles and add moments without duplicating media rows.
- Support shared highlights and a clear pending/unviewed state where enabled.

**MOMENTS-04 — P1: Recaps and trip memories**

- Generate a recap from verified trip data, including selected places, moments, flights, expenses, and highlights.
- A generated recap is a draft until the user saves it.
- Recaps must degrade gracefully when one data source is missing.

### 7.8 Notifications, collaboration, and profiles

**COLLAB-01 — P0: In-trip communication**

- Support group chat scoped to a trip.
- Messages and realtime updates must not cross trip boundaries.

**COLLAB-02 — P0: Notifications**

- Support configured notification types for trip lifecycle, departure, check-in/out, budget, expenses, group activity, and packing.
- Let users control notification preferences.
- Deep links must open the correct trip or action and handle deleted/archived content safely.

**PROFILE-01 — P1: Travel profile**

- Show lifetime stats, visited countries/places, trips, highlights, and selected public moments where permitted.
- Make profile privacy and companion relationships explicit.

**PROFILE-02 — P2: Sharing**

- Allow a user to share travel stats or a profile artifact only after previewing the exact content and visibility.

### 7.9 Reliability, cache, and offline behavior

**PLATFORM-01 — P0: Cache correctness**

- Every write path must invalidate related in-memory and persisted caches.
- Account-scoped cache keys must include the active user identity.
- A forced refresh must bypass stale cached promises.

**PLATFORM-02 — P0: Offline mutation handling**

- Queue safe writes made while offline and replay them once connectivity returns.
- Replay must be idempotent or deduplicated.
- The UI must show pending/offline state rather than claiming the server has saved the change.

**PLATFORM-03 — P0: Observability**

- Capture production crashes and relevant performance failures without logging secrets, receipt contents, access codes, or private media URLs.
- Include enough context to distinguish auth, RLS, storage, API, cache, and UI failures.

## 8. Non-Functional Requirements

### Performance

- Cold start should render the first meaningful screen from cached state where available, then reconcile in the background.
- User actions should provide immediate feedback and avoid blocking the whole screen for independent data requests.
- Large photo lists should use virtualization, thumbnails, and bounded memory usage.
- Search and place results should be debounced and paginated.

### Accessibility and usability

- All actionable controls need accessible labels and states.
- Text must remain readable with dynamic type and smaller screens.
- Critical actions must not depend on color alone or gesture discovery alone.
- Loading, empty, offline, error, and success states must be designed for every primary surface.

### Security and privacy

- Enforce RLS for every user- or trip-scoped table.
- Keep AI provider credentials off the client before production launch.
- Keep private storage objects private and use scoped preview URLs.
- Minimize location retention and explain when location is used for discovery.
- Define data export, deletion, and shared-data retention policies.

### Compatibility

- Support iOS and Android as first-class targets.
- Verify platform-sensitive date, file, photo, notification, camera, calendar, and location behavior on both platforms before release.
- Native build/signing and Expo configuration must be reproducible outside one developer machine.

## 9. Success Metrics

Production baselines must be established before committing to final targets. The following are proposed launch metrics.

| Metric                      | Definition                                                                                       | Proposed initial target                          |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| First useful trip action    | New authenticated user creates/imports a trip, quick trip, or saved destination in first session | 70%+                                             |
| Time to first useful state  | Median time from completed auth to a visible trip/destination workspace                          | Under 3 minutes                                  |
| Trip workspace completeness | Active trips with destination plus at least one logistics object or companion action             | 60%+                                             |
| Group participation         | Invited trips with at least one companion contribution beyond joining                            | 60%+                                             |
| Decision completion         | Recommended places that reach a decided state within 24 hours                                    | 70%+ where group voting is used                  |
| Expense resolution          | Shared expenses marked settled or intentionally unresolved before trip archive                   | 80%+                                             |
| Memory capture              | Completed trips with at least one moment, album, or saved recap                                  | 60%+                                             |
| Returning use               | Users who start or update another trip within 90 days of completion                              | Establish baseline; improve quarter over quarter |
| Reliability                 | Primary writes that survive refresh/restart with correct user/trip scope                         | 99%+ in release QA                               |

### Guardrail metrics

- Crash-free sessions and fatal error rate.
- Auth failure rate.
- RLS/storage permission failures.
- Upload failure and retry rate.
- Stale-data reports after account switching.
- Notification opt-out rate and deep-link failure rate.
- AI cost per active user and provider error rate.

## 10. Acceptance and Release Gates

No core flow is considered complete from a passing unit test or successful write alone. The release checklist must verify:

1. **Database truth:** the expected Supabase row/storage object exists with the correct user and trip scope.
2. **Cache invalidation:** the write invalidates related memory and persisted caches.
3. **UI rehydration:** the change is visible after navigation away/back, pull-to-refresh, and force-close/reopen.
4. **Permission boundary:** an unrelated user cannot read or mutate the data.
5. **Failure path:** offline, timeout, malformed input, and provider failure states preserve user work and do not claim success.
6. **Platform coverage:** critical flows are checked on both iOS and Android, or the release explicitly records the unverified platform.

### P0 release journeys

- New user sign-in → profile setup → manual trip creation.
- New user sign-in → booking scan/upload → review → saved trip.
- Invite → authenticate → join trip → see only authorized trip data.
- Add flight/file/packing item → refresh/restart → data remains correct.
- Search place → save → recommend → group vote → decision.
- Add expense → split → settle/unsettle → balances remain correct.
- Upload moment → change visibility → view from authorized account.
- Complete trip → generate/save memory → view from My Trips/profile.
- Trigger notification → open deep link → land on correct scoped screen.

## 11. Technical Architecture and Dependencies

### Current implementation direction

- **Client:** Expo, React Native, React, TypeScript, Expo Router, React Navigation, Reanimated, Skia, and native Expo modules.
- **Backend:** Supabase Auth, Postgres, Storage, Realtime, and Edge Functions.
- **External services:** Google Places, weather provider, Anthropic AI, Firebase/FCM notification infrastructure, and device calendar/sharing APIs where configured.
- **Persistence:** Supabase server state, AsyncStorage-backed cache, and an offline mutation queue.
- **Quality:** Jest/jest-expo, TypeScript, ESLint, Expo export, and live device QA.

### Dependencies

- Supabase schema, migrations, RLS policies, storage buckets, triggers, and edge-function deployment.
- Valid Google Places and weather credentials with documented environment validation.
- Secure server-side AI proxy for recommendations, itinerary generation, and receipt scanning.
- Push notification credentials and platform entitlements.
- Stable native build/signing configuration for iOS and Android.

## 12. Risks and Mitigations

| Risk                                              | Impact                                                 | Mitigation                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Notion-to-Supabase cutover is incomplete          | Different screens can show different truth or behavior | Finish the Supabase contract for every production screen; freeze new Notion feature work; test migration paths      |
| AI access is client-side                          | Provider key exposure, abuse, unpredictable cost       | Move calls behind a Supabase Edge Function; add auth, rate limits, logging redaction, and cost limits               |
| Cache appears fresher than server state           | Users lose trust or make decisions from stale data     | Use scoped cache keys, explicit refresh, invalidation tests, and stale/offline UI states                            |
| Shared data permissions are ambiguous             | Privacy breach or accidental edits                     | Define trip/member roles, enforce RLS, and add cross-account verification to every shared flow                      |
| Media uploads fail on mobile networks             | Lost memories and repeated user effort                 | Keep local source until upload confirmation, use retries, thumbnails, progress, and resumable strategy where needed |
| Location or place APIs fail/slow                  | Discover feels empty or unreliable                     | Provide manual destination/origin entry, cached results, graceful empty states, and clear retry actions             |
| Currency/timezone assumptions conflict with users | Incorrect budgets, dates, or reminders                 | Define locale/currency/timezone policy and test date-only values on both platforms                                  |
| Feature breadth dilutes the core journey          | More surface area but weak activation                  | Prioritize the trip lifecycle and release gates before adding more social or AI features                            |

## 13. Scope

### In scope for the reliable MVP

- Auth, profile setup, and user-scoped data.
- Manual trip creation and booking import/scan with review.
- Home lifecycle dashboard.
- Trip overview with members, transport/flights, packing, files, and guide data.
- Invites and scoped group participation.
- Discover places, saved places, and basic group recommendations/votes.
- Trip and personal expenses, receipt review, splits, and balances.
- Moments upload, visibility, favorites, and basic organization.
- Notifications for the supported lifecycle and collaboration events.
- Cache, offline, error, RLS, and live rehydration guarantees.

### Later scope

- Expanded public Explore social graph, stories, and creator-like discovery.
- Rich AI concierge personalization and proactive itinerary generation.
- Advanced recap templates, sharing artifacts, and travel profile growth loops.
- Premium entitlements, partner integrations, booking/deal monetization, or payment processing.
- Automated booking-provider integrations beyond the supported scan/manual flows.

### Explicitly out of scope

- Acting as an OTA, booking flights/hotels, or issuing tickets.
- Holding or moving user money.
- Replacing a full accounting system.
- Publicly exposing private trip data, receipts, files, location, or moments by default.
- Building a generic social network unrelated to travel context.

## 14. Open Questions

1. What is the first launch market and supported currency/timezone policy? The current code contains PHP/PHT-oriented defaults that need a product decision.
2. Which booking formats are officially supported at launch, and what is the fallback when extraction is incomplete?
3. Is the primary activation event trip creation, booking import, destination save, or another action?
4. What are the exact free/premium boundaries, if monetization is part of the next release?
5. What privacy and moderation rules govern public moments, profiles, comments, follows, and Explore content?
6. Which trip-member roles can edit logistics, invite people, delete media, and manage expenses?
7. How long should shared files, receipts, location data, chat, and moments remain after a trip is archived or a member leaves?
8. Which AI features are essential at launch, and what are the cost, latency, and data-retention limits?
9. What external booking, calendar, payment, or partner integrations are strategic versus experimental?
10. What device matrix and release channel define “production ready” for iOS and Android?

## 15. Recommended Next Steps

1. Confirm the launch persona, activation event, market, currency, timezone, and privacy policy.
2. Create a feature inventory from this PRD and mark each route as `Supabase complete`, `migration required`, `not live-validated`, or `proposed`.
3. Finish the Notion-to-Supabase cutover for the Trip surface and remove or isolate legacy data paths.
4. Move Anthropic calls behind a Supabase Edge Function before any wider release.
5. Add the P0 release journeys to a repeatable iOS and Android QA checklist using the three-layer live-cache standard.
6. Instrument the proposed activation, collaboration, expense, memory, reliability, and cost metrics.
7. Revisit scope after the first baseline data review; do not add new major surfaces until the core lifecycle is reliable.
