// Supabase data layer — drop-in replacement for lib/notion.ts.
// Every exported function preserves the original signature so consumer
// files only need to change their import path.

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'

import type {
  ChecklistItem,
  Expense,
  Flight,
  GroupMember,
  Highlight,
  HighlightType,
  LifetimeStats,
  Moment,
  MomentTag,
  PackingItem,
  Place,
  PlaceCategory,
  PlaceSource,
  PlaceVote,
  Trip,
  TripFile,
  TripFileType,
  TripStatus,
} from './types'

// ---------- client ----------

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://mzslhacnrwwmwgozpknm.supabase.co'
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? ''

if (!SUPABASE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase key missing. Set EXPO_PUBLIC_SUPABASE_KEY in .env.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
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

/** Android-safe date parser: date-only strings get PHT suffix to avoid UTC shift. */
function parseDateSafe(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T00:00:00+08:00')
  }
  return new Date(iso)
}

// Cache the active trip ID so trip-scoped functions that omit tripId
// do not fire a separate query every time.
let cachedTripId: string | undefined

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
            (parseDateSafe(end).getTime() - parseDateSafe(start).getTime()) / 86400000
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
    roomType: '',
    checkIn: (row.check_in as string) ?? undefined,
    checkOut: (row.check_out as string) ?? undefined,
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
    bookingRef: (row.booking_ref as string) ?? undefined,
    baggage: (row.baggage as string) ?? undefined,
    passenger: (row.passenger as string) ?? undefined,
  }
}

