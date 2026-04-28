// Supabase data layer — drop-in replacement for lib/notion.ts.
// Every exported function preserves the original signature so consumer
// files only need to change their import path.

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { clearTripLocalData } from './cache'
import { compressImage } from './compressImage'
import { MS_PER_DAY } from './utils'

import type {
  Album,
  AlbumMember,
  AlbumMemberRole,
  ChecklistItem,
  Expense,
  Flight,
  GroupMember,
  Highlight,
  HighlightType,
  LifetimeStats,
  Moment,
  MomentTag,
  MomentVisibility,
  PackingItem,
  Place,
  PlaceCategory,
  PlaceSource,
  PlaceVote,
  Trip,
  TripFile,
  TripFileType,
  TripMemory,
  TripMemoryExpenses,
  TripMemoryFlight,
  TripMemoryPlace,
  TripMemorySnapshot,
  TripMemoryStats,
  TripMemoryStatus,
  TripMemoryVibe,
  TripStatus,
  UserSegment,
  UserTier,
} from './types'

// ---------- client ----------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? ''

if (!SUPABASE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase key missing. Set EXPO_PUBLIC_SUPABASE_KEY in .env.')
}

// Noop storage for Node.js (OTA export). AsyncStorage crashes in Node because `window` is undefined.
const noopStorage = {
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
}

// Detect Node.js (OTA export) vs React Native (device)
const isNode = typeof process !== 'undefined' && !!process.versions?.node
const safeStorage = isNode ? noopStorage : AsyncStorage

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ---------- helpers ----------

/** Parse numeric strings returned by the Supabase REST API for numeric columns. */
function num(v: unknown): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'number' ? v : parseFloat(v as string)
  return Number.isNaN(n) ? undefined : n
}

function numRequired(v: unknown, fallback = 0): number {
  return num(v) ?? fallback
}

/**
 * Read a local file URI as a Uint8Array for Supabase Storage upload.
 * Uses fetch→arrayBuffer (memory-efficient, no base64 intermediate) with
 * a FileSystem base64 fallback for content:// URIs on Android.
 */
async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  // file:// URIs work with fetch natively in React Native
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const fetchUri = uri.startsWith('/') ? `file://${uri}` : uri
    const response = await fetch(fetchUri)
    const buffer = await response.arrayBuffer()
    return new Uint8Array(buffer)
  }
  // content:// URIs (Android picker) — must use FileSystem
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

/** Android-safe date parser: date-only strings get PHT suffix to avoid UTC shift. */
function parseDateSafe(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T00:00:00+08:00')
  }
  return new Date(iso)
}

// Cache the active trip ID and trip object so trip-scoped functions that omit tripId
// do not fire a separate query every time.
let cachedTripId: string | undefined
let cachedTrip: Trip | null | undefined // undefined = not fetched, null = no trip

async function resolveTripId(tripId?: string): Promise<string> {
  if (tripId) return tripId
  if (cachedTripId) return cachedTripId
  const trip = await getActiveTrip()
  if (!trip) throw new Error('No active trip found and no tripId provided.')
  cachedTripId = trip.id
  return trip.id
}

// ---------- TABLE NAMES ----------

const T = {
  trips: 'trips',
  flights: 'flights',
  groupMembers: 'group_members',
  packingItems: 'packing_items',
  expenses: 'expenses',
  places: 'places',
  checklist: 'checklist_items',
  moments: 'moments',
  tripFiles: 'trip_files',
} as const

// ---------- MAPPERS (snake_case DB -> camelCase app) ----------

function mapTrip(row: Record<string, unknown>): Trip {
  const start = (row.start_date as string) ?? ''
  const end = (row.end_date as string) ?? start
  const nights =
    start && end
      ? Math.max(
          1,
          Math.round(
            (parseDateSafe(end).getTime() - parseDateSafe(start).getTime()) / MS_PER_DAY
          )
        )
      : 0

  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    destination: (row.destination as string) ?? '',
    startDate: start,
    endDate: end,
    nights,
    accommodation: (row.accommodation_name as string) ?? '',
    address: (row.accommodation_address as string) ?? '',
    roomType: (row.room_type as string) ?? '',
    checkIn: (row.check_in as string) ?? undefined,
    checkOut: (row.check_out as string) ?? undefined,
    hotelPhone: (row.hotel_phone as string) ?? undefined,
    bookingRef: (row.booking_ref as string) ?? undefined,
    costCurrency: (row.currency as string) ?? 'PHP',
    heroImageUrl: (row.cover_image as string) ?? undefined,
    transport: (row.transport_mode as string) ?? undefined,
    wifiSsid: (row.wifi_ssid as string) ?? undefined,
    wifiPassword: (row.wifi_password as string) ?? undefined,
    doorCode: (row.door_code as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    status: ((row.status as string) || 'Planning') as TripStatus,
    hotelUrl: (row.hotel_url as string) ?? undefined,
    airportArrivalBuffer: (row.airport_arrival_buffer as string) ?? undefined,
    airportToHotelTime: (row.airport_to_hotel_time as string) ?? undefined,
    customQuickAccess: (row.custom_quick_access as string) ?? undefined,
    transportNotes: (row.transport_notes as string) ?? undefined,
    houseRules: (row.house_rules as string) ?? undefined,
    hotelLat: num(row.hotel_lat) || undefined,
    hotelLng: num(row.hotel_lng) || undefined,
    emergencyContacts: (row.emergency_contacts as string) ?? undefined,
    hotelPhotos: (row.hotel_photos as string) ?? undefined,
    budgetLimit: num(row.budget_limit),
    budgetMode: ((row.budget_mode as string) || 'Unlimited') as Trip['budgetMode'],
    // Lifetime / past-trip fields
    userId: (row.user_id as string) ?? undefined,
    isPastImport: row.is_past_import != null ? !!row.is_past_import : undefined,
    confidenceLevel: (row.confidence_level as Trip['confidenceLevel']) ?? undefined,
    datePrecision: (row.date_precision as Trip['datePrecision']) ?? undefined,
    country: (row.country as string) ?? undefined,
    countryCode: (row.country_code as string) ?? undefined,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    totalSpent: num(row.total_spent),
    totalNights: num(row.total_nights),
    isDraft: row.is_draft != null ? !!row.is_draft : undefined,
    deletedAt: (row.deleted_at as string) ?? undefined,
    archivedAt: (row.archived_at as string) ?? undefined,
  }
}

/**
 * Supabase returns timestamptz in UTC (e.g. "2026-04-20T03:30:00+00:00").
 * If the original flight time was entered as PHT but stored without offset,
 * the time displays 8 hours ahead. This normalizes by ensuring the ISO string
 * has the +08:00 offset when Supabase returns +00:00 for a PHT timestamp.
 */
function ensurePhtOffset(iso: string): string {
  if (!iso) return iso;
  // If already has +08:00, leave it
  if (iso.includes('+08:00') || iso.includes('+08')) return iso;
  // If ends with Z or +00:00, Supabase returned UTC — the original was PHT
  // Subtract 8h would double-convert. Instead, replace the offset to treat as-is PHT.
  if (iso.endsWith('Z') || iso.includes('+00:00') || iso.includes('+00')) {
    return iso.replace(/Z$/, '+08:00').replace(/\+00:00$/, '+08:00').replace(/\+00$/, '+08:00');
  }
  // No timezone info — assume PHT
  return iso + '+08:00';
}

function mapFlight(row: Record<string, unknown>): Flight {
  const rawDepart = (row.departure_time as string) ?? (row.depart_time as string) ?? '';
  const rawArrive = (row.arrival_time as string) ?? (row.arrive_time as string) ?? '';
  return {
    id: row.id as string,
    direction: ((row.direction as string) || 'Outbound') as Flight['direction'],
    flightNumber: (row.flight_number as string) ?? '',
    airline: (row.airline as string) ?? '',
    from: (row.origin as string) ?? (row.from_city as string) ?? '',
    to: (row.destination as string) ?? (row.to_city as string) ?? '',
    departTime: rawDepart,
    arriveTime: rawArrive,
    bookingRef: (row.booking_ref as string) ?? (row.confirmation as string) ?? undefined,
    baggage: (row.baggage as string) ?? undefined,
    passenger: (row.passenger as string) ?? undefined,
  }
}

function mapMember(row: Record<string, unknown>): GroupMember {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    role: ((row.role as string) || 'Member') as GroupMember['role'],
    userId: (row.user_id as string) ?? undefined,
    phone: (row.phone as string) ?? undefined,
    email: (row.email as string) ?? undefined,
    profilePhoto: (row.avatar_url as string) ?? undefined,
  }
}

function mapPacking(row: Record<string, unknown>): PackingItem {
  return {
    id: row.id as string,
    item: (row.name as string) ?? '',
    category: ((row.category as string) || 'Other') as PackingItem['category'],
    packed: !!row.is_packed,
    owner: (row.owner as string) ?? undefined,
  }
}

function mapExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    description: (row.title as string) ?? '',
    amount: numRequired(row.amount),
    currency: (row.currency as string) || 'PHP',
    category: ((row.category as string) || 'Other') as Expense['category'],
    date: (row.expense_date as string) ?? '',
    paidBy: (row.paid_by as string) ?? undefined,
    photo: (row.photo_url as string) ?? undefined,
    placeName: (row.place_name as string) ?? undefined,
    placeLatitude: num(row.place_latitude),
    placeLongitude: num(row.place_longitude),
    splitType: (row.split_type as Expense['splitType']) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    userId: (row.user_id as string) ?? undefined,
  }
}

function mapPlace(row: Record<string, unknown>): Place {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    category: ((row.category as string) || 'Do') as PlaceCategory,
    distance: (row.distance as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    priceEstimate: (row.price_estimate as string) ?? undefined,
    rating: num(row.rating),
    source: ((row.source as string) || 'Manual') as PlaceSource,
    vote: ((row.vote as string) || 'Pending') as PlaceVote,
    photoUrl: (row.photo_url as string) ?? undefined,
    googlePlaceId: (row.google_place_id as string) ?? undefined,
    googleMapsUri: (row.google_maps_uri as string) ?? undefined,
    totalRatings: num(row.total_ratings),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    saved: row.saved != null ? !!row.saved : undefined,
    voteByMember: row.vote_by_member
      ? (row.vote_by_member as Record<string, PlaceVote>)
      : undefined,
  }
}

function mapChecklist(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    task: (row.title as string) ?? '',
    done: !!row.is_done,
    doneBy: (row.done_by as string) ?? undefined,
  }
}

