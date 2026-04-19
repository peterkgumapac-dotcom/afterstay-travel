# CLAUDE.md — Instructions for Claude Code

Drop this file at the **root of `peterkgumapac-dotcom/afterstay-travel`**. Claude Code reads it on every session and treats it as standing instructions.

There are **two related codebases**:

1. **`afterstay-travel`** — this repo. Production Expo / React Native app.
2. **Afterstay design prototype** — separate HTML/React-via-Babel project used for design exploration. It contains screens the production app hasn't built yet (Login, Loader, Trips → Summary, Trips → Moments layouts). When the user says "port the prototype" or "match the design", ask for the prototype file if you don't have it.

---

## Stack (authoritative — don't swap any of these out)

- **Expo 54 + React Native 0.81 + React 19**, New Architecture enabled
- **TypeScript 5.9** strict mode (`tsconfig.json` extends `expo/tsconfig.base`, `paths: { "@/*": ["./*"] }`)
- **expo-router 6** — file-based routing in `app/`, typed routes on
- **Navigation**: `@react-navigation/native` 7
- **Icons**: `lucide-react-native` (prefer), `@expo/vector-icons` (fallback)
- **Animation**: `react-native-reanimated` 4 + `react-native-worklets`
- **Maps**: `react-native-maps`
- **Media**: `expo-av`, `expo-image-picker`, `expo-document-picker`
- **Integrations**: `expo-calendar`, `expo-clipboard`, `expo-haptics`, `expo-location`, `expo-sharing`, `expo-web-browser`
- **Device storage**: `@react-native-async-storage/async-storage` (used by `lib/cache.ts`)
- **Backend**: **Supabase** (current, in-progress migration) — Postgres + Auth + Storage + Realtime + Edge Functions. **Notion** is legacy — see migration section.
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`). Currently direct from client via `lib/anthropic.ts` using `anthropic-dangerous-direct-browser-access: true`. Must move to a Supabase Edge Function before launch.
- **Testing**: Jest + `jest-expo` preset

`app.json`: bundle id `com.afterstay.travel`, scheme `afterstay`, dark splash `#080b12`, `userInterfaceStyle: "dark"`. But the app has **light/dark theme infra** via `constants/ThemeContext` + `useTheme()`; dark is the default, not the only option.

---

## Golden rules

1. **Use theme tokens, never hardcoded values.** Import `colors`, `spacing`, `radius`, `typography`, `elevation`, `density` from `@/constants/theme`. When a component needs theme-dependent styles, use the **`getStyles(colors)` factory pattern** (see Home screen):
   ```ts
   const { colors } = useTheme();
   const styles = getStyles(colors);
   // ...
   const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
     StyleSheet.create({ /* ... */ });
   ```
2. **`lib/types.ts` is the domain model.** Every data function takes/returns those types. Extend the file — don't redefine shapes inline.
3. **Data access lives in `lib/`, never in a screen.** Screens call `getActiveTrip()`, `getExpenses(tripId)`, etc. The signature is the contract — when porting from Notion to Supabase, the screen file shouldn't change, only the lib function.
4. **Keep screens thin.** Compose from `components/` — especially `components/home/*`, `components/discover/*`, `components/budget/*`, `components/moments/*`, `components/shared/*`. If a screen passes ~400 lines, extract.
5. **PHT is the canonical timezone.** All date math goes through `safeParse()` / `toPht()` / `formatDatePHT()` / `formatTimePHT()` from `lib/utils.ts` — never `new Date(iso)` directly on a date-only string (Android will shift it to UTC).
6. **Cache reads with `cache.ts`.** For any Supabase fetch on Home/Trip/etc., use `cacheGet` / `cacheSet` or the `swr()` helper so the app opens instantly from last known state.
7. **No new `.env` key without updating `lib/config.ts` + `verifyConfig()`.**

---

## Project layout