function mapMember(row: Record<string, unknown>): GroupMember {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    role: ((row.role as string) || 'Member') as GroupMember['role'],
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
    splitType: (row.split_type as Expense['splitType']) ?? undefined,
    notes: (row.notes as string) ?? undefined,
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

function mapMoment(row: Record<string, unknown>): Moment {
  return {
    id: row.id as string,
    caption: (row.caption as string) ?? '',
    photo: (row.public_url as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    takenBy: (row.uploaded_by as string) ?? undefined,
    date: (row.taken_at as string) ?? new Date().toISOString().slice(0, 10),
    tags: ((row.tags as string[]) ?? []) as MomentTag[],
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

export async function getActiveTrip(): Promise<Trip | null> {
  const { data, error } = await supabase
    .from(T.trips)
    .select('*')
    .in('status', ['Planning', 'Active'])
    .limit(5)

  if (error) throw new Error(`getActiveTrip: ${error.message}`)
  if (!data || data.length === 0) return null

  const trip = mapTrip(data[0])
  cachedTripId = trip.id
  return trip
}

export async function updateTrip(
  tripId: string,
  properties: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from(T.trips).update(properties).eq('id', tripId)
  if (error) throw new Error(`updateTrip: ${error.message}`)
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
}

export async function updateTripProperty(
  tripId: string,
  key: string,
  value: string
): Promise<void> {
  const column = TRIP_PROPERTY_MAP[key] ?? key
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

export async function addFlight(
  input: Omit<Flight, 'id'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.flights).insert({
    trip_id: id,
    flight_number: input.flightNumber,
    direction: input.direction,
    airline: input.airline,
    origin: input.from,
    destination: input.to,
    departure_time: input.departTime,
    arrival_time: input.arriveTime,
    ...(input.passenger ? { passenger: input.passenger } : {}),
  })
  if (error) throw new Error(`addFlight: ${error.message}`)
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

export async function addGroupMember(
  input: Omit<GroupMember, 'id'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.groupMembers).insert({
    trip_id: id,
    name: input.name,
    role: input.role,
    ...(input.phone ? { phone: input.phone } : {}),
    ...(input.email ? { email: input.email } : {}),
  })
  if (error) throw new Error(`addGroupMember: ${error.message}`)
}

export async function updateMemberPhoto(memberId: string, photoUrl: string): Promise<void> {
  const { error } = await supabase
    .from(T.groupMembers)
    .update({ avatar_url: photoUrl })
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
  input: Omit<Expense, 'id'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.expenses).insert({
    trip_id: id,
    title: input.description,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    expense_date: input.date,
    ...(input.paidBy ? { paid_by: input.paidBy } : {}),
    ...(input.photo ? { photo_url: input.photo } : {}),
    ...(input.placeName ? { place_name: input.placeName } : {}),
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

export async function deletePlacesForTrip(tripId?: string): Promise<void> {
  const id = await resolveTripId(tripId)
  const { error } = await supabase.from(T.places).delete().eq('trip_id', id)
  if (error) throw new Error(`deletePlacesForTrip: ${error.message}`)
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

export async function addChecklistItem(
  input: Omit<ChecklistItem, 'id' | 'done'> & { tripId?: string }
): Promise<void> {
  const id = await resolveTripId(input.tripId)
  const { error } = await supabase.from(T.checklist).insert({
    trip_id: id,
    title: input.task,
    is_done: false,
    ...(input.doneBy ? { done_by: input.doneBy } : {}),
  })
  if (error) throw new Error(`addChecklistItem: ${error.message}`)
}

export async function toggleChecklistItem(
  itemId: string,
  done: boolean,
  doneBy?: string
): Promise<void> {
  const updates: Record<string, unknown> = { is_done: done }
  if (doneBy) updates.done_by = doneBy
  const { error } = await supabase.from(T.checklist).update(updates).eq('id', itemId)
  if (error) throw new Error(`toggleChecklistItem: ${error.message}`)
}

// ---------- MOMENTS ----------

export async function getMoments(tripId?: string): Promise<Moment[]> {
  const id = await resolveTripId(tripId)
  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('trip_id', id)
    .order('taken_at', { ascending: false })

  if (error) throw new Error(`getMoments: ${error.message}`)
  return (data ?? []).map(mapMoment)
}

export async function addMoment(
  input: Omit<Moment, 'id'> & { tripId?: string; localUri?: string }
): Promise<void> {
  const tripId = await resolveTripId(input.tripId)

  let storagePath: string | undefined
  let publicUrl: string | undefined

  // If a local file URI is provided, upload to Supabase Storage.
  if (input.localUri) {
    const timestamp = Date.now()
    const filename = input.localUri.split('/').pop() ?? 'photo.jpg'
    storagePath = `trips/${tripId}/${timestamp}-${filename}`

    const base64 = await FileSystem.readAsStringAsync(input.localUri, {
      encoding: 'base64' as const,
    })

    const { error: uploadError } = await supabase.storage
      .from('moments')
      .upload(storagePath, decode(base64), {
        contentType: guessMimeType(filename),
        upsert: false,
      })

    if (uploadError) throw new Error(`addMoment upload: ${uploadError.message}`)

    const { data: urlData } = supabase.storage
      .from('moments')
      .getPublicUrl(storagePath)
    publicUrl = urlData.publicUrl
  } else if (input.photo) {
    // Photo is already a remote URL (e.g. from Notion migration).
    publicUrl = input.photo
  }

  const { error } = await supabase.from(T.moments).insert({
    trip_id: tripId,
    caption: input.caption || 'Untitled',
    ...(storagePath ? { storage_path: storagePath } : {}),
    ...(publicUrl ? { public_url: publicUrl } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.takenBy ? { uploaded_by: input.takenBy } : {}),
    taken_at: input.date,
    ...(input.tags.length > 0 ? { tags: input.tags } : {}),
  })
  if (error) throw new Error(`addMoment insert: ${error.message}`)
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

export interface Profile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
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
  }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Omit<Profile, 'id'>>
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.fullName !== undefined) row.full_name = updates.fullName
  if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl
  if (updates.phone !== undefined) row.phone = updates.phone
  const { error } = await supabase.from('profiles').update(row).eq('id', userId)
  if (error) throw new Error(`updateProfile: ${error.message}`)
}

// ---------- TRIP PHASE / FLIGHT STATUS ----------

export type TripPhase = 'upcoming' | 'inflight' | 'arrived' | 'active'
export type FlightStatus = 'scheduled' | 'boarding' | 'in-flight' | 'landed'

export async function updateTripPhase(tripId: string, phase: TripPhase): Promise<void> {
  const updates: Record<string, unknown> = { trip_phase: phase }
  if (phase === 'inflight') updates.flight_departed_at = new Date().toISOString()
  if (phase === 'arrived') updates.flight_arrived_at = new Date().toISOString()
  const { error } = await supabase.from('trips').update(updates).eq('id', tripId)
  if (error) throw new Error(`updateTripPhase: ${error.message}`)
}

export async function getTripPhase(tripId: string): Promise<{ phase: TripPhase; departedAt?: string; arrivedAt?: string }> {
  const { data, error } = await supabase
    .from('trips')
    .select('trip_phase, flight_departed_at, flight_arrived_at')
    .eq('id', tripId)
    .single()
  if (error || !data) return { phase: 'upcoming' }
  return {
    phase: (data.trip_phase as TripPhase) || 'upcoming',
    departedAt: data.flight_departed_at ?? undefined,
    arrivedAt: data.flight_arrived_at ?? undefined,
  }
}

export async function updateFlightStatus(flightId: string, status: FlightStatus): Promise<void> {
  const updates: Record<string, unknown> = { status }
  if (status === 'in-flight') updates.departed_at = new Date().toISOString()
  if (status === 'landed') updates.arrived_at = new Date().toISOString()
  const { error } = await supabase.from('flights').update(updates).eq('id', flightId)
  if (error) throw new Error(`updateFlightStatus: ${error.message}`)
}

export async function getFlightStatus(flightId: string): Promise<{ status: FlightStatus; departedAt?: string; arrivedAt?: string }> {
  const { data, error } = await supabase
    .from('flights')
    .select('status, departed_at, arrived_at')
    .eq('id', flightId)
    .single()
  if (error || !data) return { status: 'scheduled' }
  return {
    status: (data.status as FlightStatus) || 'scheduled',
    departedAt: data.departed_at ?? undefined,
    arrivedAt: data.arrived_at ?? undefined,
  }
}

/**
 * Get the relevant flight based on trip phase:
 * - upcoming/in-flight → Outbound flight
 * - arrived → Return flight
 */
export async function getRelevantFlight(tripId: string): Promise<Flight | null> {
  const { phase } = await getTripPhase(tripId)
  const direction = phase === 'arrived' ? 'Return' : 'Outbound'
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('trip_id', tripId)
    .eq('direction', direction)
    .limit(1)
    .single()
  if (error || !data) {
    // Fallback: get any flight
    const { data: any } = await supabase
      .from('flights')
      .select('*')
      .eq('trip_id', tripId)
      .limit(1)
      .single()
    if (!any) return null
    return mapFlight(any)
  }
  return mapFlight(data)
}

// ---------- LIFETIME STATS & HIGHLIGHTS ----------

/** Re-export the trip mapper so lifetimeStats.ts can reuse it. */
export const mapTripRow = mapTrip

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

export async function upsertLifetimeStats(
  userId: string,
  stats: LifetimeStats,
): Promise<void> {
  const { error } = await supabase.from('lifetime_stats').upsert({
    user_id: userId,
    total_trips: stats.totalTrips,
    total_countries: stats.totalCountries,
    total_nights: stats.totalNights,
    total_miles: stats.totalMiles,
    total_spent: stats.totalSpent,
    home_currency: stats.homeCurrency,
    total_moments: stats.totalMoments,
    countries_list: stats.countriesList,
    earliest_trip_date: stats.earliestTripDate,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(`upsertLifetimeStats: ${error.message}`)
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

export async function saveHighlights(
  userId: string,
  highlights: Highlight[],
): Promise<void> {
  const { error: delErr } = await supabase.from('highlights').delete().eq('user_id', userId)
  if (delErr) throw new Error(`saveHighlights delete: ${delErr.message}`)
  if (highlights.length > 0) {
    const { error: insErr } = await supabase.from('highlights').insert(
      highlights.map((h, i) => ({
        user_id: userId,
        type: h.type,
        display_text: h.displayText,
        supporting_data: h.supportingData ?? {},
        rank: i,
      })),
    )
    if (insErr) throw new Error(`saveHighlights insert: ${insErr.message}`)
  }
}

export async function getPastTrips(userId: string): Promise<Trip[]> {
  const { data } = await supabase
    .from(T.trips)
    .select('*')
    .eq('user_id', userId)
    .or('is_past_import.eq.true,status.eq.Completed')
    .order('start_date', { ascending: false })
  if (!data) return []
  return data.map(mapTrip)
}

export async function addPastTrip(
  input: Partial<Trip> & { userId: string },
): Promise<Trip | null> {
  const { data } = await supabase
    .from(T.trips)
    .insert({
      name: input.name ?? input.destination ?? 'Past Trip',
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      status: 'Completed',
      is_past_import: true,
      user_id: input.userId,
      country: input.country,
      country_code: input.countryCode,
      latitude: input.latitude,
      longitude: input.longitude,
      total_spent: input.totalSpent ?? 0,
      total_nights: input.totalNights ?? 0,
    })
    .select()
    .single()
  if (!data) return null
  return mapTrip(data)
}