/** Resolve a moment photo string to a full public URL.
 *  Handles: full HTTP URLs, bare storage paths, and HEIC → render conversion. */
export function resolvePhotoUrl(photo: string | undefined): string | undefined {
  if (!photo) return undefined;
  let url = photo;
  // If it's a bare storage path (not a full URL), prepend the Supabase storage base
  if (!url.startsWith('http')) {
    if (!SUPABASE_URL) return undefined;
    url = `${SUPABASE_URL}/storage/v1/object/public/moments/${url}`;
  }
  // HEIC → render endpoint for Android compatibility
  if (url.match(/\.heic$/i)) {
    return url.replace('/object/public/', '/render/image/public/') + '?format=origin';
  }
  return url;
}

function momentPhotoUrl(row: Record<string, unknown>): string | undefined {
  let url = row.public_url as string | undefined
  // Detect truncated public_url (ends with "/" or "/trips/" instead of a filename)
  if (url && (url.endsWith('/') || !url.match(/\.\w{2,5}$/))) {
    url = undefined // force fallback to storage_path
  }
  // Fallback: reconstruct from storage_path if public_url wasn't saved or was truncated
  if (!url) {
    const storagePath = row.storage_path as string | undefined
    if (storagePath && SUPABASE_URL) {
      url = `${SUPABASE_URL}/storage/v1/object/public/moments/${storagePath}`
    }
  }
  if (!url) return undefined
  // HEIC files: use Supabase render endpoint to serve as JPEG (Android can't decode HEIC)
  if (url.match(/\.heic$/i)) {
    return url.replace('/object/public/', '/render/image/public/') + '?format=origin'
  }
  return url
}

function mapMoment(row: Record<string, unknown>): Moment {
  return {
    id: row.id as string,
    caption: (row.caption as string) ?? '',
    photo: momentPhotoUrl(row),
    hdPhoto: (row.hd_url as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    takenBy: (row.uploaded_by as string) ?? undefined,
    userId: (row.user_id as string) ?? undefined,
    date: (row.taken_at as string) ?? new Date().toISOString().slice(0, 10),
    tags: ((row.tags as string[]) ?? []) as MomentTag[],
    visibility: ((row.visibility as string) ?? 'shared') as Moment['visibility'],
  }
}

function mapTripFile(row: Record<string, unknown>): TripFile {
  return {
    id: row.id as string,
    fileName: (row.name as string) ?? '',
    fileUrl: (row.file_url as string) ?? undefined,
    type: ((row.file_type as string) || 'Other') as TripFileType,
    notes: (row.description as string) ?? undefined,
    printRequired: !!row.print_required,
  }
}

// ---------- TRIPS ----------

export async function getActiveTrip(forceRefresh = false): Promise<Trip | null> {
  if (cachedTrip !== undefined && !forceRefresh) return cachedTrip

  // Get authenticated user — filter trips to only this user's
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id

  let query = supabase
    .from(T.trips)
    .select('*')
    .in('status', ['Planning', 'Active'])
    .is('is_draft', null)          // exclude incomplete onboarding drafts
    .order('start_date', { ascending: true })
    .limit(1)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    cachedTrip = null
    return null
  }

  // Filter soft-deleted / archived in JS (columns may not exist in old DBs)
  const row = data[0]
  if (row.deleted_at || row.archived_at) {
    cachedTrip = null
    return null
  }

  const trip = mapTrip(row)
  cachedTripId = trip.id
  cachedTrip = trip
  return trip
}

/** Fetch recent expenses across all user's trips (budget history without active trip). */
export async function getAllUserExpenses(limit = 20): Promise<(Expense & { tripName?: string })[]> {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) return []

  const allTrips = await getAllUserTrips(userId)
  if (allTrips.length === 0) return []

  const tripIds = allTrips.map((t) => t.id)
  const tripNameMap = new Map(allTrips.map((t) => [t.id, t.destination ?? t.name]))

  const { data: exps } = await supabase
    .from(T.expenses)
    .select('*')
    .in('trip_id', tripIds)
    .order('expense_date', { ascending: false })
    .limit(limit)

  if (!exps) return []
  return exps.map((r) => ({
    ...mapExpense(r as Record<string, unknown>),
    tripName: tripNameMap.get(r.trip_id as string),
  }))
}

export async function getStandaloneExpenses(limit = 30): Promise<Expense[]> {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) return []

  const { data } = await supabase
    .from(T.expenses)
    .select('*')
    .is('trip_id', null)
    .eq('user_id', userId)
    .order('expense_date', { ascending: false })
    .limit(limit)

  if (!data) return []
  return data.map((r) => mapExpense(r as Record<string, unknown>))
}

export function clearTripCache() {
  cachedTripId = undefined
  cachedTrip = undefined
}

/** Fetch a single trip by ID (works for any status including Completed). */
export async function getTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from(T.trips)
    .select('*')
    .eq('id', tripId)
    .single()
  if (error || !data) return null
  return mapTrip(data as Record<string, unknown>)
}

// ---------- CREATE TRIP ----------

export async function createTrip(input: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  members?: string[];
  accommodation?: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  bookingRef?: string;
  cost?: number;
  costCurrency?: string;
  transport?: string;
}): Promise<string> {
  // Get authenticated user ID for trip ownership — required by RLS
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error('createTrip: not authenticated')

  // Archive only THIS user's old Planning trips — never touch an Active
  // trip. Multi-trip support means users can have past trips alongside
  // a new one, but only one Planning trip at a time makes sense.
  await supabase
    .from(T.trips)
    .update({ status: 'Completed' })
    .eq('status', 'Planning')
    .eq('user_id', userId)

  // Clear all trip-specific local caches for a fresh start
  await clearTripLocalData()

  // Auto-detect status from dates
  const now = new Date();
  const start = new Date(input.startDate + 'T00:00:00+08:00');
  const end = new Date(input.endDate + 'T23:59:59+08:00');
  const status = now > end ? 'Completed' : now >= start ? 'Active' : 'Planning';

  const { data, error } = await supabase
    .from(T.trips)
    .insert({
      name: input.name || `Trip to ${input.destination}`,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      status,
      user_id: userId,
      ...(input.accommodation ? { accommodation_name: input.accommodation } : {}),
      ...(input.address ? { accommodation_address: input.address } : {}),
      ...(input.checkIn ? { check_in: input.checkIn } : {}),
      ...(input.checkOut ? { check_out: input.checkOut } : {}),
      ...(input.cost != null ? { budget_limit: input.cost } : {}),
      ...(input.costCurrency ? { currency: input.costCurrency } : {}),
      ...(input.bookingRef ? { notes: `Booking ref: ${input.bookingRef}` } : {}),
      ...(input.roomType ? { room_type: input.roomType } : {}),
      ...(input.transport ? { transport_mode: input.transport } : {}),
    })
    .select('id')
    .single()

  if (error) throw new Error(`createTrip: ${error.message}`)
  const tripId = data.id as string
  cachedTripId = tripId
  cachedTrip = undefined // Invalidate cache so next fetch gets new trip

  // Always add the organizer as Primary member
  const userName = authData?.user?.user_metadata?.full_name
    ?? authData?.user?.email?.split('@')[0]
    ?? 'Organizer';
  await supabase.from(T.groupMembers).insert({
    trip_id: tripId,
    name: userName,
    role: 'Primary',
    user_id: userId,
  }).then(() => {}) // don't block on failure

  // Add additional members if provided
  if (input.members && input.members.length > 0) {
    const memberRows = input.members
      .filter(n => n.trim().toLowerCase() !== userName.toLowerCase()) // skip if organizer is in list
      .map((name) => ({
        trip_id: tripId,
        name: name.trim(),
        role: 'Member' as const,
      }))
    if (memberRows.length > 0) {
      await supabase.from(T.groupMembers).insert(memberRows)
    }
  }

  return tripId
}

/** Save a partial/draft trip without archiving existing trips.
 *  Used when a user backs out of onboarding mid-flow. */
export async function saveDraftTrip(input: {
  destination: string;
  transport?: string;
  vibes?: string[];
  when?: string;
  travelers?: number;
}): Promise<string> {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw new Error('saveDraftTrip: not authenticated')

  // Compute placeholder dates from "when" hint
  const today = new Date()
  let startDate: string
  let endDate: string
  switch (input.when) {
    case 'This month': {
      const s = new Date(today.getTime() + 14 * MS_PER_DAY)
      startDate = s.toISOString().slice(0, 10)
      endDate = new Date(s.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10)
      break
    }
    case 'Next month': {
      const s = new Date(today.getFullYear(), today.getMonth() + 1, 15)
      startDate = s.toISOString().slice(0, 10)
      endDate = new Date(s.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10)
      break
    }
    default: {
      const s = new Date(today.getTime() + 60 * MS_PER_DAY)
      startDate = s.toISOString().slice(0, 10)
      endDate = new Date(s.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10)
    }
  }

  const { data, error } = await supabase
    .from(T.trips)
    .insert({
      name: `Trip to ${input.destination}`,
      destination: input.destination,
      start_date: startDate,
      end_date: endDate,
      status: 'Planning',
      user_id: userId,
      is_draft: true,
      ...(input.transport ? { transport_mode: input.transport } : {}),
      ...(input.vibes?.length ? { vibes: input.vibes } : {}),
    })
    .select('id')
    .single()

  if (error) throw new Error(`saveDraftTrip: ${error.message}`)
  const tripId = data.id as string

  // Add organizer as Primary member
  const userName = authData?.user?.user_metadata?.full_name
    ?? authData?.user?.email?.split('@')[0]
    ?? 'Organizer'
  await supabase.from(T.groupMembers).insert({
    trip_id: tripId,
    name: userName,
    role: 'Primary',
    user_id: userId,
  }).then(() => {})

  return tripId
}

/** Delete a draft trip (used when user taps "Discard" on resume nudge) */
export async function discardDraftTrip(tripId: string): Promise<void> {
  // Best-effort cascade cleanup — ignore errors on tables that may not exist
  // or already have ON DELETE CASCADE in the schema
  await Promise.all([
    supabase.from(T.groupMembers).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.flights).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.expenses).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.places).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.moments).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.packingItems).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.tripFiles).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from(T.checklist).delete().eq('trip_id', tripId).then(() => {}),
    supabase.from('chat_messages').delete().eq('trip_id', tripId).then(() => {}),
    supabase.from('trip_invites').delete().eq('trip_id', tripId).then(() => {}),
    supabase.from('trip_memories').delete().eq('trip_id', tripId).then(() => {}),
    supabase.from('notifications').delete().eq('trip_id', tripId).then(() => {}),
  ])

  const { error } = await supabase.from(T.trips).delete().eq('id', tripId)
  if (error) throw new Error(`deleteTrip: ${error.message}`)
}