```
app/
  _layout.tsx              Root Stack, splash, font load, verifyConfig()
  (tabs)/
    _layout.tsx            Custom pill tab bar (Home/Guide/Discover/Budget/Trip)
    home.tsx               Trip dashboard — already on Supabase
    guide.tsx              Property guide
    discover.tsx           Local discovery
    budget.tsx             Expense tracking
    trip.tsx               Trip detail (Overview/Flights/Packing/Files segments) — still on Notion
    moments.tsx            (hidden tab, opened via FAB) — 133 byte stub
    settings.tsx           (hidden tab, opened via gear icon)
  trip-planner.tsx         Modal
  trip-overview.tsx        Modal
  trip-summary.tsx         Modal
  add-expense.tsx          Modal
  add-file.tsx             Modal
  add-moment.tsx           Modal
  add-place.tsx            Modal
  place-details.tsx        Modal
  scan-receipt.tsx         Modal (uses lib/anthropic.ts scanReceipt)
  moments-slideshow.tsx    Modal
  index.tsx                Redirect to (tabs)

components/                Primitives + feature components (45 files)
  home/AnticipationHero, CountdownCard, FlightCard, WeatherForecastCard,
       QuickAccessGrid, ProfileRow, NearbySection, BudgetAlertStrip,
       GettingThereLink, GlanceStrip, SettingsSheet
  discover/FilterBar, FilterMoreSheet, InsightCard, PlaceDetailSheet
  budget/BudgetAlertCard, QuickSplitWidget, RatingWidget
  moments/MomentsTab, SlideshowModal
  shared/FloatingActionButton, FilePreviewSheet
  (root) Card, Pill, Select, FormField, CategoryFilter, ChecklistItem,
         PackingItem, ExpenseRow, TripHeader, TripFileRow, FlightCard,
         GroupMember, HotelPhotoGallery, WeatherWidget, CalendarSync,
         DepartureNudge, AIRecommendationCard, MomentForm, MomentStrip,
         QuickAccess, AfterStayLoader

constants/
  theme.ts                 colors / spacing / radius / typography / elevation / density
  ThemeContext.tsx         useTheme() — wraps a palette and exposes it via context

hooks/
  useFilters.ts, useRotatingQuote.ts, useTripInsight.ts

lib/
  supabase.ts              (create this if not present — see "Supabase migration" below)
  notion.ts                LEGACY — do not add new features; read-only during cutover
  anthropic.ts             Claude calls (recommendations, itinerary, receipt scan)
  google-places.ts         Places API (classic endpoints: findplacefromtext, nearbysearch, details/photo)
  weather.ts               weatherapi.com forecast
  calendar.ts              expo-calendar (add flights/packing reminders to device calendar)
  config.ts                CONFIG + verifyConfig() + HOTEL_COORDS + NOTION_DBS (legacy)
  types.ts                 Domain types — source of truth
  tripInsights.ts          Currently a STUB returning empty defaults — Notion implementation commented out during migration. Re-implement against Supabase + Anthropic Edge Function.
  budgetAlerts.ts          Budget threshold logic
  cache.ts                 AsyncStorage cache + swr() helper
  utils.ts                 safeParse / toPht / formatDatePHT / formatTimePHT / formatCurrency / daysUntil / hoursUntil / flightDuration / calcLeaveByTime / mask
  filters.ts, distance.ts, sanitize.ts, quotes.ts, icons.tsx
  flightData.ts, boracayData.ts, placeDetails.ts
  googleCalendarURL.ts
```

---

## Theme usage

```ts
import { colors, spacing, radius, typography, elevation, density } from '@/constants/theme';
import { useTheme } from '@/constants/ThemeContext';
```

From `constants/theme.ts`:

- **Backgrounds**: `bg #141210`, `bg2 #1b1814`, `bg3 #231e19`, `canvas #0f0d0b`, `card #1f1b17`, `card2 #262019`, `elevated #2c251e`
- **Borders**: `border #2e2822`, `border2 #3e362e`
- **Text**: `text #f1ebe2` (cream), `text2 #b8afa3`, `text3 #857d70`, `textDim #544b41`, `ink #f2ece3`
- **Accent (warm sand)**: `accent #d8ab7a`, `accentDk #c49460`, `accentLt #e6c196`, `accentDim rgba(216,171,122,.14)`, `accentBg rgba(216,171,122,.10)`, `accentBorder rgba(216,171,122,.32)`
- **Semantic**: `warn #e2b361`, `info #c49460`, `success #d8ab7a`, `danger #c4554a`
- **Highlights**: `coral #e38868`, `gold #d9a441`
- **Chart**: `chart1..5`
- **Spacing**: `xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32`
- **Radius**: `xs:8, sm:12, md:16, lg:22, xl:28, xxl:36, pill:999`
- **Typography**: `h1 28/600/-0.8`, `h2 22/600/-0.7`, `h3 18/600/-0.5`, `body 15/400/22lh`, `bodyBold 15/600/22lh`, `caption 12/500`, `sectionLabel 11/600/1.7ls uppercase`, `eyebrow 10/600/1.8ls uppercase`, `mono SpaceMono/14`, `display 500/-0.8`
- **Elevation**: `card` (4dp, shadow .30), `sm` (2dp, .22), `lg` (8dp, .38, 28r)
- **Density**: `padCard:18, padStack:16, cardGap:14, rowV:14`

**Legacy color aliases** (`green`, `blue`, `amber`, `pink`, `purple`, `red`) exist for the Notion→Supabase migration. New code uses `accent` / semantic names.

---

## Date/time conventions — read before touching any date

All trip data is in **PHT (UTC+8)**. Device timezones vary. Android in particular treats a date-only string (`"2026-04-20"`) as UTC midnight, which on Asia/Manila becomes the previous day.

**Always use `lib/utils.ts` helpers:**

```ts
safeParse(iso)        // Parses date-only strings as 00:00:00+08:00
formatDatePHT(iso)    // "Apr 20"
formatTimePHT(iso)    // "3:00 PM"
formatDateRange(s, e) // "Apr 20 – Apr 27, 2026"
daysUntil(iso)        // Days from now (PHT-safe)
hoursUntil(iso)       // Hours from now
tripStatusLabel(...)  // "Today" / "Tomorrow" / "N days away" / "Day 3 of 7" / "Completed"
flightDuration(a, b)  // "1h 5m"
calcLeaveByTime(...)  // Airport departure math (90-min domestic buffer)
formatCurrency(n, c)  // Intl.NumberFormat with fallback
```

Never call `new Date(iso)` directly on date-only strings.

---

## Supabase migration — the most important section

The app is **mid-migration** from Notion to Supabase. `home.tsx` already imports from `@/lib/supabase`; `trip.tsx` still imports from `@/lib/notion`. When Claude Code sees a screen on Notion, it should proactively offer to port it as part of the current task if related.

### Rules

1. **Never add features to `lib/notion.ts`.** It is legacy.
2. **New data access goes in `lib/supabase.ts`** with **identical function signatures** to the Notion equivalents:
   ```ts
   getActiveTrip(): Promise<Trip | null>
   getFlights(tripId: string): Promise<Flight[]>
   getGroupMembers(tripId: string): Promise<GroupMember[]>
   getPackingList(tripId: string): Promise<PackingItem[]>
   togglePacked(itemId: string, packed: boolean): Promise<void>
   getExpenses(tripId: string): Promise<Expense[]>
   getExpenseSummary(tripId: string): Promise<{ total, byCategory, count }>
   addExpense(input: Omit<Expense,'id'>): Promise<Expense>
   updateExpense(id: string, input: Partial<Expense>): Promise<Expense>
   deleteExpense(id: string): Promise<void>
   getSavedPlaces(tripId: string): Promise<Place[]>
   addPlace / voteOnPlace / savePlace / deletePlacesForTrip
   getChecklist / addChecklistItem / toggleChecklistItem
   getMoments / addMoment
   getTripFiles / addTripFile
   updateMemberPhoto / updateMemberEmail
   updateTripProperty / updateTripBudgetMode / updateTripBudgetLimit
   ```
   Screens should not change shape when the import flips from `@/lib/notion` → `@/lib/supabase`.
