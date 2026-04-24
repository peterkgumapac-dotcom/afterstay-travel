// Supabase data layer — drop-in replacement for lib/notion.ts.
// Every exported function preserves the original signature so consumer
// files only need to change their import path.

import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import { compressImage } from './compressImage'
import { MS_PER_DAY } from './utils'

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

export async function getActiveTrip(forceRefresh = false): Promise<Trip | null> {
  if (cachedTrip !== undefined && !forceRefresh) return cachedTrip

  const { data, error } = await supabase
    .from(T.trips)
    .select('*')
    .in('status', ['Planning', 'Active'])
    .order('start_date', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) {
    cachedTrip = null
    return null
  }

  const trip = mapTrip(data[0])
  cachedTripId = trip.id
  cachedTrip = trip
  return trip
}

export function clearTripCache() {
  cachedTripId = undefined
  cachedTrip = undefined
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
}): Promise<string> {
  // Get authenticated user ID for trip ownership
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  // Archive only THIS user's active trips (not everyone's)
  if (userId) {
    await supabase
      .from(T.trips)
      .update({ status: 'Completed' })
      .in('status', ['Planning', 'Active'])
      .eq('user_id', userId)
  }

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
      ...(userId ? { user_id: userId } : {}),
      ...(input.accommodation ? { accommodation_name: input.accommodation } : {}),
      ...(input.address ? { accommodation_address: input.address } : {}),
      ...(input.checkIn ? { check_in: input.checkIn } : {}),
      ...(input.checkOut ? { check_out: input.checkOut } : {}),
      ...(input.cost != null ? { budget_limit: input.cost } : {}),
      ...(input.costCurrency ? { currency: input.costCurrency } : {}),
      ...(input.bookingRef ? { notes: `Booking ref: ${input.bookingRef}` } : {}),
      ...(input.roomType ? { room_type: input.roomType } : {}),
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
    ...(userId ? { user_id: userId } : {}),
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
  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('trip_id', id)
    .order('taken_at', { ascending: false })

  if (error) throw new Error(`getMoments: ${error.message}`)
  return (data ?? []).map(mapMoment)
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

  // If a local file URI is provided, compress and upload to Supabase Storage.
  if (input.localUri) {
    const compressed = await compressImage(input.localUri, 800, 0.5)
    const ext = (input.localUri.split('.').pop() ?? 'jpg').toLowerCase()
    const friendlyName = buildMomentFilename(input, ext)
    storagePath = `trips/${tripId}/${friendlyName}`

    // Read as base64 — more reliable than fetch→blob on RN Android
    const base64 = await FileSystem.readAsStringAsync(compressed, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const { error: uploadError } = await supabase.storage
      .from('moments')
      .upload(storagePath, bytes, {
        contentType: guessMimeType(friendlyName),
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
  const { data } = await supabase
    .from(T.trips)
    .select('*')
    .eq('user_id', userId)
    .or('is_past_import.eq.true,status.eq.Completed')
    .order('start_date', { ascending: false })
  if (!data) return []
  return data.map(mapTrip)
}