// ---------- ADD GROUP MEMBER ----------

// ---------- TRIP INVITES ----------

export async function createInviteCode(tripId?: string): Promise<string> {
  const id = await resolveTripId(tripId)
  // Generate 6-char alphanumeric code
  const code = Math.random().toString(36).slice(2, 8).toUpperCase()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { error } = await supabase.from('trip_invites').insert({
    trip_id: id,
    code,
    expires_at: expiresAt,
  })
  if (error) throw new Error(`createInviteCode: ${error.message}`)
  return code
}

export async function joinTripByCode(code: string, userName: string): Promise<{ tripId: string; trip: Trip }> {
  // Look up the invite
  const { data: invite, error: lookupError } = await supabase
    .from('trip_invites')
    .select('trip_id, expires_at, used')
    .eq('code', code.toUpperCase())
    .single()

  if (lookupError || !invite) throw new Error('Invalid invite code')
  if (invite.used) throw new Error('This invite has already been used')
  if (new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired')

  // Get trip details
  const tripId = invite.trip_id as string
  const { data: tripData, error: tripError } = await supabase
    .from(T.trips)
    .select('*')
    .eq('id', tripId)
    .single()
  if (tripError || !tripData) throw new Error('Trip not found')

  // Add user as trip member with user_id
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id

  const { error: memberError } = await supabase.from(T.groupMembers).insert({
    trip_id: tripId,
    name: userName,
    role: 'Member',
    ...(userId ? { user_id: userId } : {}),
  })
  if (memberError) throw new Error(`joinTrip: ${memberError.message}`)

  // Mark invite as used
  await supabase.from('trip_invites').update({ used: true }).eq('code', code.toUpperCase())

  // Notify existing members (best-effort, non-blocking)
  if (userId) {
    notifyMemberJoined(tripId, userName, userId).catch(() => {})
  }

  return { tripId, trip: mapTrip(tripData) }
}

export interface TripInvite {
  id: string
  code: string
  createdAt: string
  expiresAt: string
  used: boolean
}

export async function getInvites(tripId?: string): Promise<TripInvite[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from('trip_invites')
    .select('id, code, created_at, expires_at, used')
    .eq('trip_id', id)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error || !data) return []
  return data.map((r: any) => ({
    id: r.id,
    code: r.code,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    used: !!r.used,
  }))
}

// ---------- ADD FLIGHT ----------

export async function addFlight(input: {
  tripId: string;
  direction: 'Outbound' | 'Return';
  flightNumber: string;
  airline?: string;
  fromCity?: string;
  toCity?: string;
  departTime?: string;
  arriveTime?: string;
  bookingRef?: string;
  passenger?: string;
}): Promise<void> {
  const { error } = await supabase.from(T.flights).insert({
    trip_id: input.tripId,
    direction: input.direction,
    flight_number: input.flightNumber,
    ...(input.airline ? { airline: input.airline } : {}),
    ...(input.fromCity ? { from_city: input.fromCity } : {}),
    ...(input.toCity ? { to_city: input.toCity } : {}),
    ...(input.departTime ? { depart_time: input.departTime } : {}),
    ...(input.arriveTime ? { arrive_time: input.arriveTime } : {}),
    ...(input.bookingRef ? { booking_ref: input.bookingRef } : {}),
    ...(input.passenger ? { passenger: input.passenger } : {}),
  })
  if (error) throw new Error(`addFlight: ${error.message}`)
}

// ---------- GROUP CHAT ----------

export interface ChatMessage {
  id: string;
  tripId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  createdAt: string;
}

export async function getChatMessages(tripId?: string): Promise<ChatMessage[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('trip_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw new Error(`getChatMessages: ${error.message}`)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    tripId: row.trip_id,
    senderName: row.sender_name ?? '',
    senderAvatar: row.sender_avatar ?? undefined,
    message: row.message ?? '',
    createdAt: row.created_at,
  }))
}

export async function sendChatMessage(input: {
  tripId?: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
}): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from('chat_messages').insert({
    trip_id: id,
    sender_name: input.senderName,
    sender_avatar: input.senderAvatar ?? null,
    message: input.message.trim(),
  })
  if (error) throw new Error(`sendChatMessage: ${error.message}`)
}