3. **Schema mirrors `lib/types.ts` exactly.** Table names plural snake_case; columns snake_case; FK to `trips(id)` on every per-trip table.
4. **RLS is mandatory on every table.** The anon key ships in the bundle. Policy pattern: user must be a row in `trip_members` for that `trip_id`. Profile/avatars are user-scoped.
5. **Storage buckets**: `moments/` and `trip-files/` (trip-member RLS), `avatars/` (user-scoped).
6. **Edge Functions** for anything that needs a secret:
   - `anthropic-recommend` — wraps `generateRecommendations` from `lib/anthropic.ts`
   - `anthropic-itinerary` — wraps `generateItinerary`
   - `anthropic-receipt-scan` — wraps `scanReceipt`
   - `anthropic-trip-insights` — the `tripInsights.ts` rebuild (news with `web_search` tool, cached in Supabase table `trip_insights`)
   - `hotel-booking-webhook` — POST endpoint for Canyon Hotels PMS to push bookings into `trips` + `trip_members` + `flights`
7. **Realtime** for collaborative tables: `packing_items`, `expenses`, `places` (votes), `checklist_items`. Use Supabase channel subscriptions keyed on `trip_id`.
8. **Keep the SWR pattern.** `home.tsx` already does this: read cache → render → fetch Supabase → update cache + state. Preserve it for every screen.

### Suggested Supabase schema (maps 1:1 to `lib/types.ts`)

```sql
-- Users come from Supabase Auth (auth.users). Profile lives in public.profiles.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  phone text,
  email text,
  created_at timestamptz default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text,
  start_date date not null,
  end_date date not null,
  accommodation text,
  address text,
  room_type text,
  check_in text,
  check_out text,
  hotel_phone text,
  hotel_url text,
  hotel_lat numeric,
  hotel_lng numeric,
  hotel_photos jsonb,          -- array of URLs
  booking_ref text,
  cost numeric,
  cost_currency text default 'PHP',
  transport text,
  wifi_ssid text,
  wifi_password text,
  door_code text,
  amenities text[],
  notes text,
  status text check (status in ('Planning','Active','Completed')) default 'Planning',
  budget_limit numeric,
  budget_mode text check (budget_mode in ('Limited','Unlimited')) default 'Unlimited',
  airport_arrival_buffer text,
  airport_to_hotel_time text,
  custom_quick_access text,
  transport_notes text,
  house_rules text,
  emergency_contacts text,
  created_at timestamptz default now()
);

create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,                           -- denormalized for not-yet-signed-up invitees
  role text check (role in ('Primary','Member')) default 'Member',
  email text,
  phone text,
  profile_photo text,
  flight_id uuid,
  checked_baggage boolean default false,
  invite_status text check (invite_status in ('pending','accepted')) default 'pending',
  created_at timestamptz default now(),
  unique (trip_id, user_id)
);

create table flights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  direction text check (direction in ('Outbound','Return')) not null,
  flight_number text not null,
  airline text,
  from_city text,
  to_city text,
  depart_time timestamptz not null,
  arrive_time timestamptz not null,
  booking_ref text,
  baggage text,
  passenger text,
  created_at timestamptz default now()
);

create table packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  item text not null,
  category text check (category in ('Clothing','Tech','Toiletries','Documents','Gear','Other')) default 'Other',
  packed boolean default false,
  owner text,
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  description text not null,
  amount numeric not null,
  currency text default 'PHP',
  category text check (category in ('Food','Transport','Activity','Accommodation','Shopping','Other')) default 'Other',
  date date not null,
  paid_by text,
  photo text,
  place_name text,
  split_type text check (split_type in ('Equal','Custom','Individual')),
  notes text,
  created_at timestamptz default now()
);

create table places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  category text check (category in ('Eat','Do','Nature','Essentials','Transport','Nightlife','Wellness','Culture','Coffee')) not null,
  distance text,
  notes text,
  price_estimate text,
  rating int check (rating between 1 and 5),
  source text check (source in ('Suggested','Manual','Friend Rec')) default 'Manual',
  vote text check (vote in ('👍 Yes','👎 No','Pending')) default 'Pending',
  vote_by_member jsonb default '{}'::jsonb,
  photo_url text,
  google_place_id text,
  latitude numeric,
  longitude numeric,
  google_maps_uri text,
  total_ratings int,
  saved boolean default true,
  created_at timestamptz default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  task text not null,
  done boolean default false,
  done_by text,
  due_at timestamptz,
  order_idx int default 0,
  created_at timestamptz default now()
);

create table moments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  caption text,
  photo text,                                   -- Storage path in moments/ bucket
  location text,
  taken_by text,
  date date not null,
  tags text[],                                  -- enum values from MomentTag
  created_at timestamptz default now()
);

create table trip_files (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  file_name text not null,
  file_url text,                                -- Storage path in trip-files/ bucket
  type text check (type in ('Boarding Pass','Hotel Confirmation','Itinerary','Insurance','ID/Passport','Receipt','Other')) default 'Other',
  notes text,
  print_required boolean default false,
  created_at timestamptz default now()
);

create table trip_insights (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  summary text,
  news_items jsonb default '[]'::jsonb,
  fetched_at timestamptz default now(),
  expires_at timestamptz not null
);
```