export function subscribeToChatMessages(
  tripId: string,
  onMessage: (msg: ChatMessage) => void,
) {
  const channel = supabase
    .channel(`chat:${tripId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload: any) => {
        const row = payload.new
        onMessage({
          id: row.id,
          tripId: row.trip_id,
          senderName: row.sender_name ?? '',
          senderAvatar: row.sender_avatar ?? undefined,
          message: row.message ?? '',
          createdAt: row.created_at,
        })
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

// ---------- ADD GROUP MEMBER ----------

export async function addGroupMember(input: {
  tripId?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: 'Primary' | 'Member';
}): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.groupMembers).insert({
    trip_id: id,
    name: input.name.trim(),
    role: input.role ?? 'Member',
    ...(input.email ? { email: input.email.trim() } : {}),
    ...(input.phone ? { phone: input.phone.trim() } : {}),
  })
  if (error) throw new Error(`addGroupMember: ${error.message}`)
}

/**
 * Update a single text property on a trip.
 * The key uses the Notion-era display name; we map it to the Supabase column.
 */
const TRIP_PROPERTY_MAP: Record<string, string> = {
  'Accommodation Name': 'accommodation_name',
  'Accommodation Address': 'accommodation_address',
  'Check-in Time': 'check_in',
  'Check-out Time': 'check_out',
  'Transport Mode': 'transport_mode',
  'WiFi Network': 'wifi_ssid',
  'WiFi Password': 'wifi_password',
  'Door Code': 'door_code',
  Notes: 'notes',
  'Hotel URL': 'hotel_url',
  'Airport Arrival Buffer': 'airport_arrival_buffer',
  'Airport to Hotel Time': 'airport_to_hotel_time',
  'Custom Quick Access': 'custom_quick_access',
  'Transport Notes': 'transport_notes',
  'House Rules': 'house_rules',
  'Emergency Contacts': 'emergency_contacts',
  'Hotel Photos': 'hotel_photos',
  Destination: 'destination',
  'Trip Name': 'name',
  status: 'status',
}

export async function updateTripProperty(
  tripId: string,
  key: string,
  value: string
): Promise<void> {
  const column = TRIP_PROPERTY_MAP[key]
  if (!column) throw new Error(`updateTripProperty: unknown key "${key}"`)
  const { error } = await supabase.from(T.trips).update({ [column]: value }).eq('id', tripId)
  if (error) throw new Error(`updateTripProperty: ${error.message}`)
}

export async function updateTripBudgetMode(
  tripId: string,
  mode: 'Limited' | 'Unlimited'
): Promise<void> {
  const { error } = await supabase
    .from(T.trips)
    .update({ budget_mode: mode })
    .eq('id', tripId)
  if (error) throw new Error(`updateTripBudgetMode: ${error.message}`)
}

export async function updateTripBudgetLimit(tripId: string, limit: number): Promise<void> {
  const { error } = await supabase
    .from(T.trips)
    .update({ budget_limit: limit })
    .eq('id', tripId)
  if (error) throw new Error(`updateTripBudgetLimit: ${error.message}`)
}

// ── Payment QRs ────────────────────────────────────────────────────────

export interface PaymentQr {
  label: string;
  uri: string;
  /** Payment link for branded QR generation */
  qrData?: string;
  /** Bank/wallet name (GCash, Maya, BPI, etc.) */
  bank?: string;
}

export async function getPaymentQrs(tripId: string): Promise<PaymentQr[]> {
  const { data, error } = await supabase
    .from(T.trips)
    .select('payment_qrs')
    .eq('id', tripId)
    .single()
  if (error || !data) return []
  return (data.payment_qrs as PaymentQr[]) ?? []
}

export async function addPaymentQr(
  tripId: string,
  label: string,
  localUri: string
): Promise<PaymentQr[]> {
  // Upload image to storage
  const ext = 'jpeg'
  const rand = Math.random().toString(36).slice(2, 6)
  const storagePath = `payment-qr/${tripId}/${label.toLowerCase().replace(/\s+/g, '-')}-${rand}.${ext}`

  const bytes = await readFileAsBytes(localUri)

  const { error: uploadError } = await supabase.storage
    .from('moments')
    .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw new Error(`addPaymentQr upload: ${uploadError.message}`)

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  // Get current list, append, save
  const current = await getPaymentQrs(tripId)
  const next = [...current, { label, uri: publicUrl }]

  const { error } = await supabase
    .from(T.trips)
    .update({ payment_qrs: next })
    .eq('id', tripId)
  if (error) throw new Error(`addPaymentQr save: ${error.message}`)

  return next
}

export async function addGeneratedPaymentQr(
  tripId: string,
  label: string,
  qrData: string,
  bank: string,
): Promise<PaymentQr[]> {
  const current = await getPaymentQrs(tripId)
  const next = [...current, { label, uri: '', qrData, bank }]
  const { error } = await supabase.from(T.trips).update({ payment_qrs: next }).eq('id', tripId)
  if (error) throw new Error(`addGeneratedPaymentQr: ${error.message}`)
  return next
}

export async function removePaymentQr(tripId: string, index: number): Promise<PaymentQr[]> {
  const current = await getPaymentQrs(tripId)
  const next = current.filter((_, i) => i !== index)

  const { error } = await supabase
    .from(T.trips)
    .update({ payment_qrs: next })
    .eq('id', tripId)
  if (error) throw new Error(`removePaymentQr: ${error.message}`)

  return next
}

// ── Curated Lists (AI Recommendations via Edge Function) ───────────

export interface CuratedItem {
  name: string;
  reason: string;
  source_url?: string;
  rating?: number;
  price?: string;
  category?: string;
}

export async function getCuratedList(args: {
  destination: string;
  category: string;
  area?: string;
  hotelName?: string;
  count?: number;
}): Promise<{ items: CuratedItem[]; cached: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-recommend', {
      body: args,
    })
    if (error || !data?.items) return { items: [], cached: false }
    return data as { items: CuratedItem[]; cached: boolean }
  } catch {
    return { items: [], cached: false }
  }
}

// ---------- FLIGHTS ----------

export async function getFlights(tripId?: string): Promise<Flight[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.flights)
    .select('*')
    .eq('trip_id', id)

  if (error) throw new Error(`getFlights: ${error.message}`)
  return (data ?? []).map(mapFlight)
}

// ---------- GROUP MEMBERS ----------

export async function getGroupMembers(tripId?: string): Promise<GroupMember[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.groupMembers)
    .select('*')
    .eq('trip_id', id)

  if (error) throw new Error(`getGroupMembers: ${error.message}`)
  return (data ?? []).map(mapMember)
}

export async function updateMemberPhoto(memberId: string, localUri: string): Promise<void> {
  const compressed = await compressImage(localUri, 400, 0.5)
  const timestamp = Date.now()
  const filename = localUri.split('/').pop() ?? 'avatar.jpg'
  const storagePath = `avatars/${memberId}-${timestamp}-${filename}`

  const response = await fetch(compressed)
  const blob = await response.blob()
  const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'

  // Try avatars bucket first, fall back to moments bucket
  let publicUrl = ''
  const buckets = ['avatars', 'moments'] as const
  for (const bucket of buckets) {
    const path = bucket === 'avatars' ? storagePath : `avatars/${storagePath}`
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: true })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      publicUrl = urlData.publicUrl
      break
    }
    // If last bucket also fails, throw
    if (bucket === buckets[buckets.length - 1]) {
      throw new Error(`updateMemberPhoto upload: ${uploadError.message}`)
    }
  }

  const { error } = await supabase
    .from(T.groupMembers)
    .update({ avatar_url: publicUrl })
    .eq('id', memberId)
  if (error) throw new Error(`updateMemberPhoto: ${error.message}`)
}

export async function updateMemberEmail(memberId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from(T.groupMembers)
    .update({ email })
    .eq('id', memberId)
  if (error) throw new Error(`updateMemberEmail: ${error.message}`)
}

export async function updateMemberPhone(memberId: string, phone: string): Promise<void> {
  const { error } = await supabase
    .from(T.groupMembers)
    .update({ phone })
    .eq('id', memberId)
  if (error) throw new Error(`updateMemberPhone: ${error.message}`)
}

// ---------- PACKING ----------

export async function getPackingList(tripId?: string): Promise<PackingItem[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.packingItems)
    .select('*')
    .eq('trip_id', id)

  if (error) throw new Error(`getPackingList: ${error.message}`)
  return (data ?? []).map(mapPacking)
}

export async function addPackingItem(
  input: Omit<PackingItem, 'id' | 'packed'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.packingItems).insert({
    trip_id: id,
    name: input.item,
    category: input.category,
    is_packed: false,
    ...(input.owner ? { owner: input.owner } : {}),
  })
  if (error) throw new Error(`addPackingItem: ${error.message}`)
}

export async function togglePacked(itemId: string, packed: boolean): Promise<void> {
  const { error } = await supabase
    .from(T.packingItems)
    .update({ is_packed: packed })
    .eq('id', itemId)
  if (error) throw new Error(`togglePacked: ${error.message}`)
}

// ---------- EXPENSES ----------

export async function getExpenses(tripId?: string): Promise<Expense[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.expenses)
    .select('*')
    .eq('trip_id', id)
    .order('expense_date', { ascending: false })

  if (error) throw new Error(`getExpenses: ${error.message}`)
  return (data ?? []).map(mapExpense)
}

export async function addExpense(
  input: Omit<Expense, 'id'> & { tripId?: string; standalone?: boolean }
): Promise<void> {
  let tripId: string | null = null
  if (!input.standalone) {
    tripId = await resolveTripId(input.tripId)
  }

  const { data: authData } = await supabase.auth.getUser()

  const { error } = await supabase.from(T.expenses).insert({
    ...(tripId ? { trip_id: tripId } : {}),
    ...(input.standalone ? { user_id: authData?.user?.id } : {}),
    title: input.description,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    expense_date: input.date,
    ...(input.paidBy ? { paid_by: input.paidBy } : {}),
    ...(input.photo ? { photo_url: input.photo } : {}),
    ...(input.placeName ? { place_name: input.placeName } : {}),
    ...(input.placeLatitude != null ? { place_latitude: input.placeLatitude } : {}),
    ...(input.placeLongitude != null ? { place_longitude: input.placeLongitude } : {}),
    ...(input.splitType ? { split_type: input.splitType } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  })
  if (error) throw new Error(`addExpense: ${error.message}`)
}

export async function updateExpense(
  expenseId: string,
  input: Partial<Omit<Expense, 'id'>>
): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (input.description != null) updates.title = input.description
  if (input.amount != null) updates.amount = input.amount
  if (input.currency != null) updates.currency = input.currency
  if (input.category != null) updates.category = input.category
  if (input.date != null) updates.expense_date = input.date
  if (input.paidBy != null) updates.paid_by = input.paidBy
  if (input.photo != null) updates.photo_url = input.photo
  if (input.placeName != null) updates.place_name = input.placeName
  if (input.placeLatitude != null) updates.place_latitude = input.placeLatitude
  if (input.placeLongitude != null) updates.place_longitude = input.placeLongitude
  if (input.splitType != null) updates.split_type = input.splitType
  if (input.notes != null) updates.notes = input.notes

  const { error } = await supabase.from(T.expenses).update(updates).eq('id', expenseId)
  if (error) throw new Error(`updateExpense: ${error.message}`)
}

export async function deleteExpense(expenseId: string): Promise<void> {
  return deletePage(expenseId, T.expenses)
}

export async function getExpenseSummary(
  tripId?: string
): Promise<{ total: number; byCategory: Record<string, number>; count: number }> {
  const expenses = await getExpenses(tripId)
  const byCategory: Record<string, number> = {}
  let total = 0
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
    total += e.amount
  }
  return { total, byCategory, count: expenses.length }
}

// ---------- PLACES ----------

export async function getSavedPlaces(tripId?: string): Promise<Place[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.places)
    .select('*')
    .eq('trip_id', id)

  if (error) throw new Error(`getSavedPlaces: ${error.message}`)
  return (data ?? []).map(mapPlace)
}

export async function addPlace(
  input: Omit<Place, 'id'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.places).insert({
    trip_id: id,
    name: input.name,
    category: input.category,
    ...(input.distance ? { distance: input.distance } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.priceEstimate ? { price_estimate: input.priceEstimate } : {}),
    ...(input.rating != null ? { rating: input.rating } : {}),
    source: input.source,
    vote: input.vote,
    ...(input.photoUrl ? { photo_url: input.photoUrl } : {}),
    ...(input.googlePlaceId ? { google_place_id: input.googlePlaceId } : {}),
    ...(input.googleMapsUri ? { google_maps_uri: input.googleMapsUri } : {}),
    ...(input.totalRatings != null ? { total_ratings: input.totalRatings } : {}),
    ...(input.latitude != null ? { latitude: input.latitude } : {}),
    ...(input.longitude != null ? { longitude: input.longitude } : {}),
    saved: input.saved ?? true,
  })
  if (error) throw new Error(`addPlace: ${error.message}`)
}

export async function voteOnPlace(placeId: string, vote: PlaceVote): Promise<void> {
  const { error } = await supabase
    .from(T.places)
    .update({ vote })
    .eq('id', placeId)
  if (error) throw new Error(`voteOnPlace: ${error.message}`)
}

export async function savePlace(placeId: string, saved: boolean): Promise<void> {
  const { error } = await supabase
    .from(T.places)
    .update({ saved })
    .eq('id', placeId)
  if (error) throw new Error(`savePlace: ${error.message}`)
}

// ---------- GROUP VOTING ----------

/** Derive consensus vote from per-member votes. Strict majority wins; equal splits stay Pending. */
export function deriveConsensus(
  votes: Record<string, PlaceVote>,
  totalMembers: number,
): PlaceVote {
  const entries = Object.values(votes)
  const yes = entries.filter((v) => v === '👍 Yes').length
  const no = entries.filter((v) => v === '👎 No').length
  // Equal split = tie (Pending), not a Yes win
  if (yes === no && yes > 0) return 'Pending'
  const majority = Math.ceil(totalMembers / 2)
  if (yes >= majority) return '👍 Yes'
  if (no >= majority) return '👎 No'
  return 'Pending'
}

/**
 * Cast a vote as a specific group member. Updates vote_by_member JSONB
 * and derives the consensus vote field.
 */
export async function voteAsMember(
  placeId: string,
  memberId: string,
  vote: PlaceVote,
  totalMembers: number,
): Promise<Record<string, PlaceVote>> {
  // Read current votes
  const { data, error: readErr } = await supabase
    .from(T.places)
    .select('vote_by_member')
    .eq('id', placeId)
    .single()
  if (readErr) throw new Error(`voteAsMember read: ${readErr.message}`)

  const current = (data?.vote_by_member as Record<string, PlaceVote>) ?? {}
  const updated = { ...current, [memberId]: vote }
  const consensus = deriveConsensus(updated, totalMembers)

  const { error: writeErr } = await supabase
    .from(T.places)
    .update({ vote_by_member: updated, vote: consensus })
    .eq('id', placeId)
  if (writeErr) throw new Error(`voteAsMember write: ${writeErr.message}`)

  return updated
}

/** Subscribe to vote changes on places for a trip. Returns unsubscribe function. */
export function subscribeToPlaceVotes(
  tripId: string,
  onUpdate: (placeId: string, voteByMember: Record<string, PlaceVote>, vote: PlaceVote) => void,
): () => void {
  const channelName = `place-votes:${tripId}`

  // Remove any existing channel with the same name to avoid duplicate subscription error
  const existing = supabase.getChannels().find((ch) => ch.topic === `realtime:${channelName}`)
  if (existing) supabase.removeChannel(existing)

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'places',
        filter: `trip_id=eq.${tripId}`,
      },
      (payload: any) => {
        const row = payload.new
        if (row.vote_by_member) {
          onUpdate(
            row.id,
            row.vote_by_member as Record<string, PlaceVote>,
            (row.vote as PlaceVote) ?? 'Pending',
          )
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

/** Notify all group members (except the recommender) that a place needs votes. */
export async function notifyGroupOfRecommendation(
  tripId: string,
  placeName: string,
  placeId: string,
  recommenderName: string,
  recommenderUserId: string,
): Promise<void> {
  try {
    const members = await getGroupMembers(tripId)
    const targets = members.filter(
      (m) => m.userId && m.userId !== recommenderUserId,
    )
    if (targets.length === 0) return

    const rows = targets.map((m) => ({
      user_id: m.userId,
      type: 'vote_needed',
      title: `${recommenderName} recommends ${placeName}`,
      body: 'Tap to vote — should the group visit this place?',
      data: { tripId, placeId, placeName, recommenderName },
      read: false,
    }))

    await supabase.from('notifications').insert(rows)
  } catch {
    // Notifications table might not exist yet — silently ignore
  }
}

// ---------- ROCK PAPER SCISSORS TIEBREAKER ----------

export type RPSMove = 'rock' | 'paper' | 'scissors'
export type RPSGameStatus = 'playing' | 'settled'

export interface RPSGameState {
  status: RPSGameStatus
  moves: Record<string, RPSMove>    // memberId → move
  winner?: string                   // memberId of winner
  winnerVote?: PlaceVote            // the vote that wins
  round: number
}

/** Determine RPS winner between two moves. Returns 1 if a wins, -1 if b wins, 0 if tie. */
function rpsResult(a: RPSMove, b: RPSMove): number {
  if (a === b) return 0
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) return 1
  return -1
}

/** Resolve RPS game: find winner among all moves. Returns winnerId or null if tie. */
function resolveRps(
  moves: Record<string, RPSMove>,
  memberVotes: Record<string, PlaceVote>,
): { winnerId: string | null; winnerVote: PlaceVote | null } {
  const ids = Object.keys(moves)
  if (ids.length < 2) return { winnerId: null, winnerVote: null }

  // For 2 players: direct comparison
  if (ids.length === 2) {
    const result = rpsResult(moves[ids[0]], moves[ids[1]])
    if (result === 0) return { winnerId: null, winnerVote: null }
    const winnerId = result === 1 ? ids[0] : ids[1]
    return { winnerId, winnerVote: memberVotes[winnerId] ?? '👍 Yes' }
  }

  // For 3+ players: count unique moves. If all same or all different → tie.
  const uniqueMoves = new Set(Object.values(moves))
  if (uniqueMoves.size === 1 || uniqueMoves.size === 3) {
    return { winnerId: null, winnerVote: null }
  }
  // Exactly 2 unique moves: the winning move beats the losing move
  const moveArr = Array.from(uniqueMoves) as RPSMove[]
  const winningMove = rpsResult(moveArr[0], moveArr[1]) === 1 ? moveArr[0] : moveArr[1]
  // Winners are all players who picked the winning move
  const winners = ids.filter((id) => moves[id] === winningMove)
  // Pick the first winner (deterministic)
  const winnerId = winners[0]
  return { winnerId, winnerVote: memberVotes[winnerId] ?? '👍 Yes' }
}

/** Start or join an RPS game for a tied place. */
export async function submitRpsMove(
  placeId: string,
  memberId: string,
  move: RPSMove,
  totalMembers: number,
  memberVotes: Record<string, PlaceVote>,
): Promise<RPSGameState> {
  // Read current game state
  const { data, error: readErr } = await supabase
    .from(T.places)
    .select('rps_game_state')
    .eq('id', placeId)
    .single()
  if (readErr) throw new Error(`submitRpsMove read: ${readErr.message}`)

  const current: RPSGameState = data?.rps_game_state ?? {
    status: 'playing',
    moves: {},
    round: 1,
  }

  // Add this member's move
  const updatedMoves = { ...current.moves, [memberId]: move }
  const allIn = Object.keys(updatedMoves).length >= totalMembers

  let newState: RPSGameState

  if (allIn) {
    // Resolve the game
    const { winnerId, winnerVote } = resolveRps(updatedMoves, memberVotes)
    if (winnerId && winnerVote) {
      newState = {
        status: 'settled',
        moves: updatedMoves,
        winner: winnerId,
        winnerVote,
        round: current.round,
      }
      // Update the place vote to the winner's vote
      await supabase
        .from(T.places)
        .update({
          rps_game_state: newState,
          vote: winnerVote,
        })
        .eq('id', placeId)
    } else {
      // Tie in RPS — reset for another round
      newState = {
        status: 'playing',
        moves: {},
        round: current.round + 1,
      }
      await supabase
        .from(T.places)
        .update({ rps_game_state: newState })
        .eq('id', placeId)
    }
  } else {
    // Still waiting for others
    newState = { ...current, moves: updatedMoves }
    await supabase
      .from(T.places)
      .update({ rps_game_state: newState })
      .eq('id', placeId)
  }

  return newState
}

/** Subscribe to RPS game state changes on a specific place. */
export function subscribeToPlaceRps(
  placeId: string,
  onUpdate: (state: RPSGameState | null) => void,
): () => void {
  const channel = supabase
    .channel(`place-rps:${placeId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'places',
        filter: `id=eq.${placeId}`,
      },
      (payload: any) => {
        onUpdate(payload.new.rps_game_state ?? null)
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

/** Reset RPS game state for a place (for revote). */
export async function resetRpsGame(placeId: string): Promise<void> {
  await supabase
    .from(T.places)
    .update({ rps_game_state: null, vote: 'Pending' })
    .eq('id', placeId)
}

// ---------- NOTIFICATION HELPERS ----------

/** Generic notification insert — all specific notifiers delegate to this. */
async function insertNotification(opts: {
  userId: string
  tripId: string
  type: string
  title: string
  body: string
  data?: Record<string, any>
}): Promise<void> {
  try {
    // Check user's notification preferences before inserting
    const { shouldNotify } = await import('@/lib/notificationPrefs')
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', opts.userId)
      .single()
    const prefs = (profile?.notification_prefs as Record<string, unknown>) ?? {}

    // Fetch trip dates for phase check
    let tripStart: string | undefined
    let tripEnd: string | undefined
    if (opts.tripId) {
      const { data: tripRow } = await supabase
        .from(T.trips)
        .select('start_date, end_date')
        .eq('id', opts.tripId)
        .single()
      tripStart = tripRow?.start_date as string | undefined
      tripEnd = tripRow?.end_date as string | undefined
    }

    if (!shouldNotify(opts.type, prefs, {
      tripId: opts.tripId,
      tripStartDate: tripStart,
      tripEndDate: tripEnd,
    })) {
      return // User has suppressed this notification category/phase/trip
    }

    const { error: insertErr } = await supabase.from('notifications').insert({
      user_id: opts.userId,
      trip_id: opts.tripId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: { ...opts.data, type: opts.type },
      read: false,
    })
    if (insertErr && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[insertNotification] failed:', insertErr.message)
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[insertNotification] error:', err)
    }
  }
}

/** Notify all trip members of a lifecycle event. Respects transport/group gates. */
async function notifyAllMembers(
  tripId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  excludeUserId?: string,
): Promise<void> {
  const members = await getGroupMembers(tripId)
  const targets = members.filter((m) => m.userId && m.userId !== excludeUserId)
  for (const m of targets) {
    await insertNotification({
      userId: m.userId!,
      tripId,
      type,
      title,
      body,
      data,
    })
  }
}

/** Notify members that a new expense was added (group trips only, 2+ members). */
export async function notifyExpenseAdded(
  tripIdOrEmpty: string,
  expense: { description: string; amount: number; paidBy: string; currency?: string },
  addedByUserId: string,
): Promise<void> {
  try {
    const tripId = await resolveTripId(tripIdOrEmpty || undefined)
    const members = await getGroupMembers(tripId)
    if (members.length < 2) return
    const currency = expense.currency ?? 'PHP'
    await notifyAllMembers(
      tripId,
      'expense_added',
      `${expense.paidBy} added an expense`,
      `${expense.description} — ${currency} ${expense.amount.toLocaleString()}`,
      { expenseDescription: expense.description, amount: expense.amount },
      addedByUserId,
    )
  } catch { /* best-effort */ }
}

/** Notify existing members when someone joins the trip. */
export async function notifyMemberJoined(
  tripId: string,
  memberName: string,
  joinerUserId: string,
): Promise<void> {
  try {
    await notifyAllMembers(
      tripId,
      'member_joined',
      `${memberName} joined the trip!`,
      'Your travel group just grew. Say hello!',
      { memberName },
      joinerUserId,
    )
  } catch { /* best-effort */ }
}

/** Notify trip members when projected spend exceeds budget. Daily dedup via type+date check. */
export async function notifyBudgetThreshold(
  tripId: string,
  projected: number,
  budget: number,
  currency: string,
): Promise<void> {
  try {
    // Dedup: don't send more than once per day
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('trip_id', tripId)
      .eq('type', 'budget_threshold')
      .gte('created_at', today)
      .limit(1)
    if (existing && existing.length > 0) return

    const diff = Math.round(projected - budget)
    const members = await getGroupMembers(tripId)
    for (const m of members) {
      if (!m.userId) continue
      await insertNotification({
        userId: m.userId,
        tripId,
        type: 'budget_threshold',
        title: 'Budget alert',
        body: `Projected ${currency} ${Math.round(projected).toLocaleString()} — ${currency} ${diff.toLocaleString()} over budget`,
        data: { projected, budget },
      })
    }
  } catch { /* best-effort */ }
}

// ---------- CHECKLIST ----------

export async function getChecklist(tripId?: string): Promise<ChecklistItem[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.checklist)
    .select('*')
    .eq('trip_id', id)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`getChecklist: ${error.message}`)
  return (data ?? []).map(mapChecklist)
}

// ---------- MOMENTS ----------

export async function getMoments(tripId?: string): Promise<Moment[]> {
  const id = await resolveTripId(tripId)

  // Fetch all moments for the trip — RLS enforces trip membership.
  // Filter client-side for visibility so we don't break on PostgREST syntax edge cases.
  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('trip_id', id)
    .order('taken_at', { ascending: false })

  if (error) throw new Error(`getMoments: ${error.message}`)

  // Client-side visibility filter: show shared + legacy (null user_id) + own private/album
  const { data: { user: authUser } } = await supabase.auth.getUser()
  const uid = authUser?.id
  const filtered = (data ?? []).filter((row) => {
    const vis = (row.visibility as string) ?? 'shared'
    if (vis === 'shared') return true
    if (row.user_id == null) return true  // Legacy moments without user_id
    if (uid && row.user_id === uid) return true  // Own private/album moments
    return false
  })

  return filtered.map(mapMoment)
}

// Build a human-readable filename for moment photos.
// e.g. "sunset-white-beach-apr20-a3f1.jpg" instead of "1745123456789-IMG_20260420.jpg"
const MOMENT_NAME_POOL = [
  'golden-hour', 'island-vibes', 'travel-snap', 'on-the-go',
  'good-times', 'wander', 'explore', 'memory', 'getaway', 'escape',
] as const;

function buildMomentFilename(
  input: { tags: string[]; location?: string; date: string; caption?: string },
  ext: string,
): string {
  const parts: string[] = [];

  // Use first tag if available, otherwise pick from pool
  if (input.tags.length > 0) {
    parts.push(input.tags[0].toLowerCase());
  } else if (input.caption && input.caption !== 'Untitled') {
    // Use first word of caption
    const word = input.caption.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (word.length >= 2) parts.push(word);
  }
  if (parts.length === 0) {
    parts.push(MOMENT_NAME_POOL[Math.floor(Math.random() * MOMENT_NAME_POOL.length)]);
  }

  // Add short location slug
  if (input.location) {
    const slug = input.location.split(',')[0].trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
    if (slug) parts.push(slug);
  }

  // Add date as "apr20" format
  const d = new Date(input.date + 'T00:00:00+08:00');
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  parts.push(`${months[d.getMonth()]}${d.getDate()}`);

  // Short random suffix for uniqueness
  const rand = Math.random().toString(36).slice(2, 6);
  parts.push(rand);

  return `${parts.join('-')}.${ext}`;
}

export async function addMoment(
  input: Omit<Moment, 'id'> & { tripId?: string; localUri?: string }
): Promise<void> {
  const tripId = await resolveTripId(input.tripId)

  let storagePath: string | undefined
  let publicUrl: string | undefined
  let hdUrl: string | undefined

  // If a local file URI is provided, compress and upload to Supabase Storage.
  if (input.localUri) {
    const rawExt = (input.localUri.split('.').pop() ?? 'jpg').toLowerCase()
    const isVideo = ['mp4', 'mov', 'avi', 'webm', 'm4v'].includes(rawExt)
    const ext = isVideo ? rawExt : 'jpeg'
    const friendlyName = buildMomentFilename(input, ext)
    const contentType = guessMimeType(friendlyName)

    // Helper: compress → read bytes → upload
    const uploadFile = async (uri: string, path: string) => {
      const bytes = await readFileAsBytes(uri)
      const { error: uploadError } = await supabase.storage
        .from('moments')
        .upload(path, bytes, { contentType, upsert: false })
      if (uploadError) throw new Error(`addMoment upload: ${uploadError.message}`)
      const { data: urlData } = supabase.storage.from('moments').getPublicUrl(path)
      return urlData.publicUrl
    }

    // Standard version (800px, 70% quality) — used for thumbnails + lightbox
    const standardFile = isVideo ? input.localUri : await compressImage(input.localUri, 800, 0.7)
    storagePath = `trips/${tripId}/${friendlyName}`
    publicUrl = await uploadFile(standardFile, storagePath)

    // HD version (1920px, 85% quality) — for download/share
    if (!isVideo) {
      try {
        const hdFile = await compressImage(input.localUri, 1920, 0.85)
        const hdPath = `trips/${tripId}/hd/${friendlyName}`
        hdUrl = await uploadFile(hdFile, hdPath)
      } catch {
        // HD upload failed — standard version still works
      }
    }
  } else if (input.photo) {
    // Photo is already a remote URL (e.g. from Notion migration).
    publicUrl = input.photo
  }

  // Get current user for proper attribution
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const row: Record<string, unknown> = {
    trip_id: tripId,
    caption: input.caption || '',
    ...(storagePath ? { storage_path: storagePath } : {}),
    ...(publicUrl ? { public_url: publicUrl } : {}),
    ...(hdUrl ? { hd_url: hdUrl } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.takenBy ? { uploaded_by: input.takenBy } : {}),
    ...(authUser?.id ? { user_id: authUser.id } : {}),
    taken_at: input.date,
    ...(input.tags.length > 0 ? { tags: input.tags } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
  }

  const { error } = await supabase.from(T.moments).insert(row)
  if (error) {
    // Retry without hd_url in case column doesn't exist yet
    if (hdUrl && error.message.includes('hd_url')) {
      delete row.hd_url
      const { error: retryError } = await supabase.from(T.moments).insert(row)
      if (retryError) throw new Error(`addMoment insert: ${retryError.message}`)
    } else {
      throw new Error(`addMoment insert: ${error.message}`)
    }
  }
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'heic':
      return 'image/heic'
    case 'mp4':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    default:
      return 'image/jpeg'
  }
}

// ---------- MOMENT FAVORITES ----------

export interface MomentFavoriteMap {
  [momentId: string]: { count: number; userIds: string[] }
}

/** Fetch all favorites for moments in a trip, keyed by moment ID. */
export async function getMomentFavorites(tripId?: string): Promise<MomentFavoriteMap> {
  const id = await resolveTripId(tripId)
  // Get all moment IDs for this trip, then their favorites
  const { data: moments } = await supabase
    .from(T.moments)
    .select('id')
    .eq('trip_id', id)
  if (!moments || moments.length === 0) return {}

  const momentIds = moments.map((m) => m.id as string)
  const { data: favs } = await supabase
    .from('moment_favorites')
    .select('moment_id, user_id')
    .in('moment_id', momentIds)

  const result: MomentFavoriteMap = {}
  for (const f of favs ?? []) {
    const mid = f.moment_id as string
    if (!result[mid]) result[mid] = { count: 0, userIds: [] }
    result[mid].count++
    result[mid].userIds.push(f.user_id as string)
  }
  return result
}

/** Toggle favorite on a moment. Returns true if now favorited, false if unfavorited. */
export async function toggleFavorite(momentId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('toggleFavorite: not authenticated')

  // Check if already favorited
  const { data: existing } = await supabase
    .from('moment_favorites')
    .select('id')
    .eq('moment_id', momentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('moment_favorites').delete().eq('id', existing.id)
    return false
  }

  const { error } = await supabase.from('moment_favorites').insert({
    moment_id: momentId,
    user_id: user.id,
  })
  if (error) throw new Error(`toggleFavorite: ${error.message}`)
  return true
}

/** Batch-favorite multiple moments. */
export async function batchFavorite(momentIds: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || momentIds.length === 0) return

  // Get existing favorites to avoid duplicates
  const { data: existing } = await supabase
    .from('moment_favorites')
    .select('moment_id')
    .eq('user_id', user.id)
    .in('moment_id', momentIds)

  const alreadyFaved = new Set((existing ?? []).map((e) => e.moment_id as string))
  const toInsert = momentIds
    .filter((id) => !alreadyFaved.has(id))
    .map((id) => ({ moment_id: id, user_id: user.id }))

  if (toInsert.length > 0) {
    await supabase.from('moment_favorites').insert(toInsert)
  }
}

/** Toggle moment visibility between shared and private. Only works on own moments. */
export async function toggleMomentVisibility(momentId: string): Promise<'shared' | 'private'> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('toggleMomentVisibility: not authenticated')

  const { data: moment } = await supabase
    .from(T.moments)
    .select('visibility, user_id')
    .eq('id', momentId)
    .single()

  if (!moment) throw new Error('toggleMomentVisibility: moment not found')
  // Allow toggle if: own moment OR legacy moment (no user_id — pre-migration)
  const momentUserId = moment.user_id as string | null
  if (momentUserId && momentUserId !== user.id) {
    throw new Error('toggleMomentVisibility: can only toggle own moments')
  }

  const newVisibility = (moment.visibility as string) === 'shared' ? 'private' : 'shared'
  const { error } = await supabase
    .from(T.moments)
    .update({ visibility: newVisibility })
    .eq('id', momentId)

  if (error) throw new Error(`toggleMomentVisibility: ${error.message}`)
  return newVisibility as 'shared' | 'private'
}

/** Get moments favorited by 2+ group members (group highlights). */
export async function getGroupHighlights(tripId?: string): Promise<Moment[]> {
  const id = await resolveTripId(tripId)
  const favorites = await getMomentFavorites(id)

  // Filter to moments with 2+ favorites
  const highlightIds = Object.entries(favorites)
    .filter(([, v]) => v.count >= 2)
    .map(([momentId]) => momentId)

  if (highlightIds.length === 0) return []

  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .in('id', highlightIds)
    .eq('visibility', 'shared')
    .order('taken_at', { ascending: false })

  if (error) throw new Error(`getGroupHighlights: ${error.message}`)
  return (data ?? []).map(mapMoment)
}