### RLS policy template

```sql
alter table trips enable row level security;

create policy "trip members can read"
  on trips for select using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = trips.id
        and trip_members.user_id = auth.uid()
    )
  );

create policy "primary member can write"
  on trips for all using (
    exists (
      select 1 from trip_members
      where trip_members.trip_id = trips.id
        and trip_members.user_id = auth.uid()
        and trip_members.role = 'Primary'
    )
  );
```

Apply the same "member of trip_members" pattern on every per-trip table. Profiles/avatars: `auth.uid() = id`.

---

## Env vars (`lib/config.ts` + `verifyConfig()`)

Currently in `CONFIG`:
- `EXPO_PUBLIC_GOOGLE_PLACES_KEY` — Google Places (classic API)
- `EXPO_PUBLIC_NOTION_API_KEY` — **legacy**, remove post-migration
- `EXPO_PUBLIC_WEATHER_API_KEY` — weatherapi.com
- `EXPO_PUBLIC_ANTHROPIC_API_KEY` — **move to Edge Function**, then remove
- `EXPO_PUBLIC_TRIP_PAGE_ID` — **legacy**, Notion page ID
- `NOTION_DBS` — **legacy** hardcoded Notion database IDs

Add:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Naming drift to fix:** `app.config.js` uses `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` (with `_API_`), but `lib/config.ts` uses `EXPO_PUBLIC_GOOGLE_PLACES_KEY`. Standardize on one — prefer `EXPO_PUBLIC_GOOGLE_PLACES_KEY` and update `app.config.js`.

Also note: `NOTION_DBS` in `lib/config.ts` has **different IDs** than the defaults used inside `lib/notion.ts`. The in-file defaults in `notion.ts` are the ones actually hitting Notion. Don't "fix" `config.ts` without verifying which IDs are real.

---

## Adding a feature — checklist

- [ ] New type? Add to `lib/types.ts` (don't define inline).
- [ ] Data access? Add to `lib/supabase.ts` (not `lib/notion.ts`) with a function signature that matches existing Notion ones.
- [ ] UI? Theme tokens only. Use `useTheme()` + `getStyles(colors)` factory.
- [ ] Modal screen? Add under `app/`, register in `app/_layout.tsx` with `presentation: 'modal'`.
- [ ] Shared component? `components/` — pick the right subfolder (`home/`, `discover/`, `budget/`, `moments/`, `shared/`).
- [ ] Icon? `lucide-react-native`.
- [ ] Date? `safeParse` / `formatDatePHT` / `formatTimePHT`. Never raw `new Date(iso)` on date-only strings.
- [ ] Money? `formatCurrency(amount, currency)`.
- [ ] Env var? `lib/config.ts` CONFIG + `verifyConfig()`.
- [ ] Cached? Use `cacheGet` / `cacheSet` / `swr` from `lib/cache.ts`.
- [ ] Haptic? `expo-haptics` light style on primary actions.
- [ ] Secret involved? Supabase Edge Function, not a client call.
- [ ] New table? RLS policy committed in the same PR.
- [ ] Accessibility? `accessibilityRole`, `accessibilityLabel`, hit targets ≥ 44pt.

---

## Commands

```bash
npm start         # expo start
npm run ios       # expo run:ios
npm run android   # expo run:android
npm run web       # expo start --web
npm test          # jest --watchAll (jest-expo preset)
```

Run `npm test` before committing UI/state changes. Non-trivial `lib/*` functions should have a Jest test next to them.

---

## What NOT to do

- Don't hardcode hexes or pixel values — use `constants/theme.ts`.
- Don't add new features to `lib/notion.ts`. It's frozen.
- Don't put data access in screens.
- Don't bundle new secrets into the client. `EXPO_PUBLIC_*` is fully public — if it must stay secret, put it behind an Edge Function.
- Don't ship a new Supabase table without RLS.
- Don't use `new Date(iso)` on date-only strings (Android timezone bug). Use `safeParse`.
- Don't introduce Tailwind / styled-components / Restyle. Convention is `StyleSheet.create` + theme tokens (+ `getStyles` factory when colors are dynamic).
- Don't swap the navigation library. expo-router is the one.
- Don't leave `TODO` comments — open an issue or finish.
- Don't commit anything from the design prototype's `/*EDITMODE-BEGIN*/` block or `__edit_mode_*` postMessage wiring.
- Don't call Anthropic with `anthropic-dangerous-direct-browser-access: true` in new code. Use the Edge Function once it exists; until then, don't add **more** direct calls.

---

## Security — fix before GA

1. **Anthropic key is bundled** (`EXPO_PUBLIC_ANTHROPIC_API_KEY`) — everyone who installs the app can read it. Move to Supabase Edge Function.
2. **Notion key is bundled** — same problem, full workspace access. Kill after migration.
3. **Supabase anon key is fine to bundle**, but only because RLS enforces access. No RLS = full DB leak.
4. **Google Places key** — restrict by bundle ID in Cloud Console.
5. **No auth yet** — the app assumes one user, one trip. Supabase Auth (Apple + Google + email magic link + phone OTP) must land before multi-user.

---

## Product context

- **User**: someone who just booked at a partner hotel (currently only **Canyon Hotels & Resorts, Boracay**).
- **Job**: make the period between booking and checkout effortless — itinerary, group coordination, discovery, budget, memories.
- **Active trip**: single trip model. `getActiveTrip()` returns one. Multi-trip is future work.
- **Reference trip in dev data**: Boracay 2026, Apr 20–27, 7 nights, group of 4, ₱ currency.
- **Hotel coords**: `11.9710, 121.9215` (in `CONFIG.HOTEL_COORDS`; migrate to the `trips` row as `hotel_lat` / `hotel_lng`).

---

## Design prototype — how to use it

When the user asks to port a design:

1. Ask them to paste the prototype HTML or screen JSX file if you don't have it.
2. Identify the screen (Login, Loader, Trips → Summary, Trips → Moments are the big gaps today).
3. Translate with these mappings:
   - `<div>` + inline styles → `<View>` + `StyleSheet.create`
   - CSS `color` / `background` → theme tokens
   - CSS animations → `react-native-reanimated` with `useSharedValue` + `useAnimatedStyle`
   - SVG icon → `lucide-react-native` equivalent (search the icon name; if no match, inline `react-native-svg`)
   - `localStorage` → `AsyncStorage` via `lib/cache.ts`
   - prototype `window.claude.complete()` → an Edge Function call (or a `lib/anthropic.ts` function for now)
4. Split into `components/<screen>/*` if the screen is non-trivial.
5. Preserve the prototype's visual rhythm — the design system in the prototype is the intended look.

---

## Contact

Peter Karl Gumapac — repo owner. When unsure whether a change belongs in the production repo or the design prototype, ask.