/** Notify trip members that new moments were added. */
export async function notifyMomentsAdded(
  tripId: string,
  uploaderName: string,
  uploaderUserId: string,
  count: number,
  dayLabel?: string,
): Promise<void> {
  const title = `${uploaderName} added ${count} photo${count > 1 ? 's' : ''}`
  const body = dayLabel
    ? `New moments from ${dayLabel}`
    : 'New moments added to the trip album'
  await notifyAllMembers(tripId, 'moments_added', title, body, { count }, uploaderUserId)
}

// ---------- ALBUMS ----------

/** Create a custom album for a trip. */
export async function createAlbum(opts: {
  tripId?: string;
  name: string;
  members: { userId: string; role: AlbumMemberRole }[];
  hideFromMosaic?: boolean;
  autoRevealAt?: string;
}): Promise<Album> {
  const tripId = await resolveTripId(opts.tripId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('createAlbum: not authenticated')

  const { data, error } = await supabase.from('albums').insert({
    trip_id: tripId,
    name: opts.name,
    owner_id: user.id,
    hide_from_mosaic: opts.hideFromMosaic ?? false,
    auto_reveal_at: opts.autoRevealAt ?? null,
  }).select('*').single()

  if (error || !data) throw new Error(`createAlbum: ${error?.message}`)

  // Add owner as member
  const memberRows = [
    { album_id: data.id, user_id: user.id, role: 'owner' as const },
    ...opts.members
      .filter((m) => m.userId !== user.id)
      .map((m) => ({ album_id: data.id, user_id: m.userId, role: m.role })),
  ]
  if (memberRows.length > 0) {
    await supabase.from('album_members').insert(memberRows)
  }

  return {
    id: data.id as string,
    tripId,
    name: data.name as string,
    ownerId: user.id,
    hideFromMosaic: !!data.hide_from_mosaic,
    autoRevealAt: (data.auto_reveal_at as string) ?? undefined,
    memberCount: memberRows.length,
    momentCount: 0,
    createdAt: data.created_at as string,
  }
}

/** List all albums for a trip. */
export async function getAlbums(tripId?: string): Promise<Album[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .eq('trip_id', id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getAlbums: ${error.message}`)

  const albums: Album[] = []
  for (const row of data ?? []) {
    // Get member + moment counts
    const { count: memberCount } = await supabase
      .from('album_members')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', row.id)

    const { count: momentCount } = await supabase
      .from('album_moments')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', row.id)

    // Get cover URL if set
    let coverUrl: string | undefined
    if (row.cover_moment_id) {
      const { data: coverRow } = await supabase
        .from(T.moments).select('public_url, storage_path')
        .eq('id', row.cover_moment_id).single()
      if (coverRow) coverUrl = momentPhotoUrl(coverRow)
    }

    albums.push({
      id: row.id as string,
      tripId: id,
      name: row.name as string,
      coverMomentId: (row.cover_moment_id as string) ?? undefined,
      coverUrl,
      ownerId: row.owner_id as string,
      hideFromMosaic: !!row.hide_from_mosaic,
      autoRevealAt: (row.auto_reveal_at as string) ?? undefined,
      memberCount: memberCount ?? 0,
      momentCount: momentCount ?? 0,
      createdAt: row.created_at as string,
    })
  }
  return albums
}

/** Get album detail with members. */
export async function getAlbumMembers(albumId: string): Promise<AlbumMember[]> {
  const { data, error } = await supabase
    .from('album_members')
    .select('*')
    .eq('album_id', albumId)

  if (error) throw new Error(`getAlbumMembers: ${error.message}`)

  const members: AlbumMember[] = []
  for (const row of data ?? []) {
    // Resolve member name/avatar from group_members or profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', row.user_id)
      .single()

    const { count } = await supabase
      .from('album_moments')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', albumId)
      .eq('added_by', row.user_id)

    members.push({
      id: row.id as string,
      userId: row.user_id as string,
      name: (profile?.full_name as string) ?? 'Unknown',
      avatar: (profile?.avatar_url as string) ?? undefined,
      role: (row.role as string) as AlbumMemberRole,
      momentCount: count ?? 0,
    })
  }
  return members
}

/** Add moments to an album. */
export async function addMomentsToAlbum(albumId: string, momentIds: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || momentIds.length === 0) return

  const rows = momentIds.map((mid) => ({
    album_id: albumId,
    moment_id: mid,
    added_by: user.id,
  }))
  const { error } = await supabase.from('album_moments').upsert(rows, { onConflict: 'album_id,moment_id' })
  if (error) throw new Error(`addMomentsToAlbum: ${error.message}`)
}

/** Get moments in an album. */
export async function getAlbumMoments(albumId: string): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('album_moments')
    .select('moment_id')
    .eq('album_id', albumId)

  if (error || !data || data.length === 0) return []

  const momentIds = data.map((r) => r.moment_id as string)
  const { data: moments, error: mError } = await supabase
    .from(T.moments)
    .select('*')
    .in('id', momentIds)
    .order('taken_at', { ascending: false })

  if (mError) throw new Error(`getAlbumMoments: ${mError.message}`)
  return (moments ?? []).map(mapMoment)
}

/** Get moments added since user's last view (for pending intake). */
export async function getPendingMoments(tripId?: string): Promise<{ moments: Moment[]; count: number }> {
  const id = await resolveTripId(tripId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { moments: [], count: 0 }

  // Get last viewed timestamp
  const { data: viewRow } = await supabase
    .from('moment_views')
    .select('last_viewed_at')
    .eq('user_id', user.id)
    .eq('trip_id', id)
    .single()

  const lastViewed = viewRow?.last_viewed_at as string | undefined

  let query = supabase
    .from(T.moments)
    .select('*')
    .eq('trip_id', id)
    .eq('visibility', 'shared')
    .neq('user_id', user.id)
    .order('taken_at', { ascending: false })

  if (lastViewed) {
    query = query.gt('created_at', lastViewed)
  }

  const { data, error } = await query
  if (error) return { moments: [], count: 0 }

  return {
    moments: (data ?? []).map(mapMoment),
    count: (data ?? []).length,
  }
}

/** Mark moments as viewed (updates last_viewed_at). */
export async function markMomentsViewed(tripId?: string): Promise<void> {
  const id = await resolveTripId(tripId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('moment_views').upsert({
    user_id: user.id,
    trip_id: id,
    last_viewed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,trip_id' })
}

/** Batch promote moments from private to shared (group). */
export async function promoteMomentsToGroup(momentIds: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || momentIds.length === 0) return

  const { error } = await supabase
    .from(T.moments)
    .update({ visibility: 'shared' })
    .in('id', momentIds)
    .eq('user_id', user.id) // Can only promote own moments

  if (error) throw new Error(`promoteMomentsToGroup: ${error.message}`)
}

// ---------- TRIP FILES ----------

export async function getTripFiles(tripId?: string): Promise<TripFile[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.tripFiles)
    .select('*')
    .eq('trip_id', id)

  if (error) throw new Error(`getTripFiles: ${error.message}`)
  return (data ?? []).map(mapTripFile)
}

export async function addTripFile(
  input: Omit<TripFile, 'id'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.tripFiles).insert({
    trip_id: id,
    name: input.fileName,
    ...(input.fileUrl ? { file_url: input.fileUrl } : {}),
    file_type: input.type,
    ...(input.notes ? { description: input.notes } : {}),
    print_required: input.printRequired,
  })
  if (error) throw new Error(`addTripFile: ${error.message}`)
}

// ---------- GENERIC DELETE ----------

/**
 * Delete a row by ID.
 *
 * When called with one argument (the old `deletePage(pageId)` signature),
 * we try all tables sequentially until one succeeds. When called with a
 * second argument specifying the table, we delete directly.
 */
const ALL_TABLES = [
  T.expenses,
  T.flights,
  T.groupMembers,
  T.packingItems,
  T.places,
  T.checklist,
  T.moments,
  T.tripFiles,
] as const

export async function deletePage(
  rowId: string,
  table?: string
): Promise<void> {
  if (table) {
    const { error } = await supabase.from(table).delete().eq('id', rowId)
    if (error) throw new Error(`deletePage(${table}): ${error.message}`)
    return
  }

  // Fallback: try each table. Supabase deletes return count 0 when no row
  // matches, so we look for an actual deletion.
  for (const t of ALL_TABLES) {
    const { error, count } = await supabase
      .from(t)
      .delete({ count: 'exact' })
      .eq('id', rowId)
    if (!error && count && count > 0) return
  }

  throw new Error(`deletePage: no row found with id ${rowId} in any table.`)
}

// ---------- PROFILES ----------

export interface ProfileSocials {
  instagram?: string;
  tiktok?: string;
  x?: string;
  facebook?: string;
}

export interface Profile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  handle?: string;
  socials?: ProfileSocials;
  tier: UserTier;
  tripCount: number;
  completedTripCount: number;
  lastTripId?: string;
  onboardedAt?: string;
  userSegment: UserSegment;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    fullName: data.full_name ?? '',
    avatarUrl: data.avatar_url ?? undefined,
    phone: data.phone ?? undefined,
    handle: data.handle ?? undefined,
    socials: (data.socials as ProfileSocials) ?? undefined,
    tier: (data.tier as UserTier) ?? 'free',
    tripCount: (data.trip_count as number) ?? 0,
    completedTripCount: (data.completed_trip_count as number) ?? 0,
    lastTripId: (data.last_trip_id as string) ?? undefined,
    onboardedAt: (data.onboarded_at as string) ?? undefined,
    userSegment: (data.user_segment as UserSegment) ?? 'new',
  }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id'>>
): Promise<void> {
  const row: Record<string, unknown> = { id: userId }
  // Always include fields that are passed — even empty strings — so they persist
  if (updates.fullName !== undefined) row.full_name = updates.fullName
  if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl || null
  if (updates.phone !== undefined) row.phone = updates.phone || null
  if (updates.handle !== undefined) row.handle = updates.handle || null
  if (updates.socials !== undefined) row.socials = updates.socials
  if (updates.onboardedAt !== undefined) row.onboarded_at = updates.onboardedAt
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(`updateProfile: ${error.message}`)
}

export async function isHandleAvailable(handle: string, currentUserId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('handle', handle)
    .neq('id', currentUserId)
    .limit(1)
  return !data || data.length === 0
}

export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string> {
  const compressed = await compressImage(localUri, 400, 0.5)
  const timestamp = Date.now()
  const filename = localUri.split('/').pop() ?? 'avatar.jpg'
  const storagePath = `profiles/${userId}-${timestamp}-${filename}`

  const bytes = await readFileAsBytes(compressed)
  const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'

  const buckets = ['avatars', 'moments'] as const
  for (const bucket of buckets) {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, { contentType, upsert: true })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
      const publicUrl = urlData.publicUrl
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      return publicUrl
    }
    if (bucket === buckets[buckets.length - 1]) {
      throw new Error(`uploadProfilePhoto: ${uploadError.message}`)
    }
  }
  throw new Error('uploadProfilePhoto: no bucket available')
}

export async function ensureProfile(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    { id: userId, full_name: name },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error && !error.message.includes('duplicate')) {
    throw new Error(`ensureProfile: ${error.message}`)
  }
}

// ---------- LIFETIME STATS & HIGHLIGHTS ----------

export async function getLifetimeStats(userId: string): Promise<LifetimeStats | null> {
  const { data } = await supabase
    .from('lifetime_stats')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (!data) return null
  return {
    totalTrips: data.total_trips,
    totalCountries: data.total_countries,
    totalNights: data.total_nights,
    totalMiles: data.total_miles,
    totalSpent: data.total_spent,
    homeCurrency: data.home_currency,
    totalMoments: data.total_moments,
    countriesList: data.countries_list ?? [],
    earliestTripDate: data.earliest_trip_date,
  }
}

export async function getHighlights(userId: string): Promise<Highlight[]> {
  const { data } = await supabase
    .from('highlights')
    .select('*')
    .eq('user_id', userId)
    .order('rank')
  if (!data) return []
  return data.map((h): Highlight => ({
    id: h.id as string,
    type: h.type as HighlightType,
    displayText: h.display_text as string,
    supportingData: (h.supporting_data as Record<string, unknown>) ?? undefined,
    rank: h.rank as number,
  }))
}

export async function getPastTrips(userId: string): Promise<Trip[]> {
  let uid = userId
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser()
    uid = authData?.user?.id ?? ''
  }
  if (!uid) return []

  // Owned trips
  const { data: owned } = await supabase
    .from(T.trips)
    .select('*')
    .eq('user_id', uid)
    .or('is_past_import.eq.true,status.eq.Completed')
    .order('start_date', { ascending: false })

  // Member trips (covers legacy NULL user_id)
  const { data: memberTrips } = await supabase
    .from(T.trips)
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', uid)
    .or('is_past_import.eq.true,status.eq.Completed')
    .order('start_date', { ascending: false })

  const allRows = [...(owned ?? []), ...(memberTrips ?? [])]
  const seen = new Set<string>()
  const data = allRows.filter((r) => {
    const id = r.id as string
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  if (!data.length) return []
  return data.map((r) => mapTrip(r as Record<string, unknown>))
}

export async function getAllUserTrips(userId?: string, includeDeleted = false): Promise<Trip[]> {
  let uid = userId
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser()
    uid = authData?.user?.id
  }
  if (!uid) {
    console.warn('[getAllUserTrips] No user ID available')
    return []
  }

  // Fetch trips owned by user OR where user is a trip member (covers legacy NULL user_id trips)
  const ownedQuery = supabase
    .from(T.trips)
    .select('*')
    .eq('user_id', uid)
    .order('start_date', { ascending: false })

  const memberQuery = supabase
    .from(T.trips)
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', uid)
    .order('start_date', { ascending: false })

  const { data: ownedTrips, error: ownedError } = await ownedQuery
  const { data: memberTrips, error: memberError } = await memberQuery

  if (ownedError) {
    console.error('[getAllUserTrips] ownedQuery error:', ownedError)
    throw new Error(`Owned trips fetch failed: ${ownedError.message}`)
  }
  if (memberError) {
    console.error('[getAllUserTrips] memberQuery error:', memberError)
    throw new Error(`Member trips fetch failed: ${memberError.message}`)
  }

  // Merge and deduplicate by id
  const allRows = [...(ownedTrips ?? []), ...(memberTrips ?? [])]
  const seen = new Set<string>()
  const unique = allRows.filter((r) => {
    const id = r.id as string
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  // Filter soft-deleted in JS (deleted_at column may not exist in DB)
  const result = includeDeleted
    ? unique
    : unique.filter((r) => !r.deleted_at)

  console.log(`[getAllUserTrips] User ${uid.slice(0, 8)}: ${result.length} trips (${ownedTrips?.length ?? 0} owned, ${memberTrips?.length ?? 0} member)`)
  return result.map((r) => mapTrip(r as Record<string, unknown>))
}

/** Active trips: Planning or Active, not draft, not deleted, not archived */
export async function getActiveTrips(userId?: string): Promise<Trip[]> {
  const all = await getAllUserTrips(userId)
  return all.filter(t =>
    (t.status === 'Planning' || t.status === 'Active') &&
    !t.isDraft &&
    !t.deletedAt &&
    !t.archivedAt
  )
}

/** Draft trips: incomplete onboarding drafts */
export async function getDraftTrips(userId?: string): Promise<Trip[]> {
  const all = await getAllUserTrips(userId)
  return all.filter(t =>
    t.isDraft === true &&
    !t.deletedAt
  )
}

/** Archived trips */
export async function getArchivedTrips(userId?: string): Promise<Trip[]> {
  const all = await getAllUserTrips(userId)
  return all.filter(t =>
    t.archivedAt != null &&
    !t.deletedAt
  )
}

// ---------- TRIP LIFECYCLE ----------

/** Mark a trip as Completed (finish early or natural end). */
export async function finishTrip(tripId: string): Promise<void> {
  // Snapshot expense total and nights onto the trip row before completing
  try {
    const { total } = await getExpenseSummary(tripId)
    const trip = await getTripById(tripId)
    const nights = trip?.nights ?? 0
    await supabase
      .from(T.trips)
      .update({ status: 'Completed', total_spent: total, total_nights: nights })
      .eq('id', tripId)
  } catch {
    // Fallback: just mark completed without stats
    const { error } = await supabase
      .from(T.trips)
      .update({ status: 'Completed' })
      .eq('id', tripId)
    if (error) throw new Error(`finishTrip: ${error.message}`)
  }
  clearTripCache()
  await clearTripLocalData()
}

/** Archive/cancel a trip without generating a memory. */
export async function archiveTrip(tripId: string): Promise<void> {
  // Snapshot stats before archiving (same as finishTrip)
  try {
    const { total } = await getExpenseSummary(tripId)
    const trip = await getTripById(tripId)
    const nights = trip?.nights ?? 0
    await supabase
      .from(T.trips)
      .update({ status: 'Completed', total_spent: total, total_nights: nights, archived_at: new Date().toISOString() })
      .eq('id', tripId)
  } catch {
    const { error } = await supabase
      .from(T.trips)
      .update({ status: 'Completed', archived_at: new Date().toISOString() })
      .eq('id', tripId)
    if (error) throw new Error(`archiveTrip: ${error.message}`)
  }
  clearTripCache()
  await clearTripLocalData()
}

/** Soft-delete a trip (30-day retention window). */
export async function softDeleteTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from(T.trips)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', tripId)
  if (error) throw new Error(`softDeleteTrip: ${error.message}`)
  clearTripCache()
}

/** Restore a soft-deleted or archived trip. */
export async function restoreTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from(T.trips)
    .update({ deleted_at: null, archived_at: null })
    .eq('id', tripId)
  if (error) throw new Error(`restoreTrip: ${error.message}`)
  clearTripCache()
}

// ---------- TRIP MEMORIES ----------

function mapTripMemory(row: Record<string, unknown>): TripMemory {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    userId: row.user_id as string,
    narrative: (row.narrative as string) ?? '',
    dayHighlights: (row.day_highlights as TripMemory['dayHighlights']) ?? [],
    statsCard: (row.stats_card as TripMemoryStats) ?? { totalPhotos: 0, totalPlacesVisited: 0, totalExpenses: 0 },
    vibeAnalysis: (row.vibe_analysis as TripMemoryVibe) ?? { dominantMood: '', topTags: [], vibeDescription: '' },
    tripSnapshot: (row.trip_snapshot as TripMemorySnapshot) ?? { destination: '', startDate: '', endDate: '', nights: 0, accommodation: '', memberNames: [], memberCount: 0 },
    expenseSummary: (row.expense_summary as TripMemoryExpenses) ?? { total: 0, currency: 'PHP', topCategories: [], dailyAverage: 0 },
    placesSummary: (row.places_summary as TripMemoryPlace[]) ?? [],
    flightSummary: (row.flight_summary as TripMemoryFlight[]) ?? [],
    heroMomentId: (row.hero_moment_id as string) ?? undefined,
    featuredMomentIds: (row.featured_moment_ids as string[]) ?? [],
    status: (row.status as TripMemoryStatus) ?? 'draft',
    createdAt: row.created_at as string,
    savedAt: (row.saved_at as string) ?? undefined,
  }
}

/** Get the trip memory for a specific trip (current user). */
export async function getTripMemory(tripId: string): Promise<TripMemory | null> {
  const { data: authData } = await supabase.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return mapTripMemory(data)
}

/** Get all saved trip memories for a user (for past trips list). */
export async function getAllTripMemories(userId: string): Promise<TripMemory[]> {
  const { data } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'saved')
    .order('created_at', { ascending: false })
  if (!data) return []
  return data.map(mapTripMemory)
}

/** Upsert a draft trip memory (overwrites existing draft). */
export async function saveTripMemoryDraft(
  memory: Omit<TripMemory, 'id' | 'createdAt' | 'savedAt'>
): Promise<string> {
  const row = {
    trip_id: memory.tripId,
    user_id: memory.userId,
    narrative: memory.narrative,
    day_highlights: memory.dayHighlights,
    stats_card: memory.statsCard,
    vibe_analysis: memory.vibeAnalysis,
    trip_snapshot: memory.tripSnapshot,
    expense_summary: memory.expenseSummary,
    places_summary: memory.placesSummary,
    flight_summary: memory.flightSummary,
    hero_moment_id: memory.heroMomentId ?? null,
    featured_moment_ids: memory.featuredMomentIds,
    status: 'draft',
  }

  const { data, error } = await supabase
    .from('trip_memories')
    .upsert(row, { onConflict: 'trip_id,user_id' })
    .select('id')
    .single()
  if (error) throw new Error(`saveTripMemoryDraft: ${error.message}`)
  return data.id as string
}

/** Finalize a draft memory — marks it as saved (immutable). */
export async function finalizeTripMemory(memoryId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_memories')
    .update({ status: 'saved', saved_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('status', 'draft')
  if (error) throw new Error(`finalizeTripMemory: ${error.message}`)
}

// ── Personal Photos ──

export async function addPersonalPhoto(input: {
  userId: string;
  localUri: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  caption?: string;
  takenAt?: string;
  tags?: string[];
}): Promise<string> {
  const compressed = await compressImage(input.localUri, 1200, 0.8)
  const timestamp = Date.now()
  const ext = 'jpg'
  const storagePath = `personal/${input.userId}/${timestamp}.${ext}`

  const bytes = await readFileAsBytes(compressed)

  const { error: uploadError } = await supabase.storage
    .from('moments')
    .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw new Error(`addPersonalPhoto upload: ${uploadError.message}`)

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl

  const { data, error } = await supabase.from('personal_photos').insert({
    user_id: input.userId,
    photo_url: publicUrl,
    storage_path: storagePath,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    caption: input.caption,
    taken_at: input.takenAt ?? new Date().toISOString().slice(0, 10),
    tags: input.tags ?? [],
  }).select('id').single()
  if (error) throw new Error(`addPersonalPhoto insert: ${error.message}`)
  return data.id as string
}

export async function getPersonalPhotos(userId: string): Promise<import('./types').PersonalPhoto[]> {
  const { data, error } = await supabase
    .from('personal_photos')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
  if (error) throw new Error(`getPersonalPhotos: ${error.message}`)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    photoUrl: row.photo_url as string | undefined,
    storagePath: row.storage_path as string | undefined,
    location: row.location as string | undefined,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    caption: row.caption as string | undefined,
    takenAt: (row.taken_at as string) ?? new Date().toISOString().slice(0, 10),
    tags: (row.tags as string[]) ?? [],
  }))
}
