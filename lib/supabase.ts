// Supabase data layer — drop-in replacement for lib/notion.ts.
// Every exported function preserves the original signature so consumer
// files only need to change their import path.

import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';
import * as FileSystem from 'expo-file-system/legacy';
import { base64ToBytes } from './base64';
import { clearTripLocalData } from './cache';
import { invalidateTripCache } from './tabDataCache';
import { compressImage } from './compressImage';
import { MS_PER_DAY } from './utils';
import { buildWishlistRow } from './wishlist';

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
  MomentComment,
  FeedFilter,
  FeedPage,
  FeedPost,
  FeedPostType,
  FeedPostComment,
  FollowState,
  CompanionProfile,
  CompanionPrivacy,
  CompanionStatus,
  WishlistItem,
} from './types';

// ---------- client ----------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

if (!SUPABASE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase key missing. Set EXPO_PUBLIC_SUPABASE_KEY in .env.');
}

// Noop storage for Node.js (OTA export). AsyncStorage crashes in Node because `window` is undefined.
const noopStorage = {
  getItem: (_key: string) => Promise.resolve(null),
  setItem: (_key: string, _value: string) => Promise.resolve(),
  removeItem: (_key: string) => Promise.resolve(),
};

// Detect Node.js (OTA export) vs React Native (device)
const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const safeStorage = isNode ? noopStorage : secureStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ---------- helpers ----------

/** Parse numeric strings returned by the Supabase REST API for numeric columns. */
function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isNaN(n) ? undefined : n;
}

function numRequired(v: unknown, fallback = 0): number {
  return num(v) ?? fallback;
}

/**
 * Read a local file URI as a Uint8Array for Supabase Storage upload.
 * Uses fetch→arrayBuffer (memory-efficient, no base64 intermediate) with
 * a FileSystem base64 fallback for content:// URIs on Android.
 */
async function readFileAsBytes(uri: string): Promise<Uint8Array> {
  // file:// URIs work with fetch natively in React Native
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const fetchUri = uri.startsWith('/') ? `file://${uri}` : uri;
    try {
      const response = await fetch(fetchUri);
      if (typeof response.arrayBuffer === 'function') {
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
      }
    } catch {
      // Fall through to FileSystem. Some Android runtimes cannot arrayBuffer()
      // local file responses even though fetch(file://) itself exists.
    }
  }
  // content:// URIs and Android file:// fallback — use FileSystem base64.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

function withOperationTimeout<T>(promise: PromiseLike<T>, message: string, ms = 45_000): Promise<T> {
  const wrapped = Promise.resolve(promise);
  return Promise.race([
    wrapped,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      wrapped.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer),
      );
    }),
  ]);
}

async function compressImageBestEffort(uri: string, maxSize: number, quality: number): Promise<string> {
  try {
    return await compressImage(uri, maxSize, quality);
  } catch (err) {
    if (__DEV__) console.warn('[media] compression failed, uploading original:', err);
    return uri;
  }
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function getStorageAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || SUPABASE_KEY;
}

async function uploadLocalFileToStorage(input: {
  bucket: string;
  path: string;
  fileUri: string;
  contentType: string;
  upsert?: boolean;
  timeoutMs?: number;
  timeoutMessage?: string;
}): Promise<void> {
  const fileUri = input.fileUri.startsWith('/') ? `file://${input.fileUri}` : input.fileUri;
  const uploadAsync = (FileSystem as typeof FileSystem & {
    uploadAsync?: typeof FileSystem.uploadAsync;
  }).uploadAsync;
  const binaryUploadType = (FileSystem as typeof FileSystem & {
    FileSystemUploadType?: { BINARY_CONTENT?: FileSystem.FileSystemUploadType };
  }).FileSystemUploadType?.BINARY_CONTENT;

  if (typeof uploadAsync === 'function' && binaryUploadType) {
    const token = await getStorageAuthToken();
    const url = `${SUPABASE_URL}/storage/v1/object/${input.bucket}/${encodeStoragePath(input.path)}`;
    const result = await withOperationTimeout(
      uploadAsync(url, fileUri, {
        httpMethod: 'POST',
        uploadType: binaryUploadType,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': input.contentType,
          'x-upsert': input.upsert ? 'true' : 'false',
        },
      }),
      input.timeoutMessage ?? 'Upload timed out. Please check your connection and try again.',
      input.timeoutMs ?? 90_000,
    );
    if (result.status < 200 || result.status >= 300) {
      let message = result.body || `HTTP ${result.status}`;
      try {
        const parsed = JSON.parse(result.body) as { message?: string; error?: string };
        message = parsed.message || parsed.error || message;
      } catch {
        // Use the raw body when storage returns plain text.
      }
      throw new Error(message);
    }
    return;
  }

  const bytes = await withOperationTimeout(
    readFileAsBytes(fileUri),
    input.timeoutMessage ?? 'Upload timed out. Please check your connection and try again.',
    input.timeoutMs ?? 90_000,
  );
  const { error } = await withOperationTimeout(
    supabase.storage.from(input.bucket).upload(input.path, bytes, {
      contentType: input.contentType,
      upsert: input.upsert ?? false,
    }),
    input.timeoutMessage ?? 'Upload timed out. Please check your connection and try again.',
    input.timeoutMs ?? 90_000,
  );
  if (error) throw new Error(error.message);
}

function isLocalAssetUri(uri?: string): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('/');
}

export async function uploadExpenseReceiptPhoto(inputUri?: string): Promise<{ publicUrl?: string; storagePath?: string }> {
  const uri = inputUri?.trim();
  if (!uri) return {};
  if (!isLocalAssetUri(uri)) return { publicUrl: uri };

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const compressed = await withOperationTimeout(
    compressImage(uri, 1200, 0.72),
    'Preparing receipt photo timed out. Please try a smaller photo.',
    60_000,
  );
  const nonce = Math.random().toString(36).slice(2, 10);
  const storagePath = `receipts/${userId}/${Date.now()}-${nonce}.jpg`;

  await uploadLocalFileToStorage({
    bucket: 'moments',
    path: storagePath,
    fileUri: compressed,
    contentType: 'image/jpeg',
    upsert: false,
    timeoutMs: 150_000,
    timeoutMessage: 'Receipt upload timed out. Please check your connection and try again.',
  });

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) throw new Error('Receipt upload failed: public URL could not be generated.');
  return { publicUrl, storagePath };
}

/** Android-safe date parser: date-only strings get PHT suffix to avoid UTC shift. */
function parseDateSafe(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(iso + 'T00:00:00+08:00');
  }
  return new Date(iso);
}

// Cache the active trip ID and trip object so trip-scoped functions that omit tripId
// do not fire a separate query every time.
let cachedTripId: string | undefined;
let cachedTrip: Trip | null | undefined; // undefined = not fetched, null = no trip
let cachedTripUserId: string | undefined;

async function resolveTripId(tripId?: string): Promise<string> {
  if (tripId) return tripId;
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (cachedTripId && cachedTripUserId === userId) return cachedTripId;
  const trip = await getActiveTrip();
  if (!trip) throw new Error('No active trip found and no tripId provided.');
  cachedTripId = trip.id;
  cachedTripUserId = trip.userId ?? userId;
  return trip.id;
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
} as const;

// ---------- MAPPERS (snake_case DB -> camelCase app) ----------

function mapTrip(row: Record<string, unknown>): Trip {
  const start = (row.start_date as string) ?? '';
  const end = (row.end_date as string) ?? start;
  const nights =
    start && end
      ? Math.max(1, Math.round((parseDateSafe(end).getTime() - parseDateSafe(start).getTime()) / MS_PER_DAY))
      : 0;

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
  };
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
    return iso
      .replace(/Z$/, '+08:00')
      .replace(/\+00:00$/, '+08:00')
      .replace(/\+00$/, '+08:00');
  }
  // No timezone info — assume PHT
  return iso + '+08:00';
}

function normalizeFlightDirection(value?: string): Flight['direction'] {
  const direction = (value ?? '').trim().toLowerCase();
  if (['return', 'inbound', 'arrival', 'arrive', 'back', 'homebound'].some((token) => direction.includes(token))) {
    return 'Return';
  }
  return 'Outbound';
}

function mapFlight(row: Record<string, unknown>): Flight {
  const rawDepart = (row.departure_time as string) ?? (row.depart_time as string) ?? '';
  const rawArrive = (row.arrival_time as string) ?? (row.arrive_time as string) ?? '';
  return {
    id: row.id as string,
    direction: normalizeFlightDirection(row.direction as string),
    flightNumber: (row.flight_number as string) ?? '',
    airline: (row.airline as string) ?? '',
    from: (row.origin as string) ?? (row.from_city as string) ?? '',
    to: (row.destination as string) ?? (row.to_city as string) ?? '',
    departTime: rawDepart,
    arriveTime: rawArrive,
    bookingRef: (row.booking_ref as string) ?? (row.confirmation as string) ?? undefined,
    seatNumber: (row.seat_number as string) ?? (row.seat as string) ?? undefined,
    baggage: (row.baggage as string) ?? undefined,
    passenger: (row.passenger as string) ?? undefined,
  };
}

function mapMember(row: Record<string, unknown>): GroupMember {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    role: ((row.role as string) || 'Member') as GroupMember['role'],
    userId: (row.user_id as string) ?? undefined,
    sharesAccommodation: row.shares_accommodation == null ? undefined : !!row.shares_accommodation,
    travelNotes: (row.travel_notes as string) ?? undefined,
    phone: (row.phone as string) ?? undefined,
    email: (row.email as string) ?? undefined,
    profilePhoto: (row.avatar_url as string) ?? undefined,
  };
}

function mapPacking(row: Record<string, unknown>): PackingItem {
  return {
    id: row.id as string,
    item: (row.name as string) ?? '',
    category: ((row.category as string) || 'Other') as PackingItem['category'],
    packed: !!row.is_packed,
    owner: (row.owner as string) ?? undefined,
  };
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
  };
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
    voteByMember: row.vote_by_member ? (row.vote_by_member as Record<string, PlaceVote>) : undefined,
  };
}

function mapChecklist(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    task: (row.title as string) ?? '',
    done: !!row.is_done,
    doneBy: (row.done_by as string) ?? undefined,
  };
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
  let url = row.public_url as string | undefined;
  // Detect truncated public_url (ends with "/" or "/trips/" instead of a filename)
  if (url && (url.endsWith('/') || !url.match(/\.\w{2,5}$/))) {
    url = undefined; // force fallback to storage_path
  }
  // Fallback: reconstruct from storage_path if public_url wasn't saved or was truncated
  if (!url) {
    const storagePath = row.storage_path as string | undefined;
    if (storagePath && SUPABASE_URL) {
      url = `${SUPABASE_URL}/storage/v1/object/public/moments/${storagePath}`;
    }
  }
  if (!url) return undefined;
  // HEIC files: use Supabase render endpoint to serve as JPEG (Android can't decode HEIC)
  if (url.match(/\.heic$/i)) {
    return url.replace('/object/public/', '/render/image/public/') + '?format=origin';
  }
  return url;
}

function mapMoment(row: Record<string, unknown>): Moment {
  return {
    id: row.id as string,
    caption: (row.caption as string) ?? '',
    photo: momentPhotoUrl(row),
    hdPhoto: (row.hd_url as string) ?? undefined,
    blurhash: (row.blurhash as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    takenBy: (row.uploaded_by as string) ?? undefined,
    userId: (row.user_id as string) ?? undefined,
    date: (row.taken_at as string) ?? new Date().toISOString().slice(0, 10),
    tags: ((row.tags as string[]) ?? []) as MomentTag[],
    visibility: ((row.visibility as string) ?? 'shared') as Moment['visibility'],
    isPublic: !!row.is_public,
    likesCount: (row.likes_count as number) ?? 0,
    commentsCount: (row.comments_count as number) ?? 0,
    dayNumber: num(row.day_number),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
  };
}

function mapTripFile(row: Record<string, unknown>): TripFile {
  return {
    id: row.id as string,
    fileName: (row.name as string) ?? '',
    fileUrl: (row.file_url as string) ?? undefined,
    storagePath: (row.storage_path as string) ?? undefined,
    contentType: (row.content_type as string) ?? undefined,
    sizeBytes: num(row.size_bytes),
    uploadedBy: (row.uploaded_by as string) ?? undefined,
    type: ((row.file_type as string) || 'Other') as TripFileType,
    notes: (row.description as string) ?? undefined,
    printRequired: !!row.print_required,
  };
}

// ---------- TRIPS ----------

export async function getActiveTrip(forceRefresh = false): Promise<Trip | null> {
  // Get authenticated user — filter trips to only this user's
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (!userId) {
    cachedTripId = undefined;
    cachedTrip = null;
    cachedTripUserId = undefined;
    return null;
  }

  if (cachedTripUserId !== userId) {
    cachedTripId = undefined;
    cachedTrip = undefined;
    cachedTripUserId = userId;
  }

  if (cachedTrip !== undefined && !forceRefresh) return cachedTrip;

  // Trips owned by user (is_draft must not be true — allow null and false).
  // Fetch a small window, then filter deleted/archived locally so one stale
  // duplicate cannot hide the next valid planning trip.
  const { data: owned } = await supabase
    .from(T.trips)
    .select('*')
    .eq('user_id', userId)
    .in('status', ['Planning', 'Active'])
    .or('is_draft.is.null,is_draft.eq.false')
    .order('start_date', { ascending: true })
    .limit(20);

  // Trips where user is a member (covers invited members)
  const { data: memberTrips } = await supabase
    .from(T.trips)
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', userId)
    .in('status', ['Planning', 'Active'])
    .or('is_draft.is.null,is_draft.eq.false')
    .order('start_date', { ascending: true })
    .limit(20);

  // Merge and pick earliest
  const allRows = [...(owned ?? []), ...(memberTrips ?? [])];
  if (allRows.length === 0) {
    cachedTrip = null;
    cachedTripUserId = userId;
    return null;
  }

  // Deduplicate, drop archived/deleted rows, then pick first by start_date.
  const seen = new Set<string>();
  const unique = allRows
    .filter((r) => {
      const id = r.id as string;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .filter((r) => !r.deleted_at && !r.archived_at)
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  const row = unique[0];
  if (!row) {
    cachedTripId = undefined;
    cachedTrip = null;
    cachedTripUserId = userId;
    return null;
  }

  const trip = mapTrip(row);
  cachedTripId = trip.id;
  cachedTrip = trip;
  cachedTripUserId = userId;
  return trip;
}

/** Fetch recent expenses across all user's trips (budget history without active trip). */
export async function getAllUserExpenses(limit = 20): Promise<(Expense & { tripName?: string })[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  const allTrips = await getAllUserTrips(userId);
  if (allTrips.length === 0) return [];

  const tripIds = allTrips.map((t) => t.id);
  const tripNameMap = new Map(allTrips.map((t) => [t.id, t.destination ?? t.name]));

  const { data: exps } = await supabase
    .from(T.expenses)
    .select('*')
    .in('trip_id', tripIds)
    .order('expense_date', { ascending: false })
    .limit(limit);

  if (!exps) return [];
  return exps.map((r) => ({
    ...mapExpense(r as Record<string, unknown>),
    tripName: tripNameMap.get(r.trip_id as string),
  }));
}

export async function getStandaloneExpenses(limit = 30): Promise<Expense[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  const { data } = await supabase
    .from(T.expenses)
    .select('*')
    .is('trip_id', null)
    .is('daily_category', null)
    .eq('user_id', userId)
    .order('expense_date', { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data.map((r) => mapExpense(r as Record<string, unknown>));
}

export function clearTripCache() {
  cachedTripId = undefined;
  cachedTrip = undefined;
  cachedTripUserId = undefined;
}

/** Fetch a single trip by ID (works for any status including Completed). */
export async function getTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase.from(T.trips).select('*').eq('id', tripId).single();
  if (error || !data) return null;
  return mapTrip(data as Record<string, unknown>);
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
  vibes?: string[];
}): Promise<string> {
  // Get authenticated user ID for trip ownership — required by RLS
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error('createTrip: not authenticated');

  // Creating a trip must not reclassify other upcoming trips. Users can have
  // multiple future trips, and auto-marking old Planning rows as Completed
  // makes duplicates look like fake past trips in My Trips and stats.

  // Clear all trip-specific local caches for a fresh start
  await clearTripLocalData();

  // Auto-detect status from dates
  const now = new Date();
  const start = new Date(input.startDate + 'T00:00:00+08:00');
  const end = new Date(input.endDate + 'T23:59:59+08:00');
  const status = now > end ? 'Completed' : now > start ? 'Active' : 'Planning';

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
      ...(input.vibes?.length ? { vibes: input.vibes } : {}),
    })
    .select('id')
    .single();

  if (error) throw new Error(`createTrip: ${error.message}`);
  const tripId = data.id as string;
  cachedTripId = tripId;
  cachedTrip = undefined; // Invalidate cache so next fetch gets new trip
  cachedTripUserId = userId;
  invalidateTripCache(tripId);

  // Always add the organizer as Primary member
  const userName = authData?.user?.user_metadata?.full_name ?? authData?.user?.email?.split('@')[0] ?? 'Organizer';
  await supabase
    .from(T.groupMembers)
    .insert({
      trip_id: tripId,
      name: userName,
      role: 'Primary',
      user_id: userId,
    })
    .then(() => {}); // don't block on failure

  // Add additional members if provided
  if (input.members && input.members.length > 0) {
    const memberRows = input.members
      .filter((n) => n.trim().toLowerCase() !== userName.toLowerCase()) // skip if organizer is in list
      .map((name) => ({
        trip_id: tripId,
        name: name.trim(),
        role: 'Member' as const,
      }));
    if (memberRows.length > 0) {
      await supabase.from(T.groupMembers).insert(memberRows);
    }
  }

  return tripId;
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
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error('saveDraftTrip: not authenticated');

  // Compute placeholder dates from "when" hint
  const today = new Date();
  let startDate: string;
  let endDate: string;
  switch (input.when) {
    case 'This month': {
      const s = new Date(today.getTime() + 14 * MS_PER_DAY);
      startDate = s.toISOString().slice(0, 10);
      endDate = new Date(s.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10);
      break;
    }
    case 'Next month': {
      const s = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      startDate = s.toISOString().slice(0, 10);
      endDate = new Date(s.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10);
      break;
    }
    default: {
      const s = new Date(today.getTime() + 60 * MS_PER_DAY);
      startDate = s.toISOString().slice(0, 10);
      endDate = new Date(s.getTime() + 7 * MS_PER_DAY).toISOString().slice(0, 10);
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
    .single();

  if (error) throw new Error(`saveDraftTrip: ${error.message}`);
  const tripId = data.id as string;

  // Add organizer as Primary member
  const userName = authData?.user?.user_metadata?.full_name ?? authData?.user?.email?.split('@')[0] ?? 'Organizer';
  await supabase
    .from(T.groupMembers)
    .insert({
      trip_id: tripId,
      name: userName,
      role: 'Primary',
      user_id: userId,
    })
    .then(() => {});

  return tripId;
}

/** Finalize a draft trip — clears is_draft so getActiveTrip() can detect it */
export async function finalizeDraftTrip(tripId: string): Promise<void> {
  await supabase.from(T.trips).update({ is_draft: false }).eq('id', tripId);
  cachedTrip = undefined; // bust cache
  invalidateTripCache(tripId);
}

/** Delete a draft trip (used when user taps "Discard" on resume nudge) */
export async function discardDraftTrip(tripId: string): Promise<void> {
  // Best-effort cascade cleanup — ignore errors on tables that may not exist
  // or already have ON DELETE CASCADE in the schema
  await Promise.all([
    supabase
      .from(T.groupMembers)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.flights)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.expenses)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.places)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.moments)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.packingItems)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.tripFiles)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from(T.checklist)
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from('chat_messages')
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from('trip_invites')
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from('trip_memories')
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
    supabase
      .from('notifications')
      .delete()
      .eq('trip_id', tripId)
      .then(() => {}),
  ]);

  const { error } = await supabase.from(T.trips).delete().eq('id', tripId);
  if (error) throw new Error(`deleteTrip: ${error.message}`);
  clearTripCache();
  invalidateTripCache(tripId);
  await clearTripLocalData();
}

// ---------- ADD GROUP MEMBER ----------

// ---------- TRIP INVITES ----------

export async function createInviteCode(tripId?: string): Promise<string> {
  const id = await resolveTripId(tripId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  let lastError: any = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    // Generate 6-char alphanumeric code
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from('trip_invites').insert({
      trip_id: id,
      code,
      expires_at: expiresAt,
    });
    if (!error) return code;
    lastError = error;
    const isCollision = error.code === '23505' || /duplicate|unique/i.test(error.message ?? '');
    if (!isCollision) break;
  }

  throw new Error(`createInviteCode: ${lastError?.message ?? 'Could not create a unique invite code'}`);
}

export async function getOrCreateInviteCode(tripId?: string, forceNew = false): Promise<string> {
  const id = await resolveTripId(tripId);
  if (!forceNew) {
    const invites = await getInvites(id);
    const active = invites.find((invite) => new Date(invite.expiresAt) > new Date());
    if (active?.code) return active.code;
  }
  return createInviteCode(id);
}

export async function joinTripByCode(code: string, userName: string): Promise<{ tripId: string; trip: Trip }> {
  const normalizedCode = code.trim().toUpperCase();
  const cleanedName = userName.trim();

  const { data: rpcAuth } = await supabase.auth.getUser();
  const rpcUserId = rpcAuth?.user?.id;
  if (rpcUserId) {
    const { data: rpcTrip, error: rpcError } = await supabase.rpc('join_trip_by_invite_code', {
      p_code: normalizedCode,
      p_name: cleanedName,
    });
    const isMissingRpc =
      rpcError?.code === 'PGRST202' ||
      /join_trip_by_invite_code|could not find function|schema cache/i.test(rpcError?.message ?? '');

    if (!rpcError && rpcTrip) {
      const trip = mapTrip(rpcTrip as Record<string, unknown>);
      notifyMemberJoined(trip.id, cleanedName, rpcUserId).catch(() => {});
      cachedTripId = trip.id;
      cachedTrip = undefined;
      cachedTripUserId = rpcUserId;
      invalidateTripCache(trip.id);
      await clearTripLocalData();
      return { tripId: trip.id, trip };
    }

    if (rpcError && !isMissingRpc) {
      throw new Error(rpcError.message || 'Could not join trip');
    }
  }

  // Look up the invite
  const { data: invite, error: lookupError } = await supabase
    .from('trip_invites')
    .select('trip_id, expires_at, used')
    .eq('code', normalizedCode)
    .single();

  if (lookupError || !invite) throw new Error('Invalid invite code');
  if (new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired');

  // Get trip details
  const tripId = invite.trip_id as string;
  const { data: tripData, error: tripError } = await supabase.from(T.trips).select('*').eq('id', tripId).single();
  if (tripError || !tripData) throw new Error('Trip not found');

  // Add user as trip member with user_id
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  const userEmail = authData?.user?.email?.trim().toLowerCase();

  if (userId) {
    const { data: existingMember } = await supabase
      .from(T.groupMembers)
      .select('id, user_id')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember?.id) {
      await supabase
        .from(T.groupMembers)
        .update({ name: cleanedName })
        .eq('id', existingMember.id)
        .then(() => {});
    } else {
      let placeholderMember: { id: string } | null = null;
      if (userEmail) {
        const { data } = await supabase
          .from(T.groupMembers)
          .select('id')
          .eq('trip_id', tripId)
          .is('user_id', null)
          .ilike('email', userEmail)
          .maybeSingle();
        placeholderMember = data as { id: string } | null;
      }
      if (!placeholderMember && cleanedName) {
        const { data } = await supabase
          .from(T.groupMembers)
          .select('id')
          .eq('trip_id', tripId)
          .is('user_id', null)
          .ilike('name', cleanedName)
          .maybeSingle();
        placeholderMember = data as { id: string } | null;
      }

      if (placeholderMember?.id) {
        const { error: linkError } = await supabase
          .from(T.groupMembers)
          .update({ name: cleanedName, user_id: userId })
          .eq('id', placeholderMember.id);
        if (linkError) {
          // Some deployed RLS policies do not allow invited users to claim an
          // organizer-created placeholder row because the old row has no user_id.
          // Fall back to inserting a real linked member so the invite still works.
          const { error: memberError } = await supabase.from(T.groupMembers).insert({
            trip_id: tripId,
            name: cleanedName,
            role: 'Member',
            user_id: userId,
            ...(userEmail ? { email: userEmail } : {}),
          });
          if (memberError) throw new Error(`joinTrip: ${memberError.message}`);
        }
      } else {
        const { error: memberError } = await supabase.from(T.groupMembers).insert({
          trip_id: tripId,
          name: cleanedName,
          role: 'Member',
          user_id: userId,
          ...(userEmail ? { email: userEmail } : {}),
        });
        if (memberError) throw new Error(`joinTrip: ${memberError.message}`);
      }
    }
  } else {
    const { error: memberError } = await supabase.from(T.groupMembers).insert({
      trip_id: tripId,
      name: cleanedName,
      role: 'Member',
    });
    if (memberError) throw new Error(`joinTrip: ${memberError.message}`);
  }

  // Mark as used for organizer history only. Codes remain reusable until expiry
  // so one group invite can be shared with multiple travelers.
  await supabase.from('trip_invites').update({ used: true }).eq('code', normalizedCode);

  // Notify existing members (best-effort, non-blocking)
  if (userId) {
    notifyMemberJoined(tripId, cleanedName, userId).catch(() => {});
  }

  cachedTripId = tripId;
  cachedTrip = undefined;
  cachedTripUserId = userId;
  invalidateTripCache(tripId);
  await clearTripLocalData();

  return { tripId, trip: mapTrip(tripData) };
}

export interface TripInvite {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export async function getInvites(tripId?: string): Promise<TripInvite[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase
    .from('trip_invites')
    .select('id, code, created_at, expires_at, used')
    .eq('trip_id', id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return data.map((r: any) => ({
    id: r.id,
    code: r.code,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    used: !!r.used,
  }));
}

// ---------- ADD FLIGHT ----------

type AddFlightInput = {
  tripId: string;
  direction: 'Outbound' | 'Return' | string;
  flightNumber: string;
  airline?: string;
  fromCity?: string;
  toCity?: string;
  departTime?: string;
  arriveTime?: string;
  bookingRef?: string;
  seatNumber?: string;
  passenger?: string;
};

function cleanRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function buildCurrentFlightRow(input: AddFlightInput) {
  return cleanRow({
    trip_id: input.tripId,
    direction: normalizeFlightDirection(input.direction),
    flight_number: input.flightNumber,
    ...(input.airline ? { airline: input.airline } : {}),
    ...(input.fromCity ? { origin: input.fromCity } : {}),
    ...(input.toCity ? { destination: input.toCity } : {}),
    ...(input.departTime ? { departure_time: input.departTime } : {}),
    ...(input.arriveTime ? { arrival_time: input.arriveTime } : {}),
    ...(input.bookingRef ? { confirmation: input.bookingRef } : {}),
    ...(input.seatNumber ? { seat_number: input.seatNumber } : {}),
    ...(input.passenger ? { passenger: input.passenger } : {}),
  });
}

function isSchemaCacheError(error: { message?: string; code?: string }) {
  return (
    error.message?.includes('schema cache') || error.message?.includes('Could not find') || error.code === 'PGRST204'
  );
}

function isMissingColumnError(error: { message?: string; code?: string }, column: string) {
  return (
    error.code === 'PGRST204' ||
    error.message?.includes(column) ||
    error.message?.includes('schema cache') ||
    error.message?.includes('Could not find')
  );
}

export async function addFlight(input: AddFlightInput): Promise<void> {
  const liveRow = {
    trip_id: input.tripId,
    direction: normalizeFlightDirection(input.direction),
    flight_number: input.flightNumber,
    ...(input.airline ? { airline: input.airline } : {}),
    ...(input.fromCity ? { origin: input.fromCity } : {}),
    ...(input.toCity ? { destination: input.toCity } : {}),
    ...(input.bookingRef ? { confirmation: input.bookingRef } : {}),
    ...(input.seatNumber ? { seat_number: input.seatNumber } : {}),
    ...(input.passenger ? { passenger: input.passenger } : {}),
  };

  const liveRowWithLegacySeat = {
    ...liveRow,
    seat_number: undefined,
    ...(input.seatNumber ? { seat: input.seatNumber } : {}),
  };

  const legacyRow = {
    trip_id: input.tripId,
    direction: normalizeFlightDirection(input.direction),
    flight_number: input.flightNumber,
    ...(input.airline ? { airline: input.airline } : {}),
    ...(input.fromCity ? { from_city: input.fromCity } : {}),
    ...(input.toCity ? { to_city: input.toCity } : {}),
    ...(input.bookingRef ? { booking_ref: input.bookingRef } : {}),
    ...(input.seatNumber ? { seat_number: input.seatNumber } : {}),
    ...(input.passenger ? { passenger: input.passenger } : {}),
  };

  const legacyRouteFallbackRow = {
    ...legacyRow,
    from_city: undefined,
    to_city: undefined,
    ...(input.fromCity ? { origin: input.fromCity } : {}),
    ...(input.toCity ? { destination: input.toCity } : {}),
  };

  const withTimeColumns = (base: Record<string, unknown>, departColumn?: string, arriveColumn?: string) => ({
    ...base,
    ...(departColumn && input.departTime ? { [departColumn]: input.departTime } : {}),
    ...(arriveColumn && input.arriveTime ? { [arriveColumn]: input.arriveTime } : {}),
  });

  const timeVariants: [string, string][] = [
    ['departure_time', 'arrival_time'],
    ['depart_time', 'arrive_time'],
    ['departure_time', 'arrive_time'],
    ['depart_time', 'arrival_time'],
    ['departure_at', 'arrival_at'],
    ['depart_at', 'arrive_at'],
  ];

  const rowsToTry: Record<string, unknown>[] = [];
  for (const [departColumn, arriveColumn] of timeVariants) {
    rowsToTry.push(withTimeColumns(liveRow, departColumn, arriveColumn));
    rowsToTry.push(withTimeColumns(liveRowWithLegacySeat, departColumn, arriveColumn));
    rowsToTry.push(withTimeColumns(legacyRow, departColumn, arriveColumn));
    rowsToTry.push(withTimeColumns(legacyRouteFallbackRow, departColumn, arriveColumn));
  }

  if (input.seatNumber) {
    const noSeatRows = rowsToTry.map(({ seat_number: _seatNumber, ...row }) => row);
    rowsToTry.push(...noSeatRows);
  }

  const errors: string[] = [];
  const seen = new Set<string>();
  for (const candidate of rowsToTry) {
    const row = cleanRow(candidate);
    const signature = Object.keys(row).sort().join('|');
    if (seen.has(signature)) continue;
    seen.add(signature);

    const { error } = await supabase.from(T.flights).insert(row);
    if (!error) return;

    errors.push(`${signature}: ${error.message}`);
    if (!isSchemaCacheError(error)) throw new Error(`addFlight: ${error.message}`);
  }

  throw new Error(`addFlight: could not match flights schema. Last error: ${errors.at(-1) ?? 'unknown error'}`);
}

export async function replaceTripFlights(tripId: string, flights: Omit<AddFlightInput, 'tripId'>[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('replaceTripFlights: not authenticated');

  const rpcFlights = flights.map((flight) => ({
    direction: flight.direction,
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    fromCity: flight.fromCity,
    toCity: flight.toCity,
    departTime: flight.departTime,
    arriveTime: flight.arriveTime,
    bookingRef: flight.bookingRef,
    seatNumber: flight.seatNumber,
    passenger: flight.passenger,
  }));

  const { error: rpcError } = await supabase.rpc('replace_trip_flights_from_scan', {
    p_trip_id: tripId,
    p_flights: rpcFlights,
  });
  if (!rpcError) return;

  const canFallbackToPostgrest =
    rpcError.code === 'PGRST202' ||
    rpcError.code === '42883' ||
    rpcError.message?.includes('replace_trip_flights_from_scan') ||
    rpcError.message?.includes('schema cache');
  if (!canFallbackToPostgrest) {
    throw new Error(`replaceTripFlights: ${rpcError.message}`);
  }

  const { error: deleteError } = await supabase
    .from(T.flights)
    .delete()
    .eq('trip_id', tripId)
    .or('passenger.is.null,passenger.eq.');
  if (deleteError) throw new Error(`replaceTripFlights: ${deleteError.message}`);

  const scannedPassengers = Array.from(
    new Set(flights.map((flight) => flight.passenger?.trim()).filter((passenger): passenger is string => !!passenger)),
  );

  for (const passenger of scannedPassengers) {
    const { error: passengerDeleteError } = await supabase
      .from(T.flights)
      .delete()
      .eq('trip_id', tripId)
      .eq('passenger', passenger);
    if (passengerDeleteError) throw new Error(`replaceTripFlights: ${passengerDeleteError.message}`);
  }

  if (flights.length === 0) return;

  const liveRows = flights.map((flight) => buildCurrentFlightRow({ ...flight, tripId }));
  const { error: bulkError } = await supabase.from(T.flights).insert(liveRows);
  if (!bulkError) return;
  if (!isSchemaCacheError(bulkError)) {
    throw new Error(`replaceTripFlights: ${bulkError.message}`);
  }

  for (const flight of flights) {
    await addFlight({ ...flight, tripId });
  }
}

// ---------- GROUP CHAT ----------

export interface ChatMessage {
  id: string;
  tripId: string;
  senderName: string;
  senderAvatar?: string;
  senderUserId?: string;
  message: string;
  createdAt: string;
}

export async function getChatMessages(tripId?: string): Promise<ChatMessage[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('trip_id', id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw new Error(`getChatMessages: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    tripId: row.trip_id,
    senderName: row.sender_name ?? '',
    senderAvatar: row.sender_avatar ?? undefined,
    senderUserId: row.sender_user_id ?? undefined,
    message: row.message ?? '',
    createdAt: row.created_at,
  }));
}

export async function sendChatMessage(input: {
  tripId?: string;
  senderName: string;
  senderAvatar?: string;
  senderUserId?: string;
  message: string;
}): Promise<void> {
  const id = await resolveTripId(input.tripId);
  const { error } = await supabase.from('chat_messages').insert({
    trip_id: id,
    sender_name: input.senderName,
    sender_avatar: input.senderAvatar ?? null,
    sender_user_id: input.senderUserId ?? null,
    message: input.message.trim(),
  });
  if (error) throw new Error(`sendChatMessage: ${error.message}`);
}

export function subscribeToChatMessages(tripId: string, onMessage: (msg: ChatMessage) => void) {
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
        const row = payload.new;
        onMessage({
          id: row.id,
          tripId: row.trip_id,
          senderName: row.sender_name ?? '',
          senderAvatar: row.sender_avatar ?? undefined,
          senderUserId: row.sender_user_id ?? undefined,
          message: row.message ?? '',
          createdAt: row.created_at,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------- ADD GROUP MEMBER ----------

export async function addGroupMember(input: {
  tripId?: string;
  name: string;
  email?: string;
  phone?: string;
  role?: 'Primary' | 'Member';
}): Promise<void> {
  const id = await resolveTripId(input.tripId);
  const { error } = await supabase.from(T.groupMembers).insert({
    trip_id: id,
    name: input.name.trim(),
    role: input.role ?? 'Member',
    ...(input.email ? { email: input.email.trim() } : {}),
    ...(input.phone ? { phone: input.phone.trim() } : {}),
  });
  if (error) throw new Error(`addGroupMember: ${error.message}`);
}

export async function removeGroupMember(memberId: string): Promise<void> {
  const { data: member, error: readError } = await supabase
    .from(T.groupMembers)
    .select('role')
    .eq('id', memberId)
    .single();
  if (readError) throw new Error(`removeGroupMember: ${readError.message}`);
  if ((member?.role as string) === 'Primary') {
    throw new Error('The trip organizer cannot be removed.');
  }

  const { error } = await supabase.from(T.groupMembers).delete().eq('id', memberId);
  if (error) throw new Error(`removeGroupMember: ${error.message}`);
}

export async function updateMyTripMemberPreferences(
  tripId: string,
  input: { sharesAccommodation?: boolean; travelNotes?: string },
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('updateMyTripMemberPreferences: not authenticated');

  const { error } = await supabase
    .from(T.groupMembers)
    .update({
      ...(input.sharesAccommodation != null ? { shares_accommodation: input.sharesAccommodation } : {}),
      ...(input.travelNotes != null ? { travel_notes: input.travelNotes } : {}),
    })
    .eq('trip_id', tripId)
    .eq('user_id', user.id);

  if (error) throw new Error(`updateMyTripMemberPreferences: ${error.message}`);
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
  'Room Type': 'room_type',
  'Booking Ref': 'booking_ref',
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
  'Start Date': 'start_date',
  'End Date': 'end_date',
  'Budget Limit': 'budget_limit',
  Currency: 'currency',
  status: 'status',
};

export async function updateTripProperty(tripId: string, key: string, value: string): Promise<void> {
  const column = TRIP_PROPERTY_MAP[key];
  if (!column) throw new Error(`updateTripProperty: unknown key "${key}"`);
  const { error } = await supabase
    .from(T.trips)
    .update({ [column]: value })
    .eq('id', tripId);
  if (error) throw new Error(`updateTripProperty: ${error.message}`);
}

export async function updateTripFromScan(
  tripId: string,
  input: {
    destination?: string;
    startDate?: string;
    endDate?: string;
    accommodation?: string;
    address?: string;
    checkIn?: string;
    checkOut?: string;
    roomType?: string;
    bookingRef?: string;
    cost?: number;
    costCurrency?: string;
  },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (input.destination) row.destination = input.destination;
  if (input.startDate) row.start_date = input.startDate;
  if (input.endDate) row.end_date = input.endDate;
  if (input.accommodation) row.accommodation_name = input.accommodation;
  if (input.address) row.accommodation_address = input.address;
  if (input.checkIn) row.check_in = input.checkIn;
  if (input.checkOut) row.check_out = input.checkOut;
  if (input.roomType) row.room_type = input.roomType;
  if (input.bookingRef) row.booking_ref = input.bookingRef;
  if (input.cost != null) row.budget_limit = input.cost;
  if (input.costCurrency) row.currency = input.costCurrency;

  if (input.startDate && input.endDate) {
    const now = new Date();
    const start = new Date(input.startDate + 'T00:00:00+08:00');
    const end = new Date(input.endDate + 'T23:59:59+08:00');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      row.status = now > end ? 'Completed' : now > start ? 'Active' : 'Planning';
    }
  }

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from(T.trips).update(row).eq('id', tripId);
  if (error) throw new Error(`updateTripFromScan: ${error.message}`);
  cachedTrip = undefined;
  invalidateTripCache(tripId);
}

export async function updateTripBudgetMode(tripId: string, mode: 'Limited' | 'Unlimited'): Promise<void> {
  const { error } = await supabase.from(T.trips).update({ budget_mode: mode }).eq('id', tripId);
  if (error) throw new Error(`updateTripBudgetMode: ${error.message}`);
}

export async function updateTripBudgetLimit(tripId: string, limit: number): Promise<void> {
  const { error } = await supabase.from(T.trips).update({ budget_limit: limit }).eq('id', tripId);
  if (error) throw new Error(`updateTripBudgetLimit: ${error.message}`);
}

export async function updateHotelCoordinates(tripId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.from(T.trips).update({ hotel_lat: lat, hotel_lng: lng }).eq('id', tripId);
  if (error) throw new Error(`updateHotelCoordinates: ${error.message}`);
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
  const { data, error } = await supabase.from(T.trips).select('payment_qrs').eq('id', tripId).single();
  if (error || !data) return [];
  return (data.payment_qrs as PaymentQr[]) ?? [];
}

export async function addPaymentQr(tripId: string, label: string, localUri: string): Promise<PaymentQr[]> {
  // Upload image to storage
  const ext = 'jpeg';
  const rand = Math.random().toString(36).slice(2, 6);
  const storagePath = `payment-qr/${tripId}/${label.toLowerCase().replace(/\s+/g, '-')}-${rand}.${ext}`;

  const bytes = await readFileAsBytes(localUri);

  const { error: uploadError } = await supabase.storage
    .from('moments')
    .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw new Error(`addPaymentQr upload: ${uploadError.message}`);

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // Get current list, append, save
  const current = await getPaymentQrs(tripId);
  const next = [...current, { label, uri: publicUrl }];

  const { error } = await supabase.from(T.trips).update({ payment_qrs: next }).eq('id', tripId);
  if (error) throw new Error(`addPaymentQr save: ${error.message}`);

  return next;
}

export async function addGeneratedPaymentQr(
  tripId: string,
  label: string,
  qrData: string,
  bank: string,
): Promise<PaymentQr[]> {
  const current = await getPaymentQrs(tripId);
  const next = [...current, { label, uri: '', qrData, bank }];
  const { error } = await supabase.from(T.trips).update({ payment_qrs: next }).eq('id', tripId);
  if (error) throw new Error(`addGeneratedPaymentQr: ${error.message}`);
  return next;
}

export async function removePaymentQr(tripId: string, index: number): Promise<PaymentQr[]> {
  const current = await getPaymentQrs(tripId);
  const next = current.filter((_, i) => i !== index);

  const { error } = await supabase.from(T.trips).update({ payment_qrs: next }).eq('id', tripId);
  if (error) throw new Error(`removePaymentQr: ${error.message}`);

  return next;
}

// ── Expense Splits (per-member assignment) ───────────────────────────

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  tripId: string;
  memberId: string;
  memberName: string;
  amount: number;
  settled: boolean;
  settledAt?: string;
}

function mapSplit(row: Record<string, unknown>): ExpenseSplit {
  return {
    id: row.id as string,
    expenseId: row.expense_id as string,
    tripId: row.trip_id as string,
    memberId: row.member_id as string,
    memberName: row.member_name as string,
    amount: Number(row.amount ?? 0),
    settled: (row.settled as boolean) ?? false,
    settledAt: (row.settled_at as string) ?? undefined,
  };
}

export async function addExpenseSplits(
  expenseId: string,
  tripId: string,
  splits: { memberId: string; memberName: string; amount: number }[],
): Promise<ExpenseSplit[]> {
  if (splits.length === 0) return [];
  const rows = splits.map((s) => ({
    expense_id: expenseId,
    trip_id: tripId,
    member_id: s.memberId,
    member_name: s.memberName,
    amount: s.amount,
  }));
  const { data, error } = await supabase.from('expense_splits').insert(rows).select();
  if (error) throw new Error(`addExpenseSplits: ${error.message}`);
  return (data ?? []).map((r) => mapSplit(r as Record<string, unknown>));
}

export async function getExpenseSplits(expenseId: string): Promise<ExpenseSplit[]> {
  const { data, error } = await supabase
    .from('expense_splits')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at');
  if (error) throw new Error(`getExpenseSplits: ${error.message}`);
  return (data ?? []).map((r) => mapSplit(r as Record<string, unknown>));
}

export async function getTripSplits(tripId: string): Promise<ExpenseSplit[]> {
  const { data, error } = await supabase.from('expense_splits').select('*').eq('trip_id', tripId).order('created_at');
  if (error) throw new Error(`getTripSplits: ${error.message}`);
  return (data ?? []).map((r) => mapSplit(r as Record<string, unknown>));
}

export async function settleExpenseSplit(splitId: string): Promise<void> {
  const { error } = await supabase
    .from('expense_splits')
    .update({ settled: true, settled_at: new Date().toISOString() })
    .eq('id', splitId);
  if (error) throw new Error(`settleExpenseSplit: ${error.message}`);
}

export async function unsettleExpenseSplit(splitId: string): Promise<void> {
  const { error } = await supabase
    .from('expense_splits')
    .update({ settled: false, settled_at: null })
    .eq('id', splitId);
  if (error) throw new Error(`unsettleExpenseSplit: ${error.message}`);
}

/** Calculate net balances between group members for a trip */
export interface MemberBalance {
  memberId: string;
  memberName: string;
  totalOwed: number;
  totalPaid: number;
  net: number; // positive = owed to them, negative = they owe
  settled: number;
  unsettled: number;
}

export async function getTripBalances(
  tripId: string,
  expenses: Expense[],
  members: GroupMember[],
): Promise<MemberBalance[]> {
  const splits = await getTripSplits(tripId);

  const balances = new Map<string, MemberBalance>();
  for (const m of members) {
    balances.set(m.id, {
      memberId: m.id,
      memberName: m.name,
      totalOwed: 0,
      totalPaid: 0,
      net: 0,
      settled: 0,
      unsettled: 0,
    });
  }

  // Sum what each member paid
  for (const e of expenses) {
    const payer = members.find((m) => m.name === e.paidBy);
    if (payer) {
      const b = balances.get(payer.id);
      if (b) b.totalPaid += e.amount;
    }
  }

  // Sum what each member owes from splits
  for (const s of splits) {
    const b = balances.get(s.memberId);
    if (b) {
      b.totalOwed += s.amount;
      if (s.settled) b.settled += s.amount;
      else b.unsettled += s.amount;
    }
  }

  // Net = paid - owed (positive means others owe you)
  for (const b of balances.values()) {
    b.net = b.totalPaid - b.totalOwed;
  }

  return [...balances.values()];
}

// ── User-scoped Payment QR Codes ─────────────────────────────────────

export interface UserPaymentQr {
  id: string;
  label: string;
  uri: string;
  qrData?: string;
  bank?: string;
}

export async function addUserPaymentQr(userId: string, label: string, localUri: string): Promise<UserPaymentQr> {
  const ext = 'jpeg';
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `payment-qr/user/${userId}/${label.toLowerCase().replace(/\s+/g, '-')}-${rand}.${ext}`;

  const bytes = await readFileAsBytes(localUri);
  const { error: uploadErr } = await supabase.storage
    .from('moments')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (uploadErr) throw new Error(`Upload QR: ${uploadErr.message}`);

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Store in profile JSON column (no separate table needed)
  const { data: profile } = await supabase.from('profiles').select('payment_qrs').eq('id', userId).single();

  const current: UserPaymentQr[] = (profile?.payment_qrs as UserPaymentQr[]) ?? [];
  const newQr: UserPaymentQr = { id: `qr-${Date.now()}`, label, uri: publicUrl };
  const next = [...current, newQr];

  const { error } = await supabase.from('profiles').update({ payment_qrs: next }).eq('id', userId);
  if (error) throw new Error(`addUserPaymentQr: ${error.message}`);

  return newQr;
}

export async function getUserPaymentQrs(userId: string): Promise<UserPaymentQr[]> {
  const { data, error } = await supabase.from('profiles').select('payment_qrs').eq('id', userId).single();
  if (error) return [];
  return (data?.payment_qrs as UserPaymentQr[]) ?? [];
}

export async function removeUserPaymentQr(qrId: string): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return;

  const { data: profile } = await supabase.from('profiles').select('payment_qrs').eq('id', userId).single();

  const current: UserPaymentQr[] = (profile?.payment_qrs as UserPaymentQr[]) ?? [];
  const next = current.filter((q) => q.id !== qrId);

  await supabase.from('profiles').update({ payment_qrs: next }).eq('id', userId);
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
    });
    if (error || !data?.items) return { items: [], cached: false };
    return data as { items: CuratedItem[]; cached: boolean };
  } catch {
    return { items: [], cached: false };
  }
}

// ---------- DESTINATION OVERVIEW ----------

export async function getDestinationOverview(
  destination: string,
): Promise<import('./types').DestinationOverview | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-recommend', {
      body: { destination, category: 'destination-overview' },
    });
    if (error || !data?.overview) return null;
    return data.overview as import('./types').DestinationOverview;
  } catch {
    return null;
  }
}

// ---------- FLIGHTS ----------

export async function getFlights(tripId?: string): Promise<Flight[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase
    .from(T.flights)
    .select('*')
    .eq('trip_id', id)
    .order('departure_time', { ascending: true });

  if (error) throw new Error(`getFlights: ${error.message}`);
  return (data ?? []).map(mapFlight);
}

// ---------- GROUP MEMBERS ----------

export async function getGroupMembers(tripId?: string): Promise<GroupMember[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase.from(T.groupMembers).select('*').eq('trip_id', id);

  if (error) throw new Error(`getGroupMembers: ${error.message}`);
  return (data ?? []).map(mapMember);
}

export async function updateMemberPhoto(memberId: string, localUri: string): Promise<void> {
  const compressed = await compressImage(localUri, 400, 0.5);
  const timestamp = Date.now();
  const filename = localUri.split('/').pop() ?? 'avatar.jpg';
  const storagePath = `avatars/${memberId}-${timestamp}-${filename}`;

  const response = await fetch(compressed);
  const blob = await response.blob();
  const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Try avatars bucket first, fall back to moments bucket
  let publicUrl = '';
  const buckets = ['avatars', 'moments'] as const;
  for (const bucket of buckets) {
    const path = bucket === 'avatars' ? storagePath : `avatars/${storagePath}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      publicUrl = urlData.publicUrl;
      break;
    }
    // If last bucket also fails, throw
    if (bucket === buckets[buckets.length - 1]) {
      throw new Error(`updateMemberPhoto upload: ${uploadError.message}`);
    }
  }

  const { error } = await supabase.from(T.groupMembers).update({ avatar_url: publicUrl }).eq('id', memberId);
  if (error) throw new Error(`updateMemberPhoto: ${error.message}`);
}

export async function updateMemberEmail(memberId: string, email: string): Promise<void> {
  const { error } = await supabase.from(T.groupMembers).update({ email }).eq('id', memberId);
  if (error) throw new Error(`updateMemberEmail: ${error.message}`);
}

export async function updateMemberPhone(memberId: string, phone: string): Promise<void> {
  const { error } = await supabase.from(T.groupMembers).update({ phone }).eq('id', memberId);
  if (error) throw new Error(`updateMemberPhone: ${error.message}`);
}

// ---------- PACKING ----------

export async function getPackingList(tripId?: string): Promise<PackingItem[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase.from(T.packingItems).select('*').eq('trip_id', id);

  if (error) throw new Error(`getPackingList: ${error.message}`);
  return (data ?? []).map(mapPacking);
}

export async function addPackingItem(input: Omit<PackingItem, 'id' | 'packed'> & { tripId?: string }): Promise<void> {
  const id = await resolveTripId(input.tripId);
  const { error } = await supabase.from(T.packingItems).insert({
    trip_id: id,
    name: input.item,
    category: input.category,
    is_packed: false,
    ...(input.owner ? { owner: input.owner } : {}),
  });
  if (error) throw new Error(`addPackingItem: ${error.message}`);
}

export async function updatePackingItem(
  itemId: string,
  input: Partial<Pick<PackingItem, 'item' | 'category' | 'owner'>>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.item != null) updates.name = input.item;
  if (input.category != null) updates.category = input.category;
  if (input.owner !== undefined) updates.owner = input.owner || null;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase.from(T.packingItems).update(updates).eq('id', itemId);
  if (error) throw new Error(`updatePackingItem: ${error.message}`);
}

export async function deletePackingItem(itemId: string): Promise<void> {
  const { error } = await supabase.from(T.packingItems).delete().eq('id', itemId);
  if (error) throw new Error(`deletePackingItem: ${error.message}`);
}

export async function togglePacked(itemId: string, packed: boolean): Promise<void> {
  const { error } = await supabase.from(T.packingItems).update({ is_packed: packed }).eq('id', itemId);
  if (error) throw new Error(`togglePacked: ${error.message}`);
}

// ---------- EXPENSES ----------

export async function getExpenses(tripId?: string): Promise<Expense[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase
    .from(T.expenses)
    .select('*')
    .eq('trip_id', id)
    .order('expense_date', { ascending: false });

  if (error) throw new Error(`getExpenses: ${error.message}`);
  return (data ?? []).map(mapExpense);
}

export async function addExpense(
  input: Omit<Expense, 'id'> & { tripId?: string; standalone?: boolean },
): Promise<Expense & { tripId?: string }> {
  let tripId: string | null = null;
  if (!input.standalone) {
    tripId = await resolveTripId(input.tripId);
  }

  const { data: authData } = await supabase.auth.getUser();
  const receiptUpload = await uploadExpenseReceiptPhoto(input.photo);

  const { data, error } = await supabase
    .from(T.expenses)
    .insert({
      ...(tripId ? { trip_id: tripId } : {}),
      ...(input.standalone ? { user_id: authData?.user?.id } : {}),
      title: input.description,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      expense_date: input.date,
      ...(input.paidBy ? { paid_by: input.paidBy } : {}),
      ...(receiptUpload.publicUrl ? { photo_url: receiptUpload.publicUrl } : {}),
      ...(input.placeName ? { place_name: input.placeName } : {}),
      ...(input.placeLatitude != null ? { place_latitude: input.placeLatitude } : {}),
      ...(input.placeLongitude != null ? { place_longitude: input.placeLongitude } : {}),
      ...(input.splitType ? { split_type: input.splitType } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    })
    .select()
    .single();
  if (error && receiptUpload.storagePath) {
    await supabase.storage.from('moments').remove([receiptUpload.storagePath]).catch(() => {});
  }
  if (error) throw new Error(`addExpense: ${error.message}`);

  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    description: (row.title as string) ?? '',
    amount: Number(row.amount ?? 0),
    currency: (row.currency as string) ?? 'PHP',
    category: (row.category as Expense['category']) ?? 'Other',
    date: (row.expense_date as string) ?? '',
    paidBy: (row.paid_by as string) ?? undefined,
    splitType: (row.split_type as Expense['splitType']) ?? undefined,
    tripId: (row.trip_id as string) ?? undefined,
  };
}

export async function updateExpense(expenseId: string, input: Partial<Omit<Expense, 'id'>>): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.description != null) updates.title = input.description;
  if (input.amount != null) updates.amount = input.amount;
  if (input.currency != null) updates.currency = input.currency;
  if (input.category != null) updates.category = input.category;
  if (input.date != null) updates.expense_date = input.date;
  if (input.paidBy != null) updates.paid_by = input.paidBy;
  if (input.photo != null) updates.photo_url = input.photo;
  if (input.placeName != null) updates.place_name = input.placeName;
  if (input.placeLatitude != null) updates.place_latitude = input.placeLatitude;
  if (input.placeLongitude != null) updates.place_longitude = input.placeLongitude;
  if (input.splitType != null) updates.split_type = input.splitType;
  if (input.notes != null) updates.notes = input.notes;

  const { error } = await supabase.from(T.expenses).update(updates).eq('id', expenseId);
  if (error) throw new Error(`updateExpense: ${error.message}`);
}

export async function deleteExpense(expenseId: string): Promise<void> {
  return deletePage(expenseId, T.expenses);
}

export async function getExpenseSummary(
  tripId?: string,
): Promise<{ total: number; byCategory: Record<string, number>; count: number }> {
  const expenses = await getExpenses(tripId);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    total += e.amount;
  }
  return { total, byCategory, count: expenses.length };
}

// ---------- PLACES ----------

export async function getSavedPlaces(tripId?: string): Promise<Place[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase.from(T.places).select('*').eq('trip_id', id);

  if (error) throw new Error(`getSavedPlaces: ${error.message}`);
  return (data ?? []).map(mapPlace);
}

export async function addPlace(input: Omit<Place, 'id'> & { tripId?: string }): Promise<void> {
  const id = await resolveTripId(input.tripId);
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
  });
  if (error) throw new Error(`addPlace: ${error.message}`);
}

export async function voteOnPlace(placeId: string, vote: PlaceVote): Promise<void> {
  const { error } = await supabase.from(T.places).update({ vote }).eq('id', placeId);
  if (error) throw new Error(`voteOnPlace: ${error.message}`);
}

export async function savePlace(placeId: string, saved: boolean): Promise<void> {
  const { error } = await supabase.from(T.places).update({ saved }).eq('id', placeId);
  if (error) throw new Error(`savePlace: ${error.message}`);
}

// ---------- GROUP VOTING ----------

/** Derive consensus vote from per-member votes. Strict majority wins; equal splits stay Pending. */
export function deriveConsensus(votes: Record<string, PlaceVote>, totalMembers: number): PlaceVote {
  const entries = Object.values(votes);
  const yes = entries.filter((v) => v === '👍 Yes').length;
  const no = entries.filter((v) => v === '👎 No').length;
  // Equal split = tie (Pending), not a Yes win
  if (yes === no && yes > 0) return 'Pending';
  const majority = Math.ceil(totalMembers / 2);
  if (yes >= majority) return '👍 Yes';
  if (no >= majority) return '👎 No';
  return 'Pending';
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
  const { data, error: readErr } = await supabase.from(T.places).select('vote_by_member').eq('id', placeId).single();
  if (readErr) throw new Error(`voteAsMember read: ${readErr.message}`);

  const current = (data?.vote_by_member as Record<string, PlaceVote>) ?? {};
  const updated = { ...current, [memberId]: vote };
  const consensus = deriveConsensus(updated, totalMembers);

  const { error: writeErr } = await supabase
    .from(T.places)
    .update({ vote_by_member: updated, vote: consensus })
    .eq('id', placeId);
  if (writeErr) throw new Error(`voteAsMember write: ${writeErr.message}`);

  return updated;
}

/** Subscribe to vote changes on places for a trip. Returns unsubscribe function. */
export function subscribeToPlaceVotes(
  tripId: string,
  onUpdate: (placeId: string, voteByMember: Record<string, PlaceVote>, vote: PlaceVote) => void,
): () => void {
  const channelName = `place-votes:${tripId}`;

  // Remove any existing channel with the same name to avoid duplicate subscription error
  const existing = supabase.getChannels().find((ch) => ch.topic === `realtime:${channelName}`);
  if (existing) supabase.removeChannel(existing);

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
        const row = payload.new;
        if (row.vote_by_member) {
          onUpdate(row.id, row.vote_by_member as Record<string, PlaceVote>, (row.vote as PlaceVote) ?? 'Pending');
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
    const members = await getGroupMembers(tripId);
    const targets = members.filter((m) => m.userId && m.userId !== recommenderUserId);
    if (targets.length === 0) return;

    const rows = targets.map((m) => ({
      id: createNotificationId(),
      user_id: m.userId!,
      trip_id: tripId,
      type: 'vote_needed',
      title: `${recommenderName} recommends ${placeName}`,
      body: 'Tap to vote — should the group visit this place?',
      data: { type: 'vote_needed', tripId, placeId, placeName, recommenderName },
      read: false,
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (!error) rows.forEach((row) => queuePushForNotification(row));
  } catch {
    // Notifications table might not exist yet — silently ignore
  }
}

// ---------- ROCK PAPER SCISSORS TIEBREAKER ----------

export type RPSMove = 'rock' | 'paper' | 'scissors';
export type RPSGameStatus = 'playing' | 'settled';

export interface RPSGameState {
  status: RPSGameStatus;
  moves: Record<string, RPSMove>; // memberId → move
  winner?: string; // memberId of winner
  winnerVote?: PlaceVote; // the vote that wins
  round: number;
}

/** Determine RPS winner between two moves. Returns 1 if a wins, -1 if b wins, 0 if tie. */
function rpsResult(a: RPSMove, b: RPSMove): number {
  if (a === b) return 0;
  if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper'))
    return 1;
  return -1;
}

/** Resolve RPS game: find winner among all moves. Returns winnerId or null if tie. */
function resolveRps(
  moves: Record<string, RPSMove>,
  memberVotes: Record<string, PlaceVote>,
): { winnerId: string | null; winnerVote: PlaceVote | null } {
  const ids = Object.keys(moves);
  if (ids.length < 2) return { winnerId: null, winnerVote: null };

  // For 2 players: direct comparison
  if (ids.length === 2) {
    const result = rpsResult(moves[ids[0]], moves[ids[1]]);
    if (result === 0) return { winnerId: null, winnerVote: null };
    const winnerId = result === 1 ? ids[0] : ids[1];
    return { winnerId, winnerVote: memberVotes[winnerId] ?? '👍 Yes' };
  }

  // For 3+ players: count unique moves. If all same or all different → tie.
  const uniqueMoves = new Set(Object.values(moves));
  if (uniqueMoves.size === 1 || uniqueMoves.size === 3) {
    return { winnerId: null, winnerVote: null };
  }
  // Exactly 2 unique moves: the winning move beats the losing move
  const moveArr = Array.from(uniqueMoves) as RPSMove[];
  const winningMove = rpsResult(moveArr[0], moveArr[1]) === 1 ? moveArr[0] : moveArr[1];
  // Winners are all players who picked the winning move
  const winners = ids.filter((id) => moves[id] === winningMove);
  // Pick the first winner (deterministic)
  const winnerId = winners[0];
  return { winnerId, winnerVote: memberVotes[winnerId] ?? '👍 Yes' };
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
  const { data, error: readErr } = await supabase.from(T.places).select('rps_game_state').eq('id', placeId).single();
  if (readErr) throw new Error(`submitRpsMove read: ${readErr.message}`);

  const current: RPSGameState = data?.rps_game_state ?? {
    status: 'playing',
    moves: {},
    round: 1,
  };

  // Add this member's move
  const updatedMoves = { ...current.moves, [memberId]: move };
  const allIn = Object.keys(updatedMoves).length >= totalMembers;

  let newState: RPSGameState;

  if (allIn) {
    // Resolve the game
    const { winnerId, winnerVote } = resolveRps(updatedMoves, memberVotes);
    if (winnerId && winnerVote) {
      newState = {
        status: 'settled',
        moves: updatedMoves,
        winner: winnerId,
        winnerVote,
        round: current.round,
      };
      // Update the place vote to the winner's vote
      await supabase
        .from(T.places)
        .update({
          rps_game_state: newState,
          vote: winnerVote,
        })
        .eq('id', placeId);
    } else {
      // Tie in RPS — reset for another round
      newState = {
        status: 'playing',
        moves: {},
        round: current.round + 1,
      };
      await supabase.from(T.places).update({ rps_game_state: newState }).eq('id', placeId);
    }
  } else {
    // Still waiting for others
    newState = { ...current, moves: updatedMoves };
    await supabase.from(T.places).update({ rps_game_state: newState }).eq('id', placeId);
  }

  return newState;
}

/** Subscribe to RPS game state changes on a specific place. */
export function subscribeToPlaceRps(placeId: string, onUpdate: (state: RPSGameState | null) => void): () => void {
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
        onUpdate(payload.new.rps_game_state ?? null);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Reset RPS game state for a place (for revote). */
export async function resetRpsGame(placeId: string): Promise<void> {
  await supabase.from(T.places).update({ rps_game_state: null, vote: 'Pending' }).eq('id', placeId);
}

// ---------- NOTIFICATION HELPERS ----------

type NotificationInsertRecord = {
  id: string;
  user_id: string;
  trip_id?: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
};

function createNotificationId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) return randomUUID.call(globalThis.crypto);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rnd = Math.floor(Math.random() * 16);
    const val = char === 'x' ? rnd : (rnd & 0x3) | 0x8;
    return val.toString(16);
  });
}

function queuePushForNotification(record: NotificationInsertRecord): void {
  supabase.functions
    .invoke('send-push-notification', {
      body: { type: 'INSERT', record },
    })
    .then(({ error }) => {
      if (error && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[pushNotification] delivery failed:', error.message);
      }
    })
    .catch((err) => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[pushNotification] delivery error:', err);
      }
    });
}

/** Generic notification insert — all specific notifiers delegate to this. */
async function insertNotification(opts: {
  userId: string;
  tripId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}): Promise<void> {
  try {
    // Check user's notification preferences before inserting
    const { shouldNotify } = await import('@/lib/notificationPrefs');
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', opts.userId)
      .single();
    const prefs = (profile?.notification_prefs as Record<string, unknown>) ?? {};

    // Fetch trip dates for phase check
    let tripStart: string | undefined;
    let tripEnd: string | undefined;
    if (opts.tripId) {
      const { data: tripRow } = await supabase
        .from(T.trips)
        .select('start_date, end_date')
        .eq('id', opts.tripId)
        .single();
      tripStart = tripRow?.start_date as string | undefined;
      tripEnd = tripRow?.end_date as string | undefined;
    }

    if (
      !shouldNotify(opts.type, prefs, {
        tripId: opts.tripId,
        tripStartDate: tripStart,
        tripEndDate: tripEnd,
      })
    ) {
      return; // User has suppressed this notification category/phase/trip
    }

    const record: NotificationInsertRecord = {
      id: createNotificationId(),
      user_id: opts.userId,
      trip_id: opts.tripId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      data: { ...opts.data, type: opts.type },
      read: false,
    };
    const { error: insertErr } = await supabase.from('notifications').insert(record);
    if (insertErr && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[insertNotification] failed:', insertErr.message);
    }
    if (!insertErr) queuePushForNotification(record);
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[insertNotification] error:', err);
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
  const members = await getGroupMembers(tripId);
  const targets = members.filter((m) => m.userId && m.userId !== excludeUserId);
  for (const m of targets) {
    await insertNotification({
      userId: m.userId!,
      tripId,
      type,
      title,
      body,
      data,
    });
  }
}

/** Notify members that a new expense was added (group trips only, 2+ members). */
export async function notifyExpenseAdded(
  tripIdOrEmpty: string,
  expense: { description: string; amount: number; paidBy: string; currency?: string },
  addedByUserId: string,
): Promise<void> {
  try {
    const tripId = await resolveTripId(tripIdOrEmpty || undefined);
    const members = await getGroupMembers(tripId);
    if (members.length < 2) return;
    const currency = expense.currency ?? 'PHP';
    await notifyAllMembers(
      tripId,
      'expense_added',
      `${expense.paidBy} added an expense`,
      `${expense.description} — ${currency} ${expense.amount.toLocaleString()}`,
      { expenseDescription: expense.description, amount: expense.amount },
      addedByUserId,
    );
  } catch {
    /* best-effort */
  }
}

/** Notify existing members when someone joins the trip. */
export async function notifyMemberJoined(tripId: string, memberName: string, joinerUserId: string): Promise<void> {
  try {
    await notifyAllMembers(
      tripId,
      'member_joined',
      `${memberName} joined the trip!`,
      'Your travel group just grew. Say hello!',
      { memberName },
      joinerUserId,
    );
  } catch {
    /* best-effort */
  }
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
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('trip_id', tripId)
      .eq('type', 'budget_threshold')
      .gte('created_at', today)
      .limit(1);
    if (existing && existing.length > 0) return;

    const diff = Math.round(projected - budget);
    const members = await getGroupMembers(tripId);
    for (const m of members) {
      if (!m.userId) continue;
      await insertNotification({
        userId: m.userId,
        tripId,
        type: 'budget_threshold',
        title: 'Budget alert',
        body: `Projected ${currency} ${Math.round(projected).toLocaleString()} — ${currency} ${diff.toLocaleString()} over budget`,
        data: { projected, budget },
      });
    }
  } catch {
    /* best-effort */
  }
}

// ---------- CHECKLIST ----------

export async function getChecklist(tripId?: string): Promise<ChecklistItem[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase
    .from(T.checklist)
    .select('*')
    .eq('trip_id', id)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`getChecklist: ${error.message}`);
  return (data ?? []).map(mapChecklist);
}

// ---------- MOMENTS ----------

export async function getMoments(tripId?: string): Promise<Moment[]> {
  const id = await resolveTripId(tripId);

  // Fetch all moments for the trip — RLS enforces trip membership.
  // Filter client-side for visibility so we don't break on PostgREST syntax edge cases.
  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('trip_id', id)
    .order('taken_at', { ascending: false });

  if (error) throw new Error(`getMoments: ${error.message}`);

  // Client-side visibility filter: show shared + legacy (null user_id) + own private/album
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const uid = authUser?.id;
  const filtered = (data ?? []).filter((row) => {
    const vis = (row.visibility as string) ?? 'shared';
    if (vis === 'shared') return true;
    // Private/album moments: only visible to the uploader
    if (uid && row.user_id === uid) return true;
    return false;
  });

  return filtered.map(mapMoment);
}

// Build a human-readable filename for moment photos.
// e.g. "sunset-white-beach-apr20-a3f1.jpg" instead of "1745123456789-IMG_20260420.jpg"
const MOMENT_NAME_POOL = [
  'golden-hour',
  'island-vibes',
  'travel-snap',
  'on-the-go',
  'good-times',
  'wander',
  'explore',
  'memory',
  'getaway',
  'escape',
] as const;

function isUuid(value?: string): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function buildMomentFilename(
  input: { tags?: string[]; location?: string; date: string; caption?: string },
  ext: string,
): string {
  const parts: string[] = [];
  const tags = Array.isArray(input.tags) ? input.tags.filter(Boolean) : [];

  // Use first tag if available, otherwise pick from pool
  if (tags.length > 0) {
    parts.push(tags[0].toLowerCase());
  } else if (input.caption && input.caption !== 'Untitled') {
    // Use first word of caption
    const word = input.caption
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (word.length >= 2) parts.push(word);
  }
  if (parts.length === 0) {
    parts.push(MOMENT_NAME_POOL[Math.floor(Math.random() * MOMENT_NAME_POOL.length)]);
  }

  // Add short location slug
  if (input.location) {
    const slug = input.location
      .split(',')[0]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
    if (slug) parts.push(slug);
  }

  // Add date as "apr20" format
  const d = new Date(input.date + 'T00:00:00+08:00');
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  parts.push(`${months[d.getMonth()]}${d.getDate()}`);

  // Short random suffix for uniqueness
  const rand = Math.random().toString(36).slice(2, 6);
  parts.push(rand);

  return `${parts.join('-')}.${ext}`;
}

export async function addMoment(
  input: Omit<Moment, 'id'> & {
    tripId?: string;
    localUri?: string;
    isPublic?: boolean;
    mediaType?: 'image' | 'video';
  },
): Promise<string> {
  const tripId = await resolveTripId(input.tripId);
  const tags = Array.isArray(input.tags) ? input.tags.filter(Boolean) : [];

  let storagePath: string | undefined;
  let publicUrl: string | undefined;
  let hdUrl: string | undefined;
  const uploadedPaths: string[] = [];
  let uploadHdVersion: ((momentId: string) => void) | undefined;

  // If a local file URI is provided, compress and upload to Supabase Storage.
  if (input.localUri) {
    const rawExt = (input.localUri.split(/[?#]/)[0].split('.').pop() ?? '').toLowerCase();
    const safeExt = /^[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : '';
    const isVideo = input.mediaType === 'video' || ['mp4', 'mov', 'avi', 'webm', 'm4v'].includes(safeExt);
    const ext = isVideo ? (safeExt || 'mp4') : 'jpeg';
    const friendlyName = buildMomentFilename(input, ext);
    const contentType = guessMimeType(friendlyName);

    // Helper: compress → upload through the native file API on mobile
    const uploadFile = async (uri: string, path: string) => {
      await uploadLocalFileToStorage({
        bucket: 'moments',
        path,
        fileUri: uri,
        contentType,
        upsert: false,
        timeoutMs: 150_000,
        timeoutMessage: 'Photo upload timed out. Please check your connection and try again.',
      });
      const { data: urlData } = supabase.storage.from('moments').getPublicUrl(path);
      return urlData.publicUrl;
    };

    // Standard version (800px, 70% quality) — used for thumbnails + lightbox
    const standardFile = isVideo
      ? input.localUri
      : await withOperationTimeout(
          compressImageBestEffort(input.localUri, 1000, 0.68),
          'Preparing photo timed out. Please try a smaller photo.',
          60_000,
        );
    storagePath = `trips/${tripId}/${friendlyName}`;
    publicUrl = await withOperationTimeout(
      uploadFile(standardFile, storagePath),
      'Photo upload timed out. Please check your connection and try again.',
      150_000,
    );
    uploadedPaths.push(storagePath);

    // HD is optional. Save the moment first so weak mobile uploads do not block the UI.
    if (!isVideo) {
      uploadHdVersion = (momentId: string) => {
        const hdPath = `trips/${tripId}/hd/${friendlyName}`;
        void (async () => {
          try {
            const hdFile = await withOperationTimeout(
              compressImageBestEffort(input.localUri!, 1600, 0.78),
              'Preparing HD photo timed out.',
              45_000,
            );
            const nextHdUrl = await withOperationTimeout(
              uploadFile(hdFile, hdPath),
              'HD photo upload timed out.',
              90_000,
            );
            const { error: updateError } = await withOperationTimeout(
              supabase.from(T.moments).update({ hd_url: nextHdUrl }).eq('id', momentId),
              'Saving HD photo timed out.',
              45_000,
            );
            if (updateError) {
              await supabase.storage
                .from('moments')
                .remove([hdPath])
                .catch(() => {});
            }
          } catch {
            await supabase.storage
              .from('moments')
              .remove([hdPath])
              .catch(() => {});
          }
        })();
      };
    }
  } else if (input.photo) {
    // Photo is already a remote URL (e.g. from Notion migration).
    publicUrl = input.photo;
  }

  // Get current user for proper attribution
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const row: Record<string, unknown> = {
    trip_id: tripId,
    caption: input.caption || '',
    ...(storagePath ? { storage_path: storagePath } : {}),
    ...(publicUrl ? { public_url: publicUrl } : {}),
    ...(hdUrl ? { hd_url: hdUrl } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(isUuid(input.takenBy) ? { uploaded_by: input.takenBy } : {}),
    ...(authUser?.id ? { user_id: authUser.id } : {}),
    taken_at: input.date,
    ...(tags.length > 0 ? { tags } : {}),
    ...(input.visibility ? { visibility: input.visibility } : {}),
    ...(input.isPublic ? { is_public: true } : {}),
  };

  let insertedId: string | undefined;
  const { data, error } = await withOperationTimeout(
    supabase.from(T.moments).insert(row).select('id').single(),
    'Saving photo timed out. Please try again.',
    60_000,
  );
  insertedId = data?.id as string | undefined;
  if (error) {
    // Retry without hd_url in case column doesn't exist yet
    if (hdUrl && error.message.includes('hd_url')) {
      delete row.hd_url;
      const { data: retryData, error: retryError } = await supabase.from(T.moments).insert(row).select('id').single();
      insertedId = retryData?.id as string | undefined;
      if (retryError) {
        if (uploadedPaths.length > 0)
          await supabase.storage
            .from('moments')
            .remove(uploadedPaths)
            .catch(() => {});
        throw new Error(`addMoment insert: ${retryError.message}`);
      }
    } else {
      if (uploadedPaths.length > 0)
        await supabase.storage
          .from('moments')
          .remove(uploadedPaths)
          .catch(() => {});
      throw new Error(`addMoment insert: ${error.message}`);
    }
  }
  if (!insertedId) throw new Error('addMoment insert: no row returned');
  if (uploadHdVersion) uploadHdVersion(insertedId);
  return insertedId;
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'application/octet-stream';
  }
}

// ---------- MOMENT FAVORITES ----------

export interface MomentFavoriteMap {
  [momentId: string]: { count: number; userIds: string[] };
}

/** Fetch all favorites for moments in a trip, keyed by moment ID. */
export async function getMomentFavorites(tripId?: string): Promise<MomentFavoriteMap> {
  const id = await resolveTripId(tripId);
  // Get all moment IDs for this trip, then their favorites
  const { data: moments } = await supabase.from(T.moments).select('id').eq('trip_id', id);
  if (!moments || moments.length === 0) return {};

  const momentIds = moments.map((m) => m.id as string);
  const { data: favs } = await supabase
    .from('moment_favorites')
    .select('moment_id, user_id')
    .in('moment_id', momentIds);

  const result: MomentFavoriteMap = {};
  for (const f of favs ?? []) {
    const mid = f.moment_id as string;
    if (!result[mid]) result[mid] = { count: 0, userIds: [] };
    result[mid].count++;
    result[mid].userIds.push(f.user_id as string);
  }
  return result;
}

/** Toggle favorite on a moment. Returns true if now favorited, false if unfavorited. */
export async function toggleFavorite(momentId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('toggleFavorite: not authenticated');

  // Check if already favorited
  const { data: existing } = await supabase
    .from('moment_favorites')
    .select('id')
    .eq('moment_id', momentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('moment_favorites').delete().eq('id', existing.id);
    return false;
  }

  const { error } = await supabase.from('moment_favorites').insert({
    moment_id: momentId,
    user_id: user.id,
  });
  if (error) throw new Error(`toggleFavorite: ${error.message}`);
  return true;
}

/** Batch-favorite multiple moments. */
export async function batchFavorite(momentIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || momentIds.length === 0) return;

  // Get existing favorites to avoid duplicates
  const { data: existing } = await supabase
    .from('moment_favorites')
    .select('moment_id')
    .eq('user_id', user.id)
    .in('moment_id', momentIds);

  const alreadyFaved = new Set((existing ?? []).map((e) => e.moment_id as string));
  const toInsert = momentIds.filter((id) => !alreadyFaved.has(id)).map((id) => ({ moment_id: id, user_id: user.id }));

  if (toInsert.length > 0) {
    await supabase.from('moment_favorites').insert(toInsert);
  }
}

/** Toggle moment visibility between shared and private. Only works on own moments. */
export async function toggleMomentVisibility(momentId: string): Promise<'shared' | 'private'> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('toggleMomentVisibility: not authenticated');

  const { data: moment } = await supabase.from(T.moments).select('visibility, user_id').eq('id', momentId).single();

  if (!moment) throw new Error('toggleMomentVisibility: moment not found');
  // Allow toggle if: own moment OR legacy moment (no user_id — pre-migration)
  const momentUserId = moment.user_id as string | null;
  if (momentUserId && momentUserId !== user.id) {
    throw new Error('toggleMomentVisibility: can only toggle own moments');
  }

  const newVisibility = (moment.visibility as string) === 'shared' ? 'private' : 'shared';
  const { error } = await supabase.from(T.moments).update({ visibility: newVisibility }).eq('id', momentId);

  if (error) throw new Error(`toggleMomentVisibility: ${error.message}`);
  return newVisibility as 'shared' | 'private';
}

/** Set moment visibility to a specific value (private / shared / album). Owner only. */
export async function setMomentVisibility(momentId: string, visibility: 'shared' | 'private' | 'album'): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('setMomentVisibility: not authenticated');

  const { data: moment } = await supabase.from(T.moments).select('user_id').eq('id', momentId).single();

  if (!moment) throw new Error('setMomentVisibility: moment not found');
  const momentUserId = moment.user_id as string | null;
  if (momentUserId && momentUserId !== user.id) {
    throw new Error('setMomentVisibility: can only change own moments');
  }

  const { error } = await supabase.from(T.moments).update({ visibility }).eq('id', momentId);

  if (error) throw new Error(`setMomentVisibility: ${error.message}`);
}

/** Batch-set visibility on multiple moments. Owner only — silently skips others' moments. */
export async function batchSetMomentVisibility(
  momentIds: string[],
  visibility: 'shared' | 'private' | 'album',
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('batchSetMomentVisibility: not authenticated');

  // Only update moments owned by this user (or legacy unowned)
  const { error } = await supabase
    .from(T.moments)
    .update({ visibility })
    .in('id', momentIds)
    .or(`user_id.eq.${user.id},user_id.is.null`);

  if (error) throw new Error(`batchSetMomentVisibility: ${error.message}`);
}

/** Batch-delete multiple moments. Owner only — silently skips others' moments. */
export async function batchDeleteMoments(momentIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('batchDeleteMoments: not authenticated');

  const { error } = await supabase
    .from(T.moments)
    .delete()
    .in('id', momentIds)
    .or(`user_id.eq.${user.id},user_id.is.null`);

  if (error) throw new Error(`batchDeleteMoments: ${error.message}`);
}

/** Share a moment to the trip group — sets visibility to 'shared', notifies members, posts chat message. */
export async function shareMomentToGroup(momentId: string, tripId?: string): Promise<void> {
  const id = await resolveTripId(tripId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('shareMomentToGroup: not authenticated');

  // Set visibility to shared
  const { data: moment } = await supabase.from(T.moments).select('visibility, caption').eq('id', momentId).single();

  if (!moment) throw new Error('shareMomentToGroup: moment not found');

  if ((moment.visibility as string) !== 'shared') {
    await supabase.from(T.moments).update({ visibility: 'shared' }).eq('id', momentId);
  }

  // Get sharer's name
  const profile = await getProfile(user.id);
  const name = profile?.fullName?.split(' ')[0] ?? 'Someone';

  // Notify group members
  const caption = (moment.caption as string) ? ` "${moment.caption}"` : '';
  await notifyAllMembers(
    id,
    'photo_shared',
    `${name} shared a photo`,
    `${name} shared a photo${caption} with the group`,
    { momentId },
    user.id,
  );

  // Post chat message
  sendChatMessage({
    tripId: id,
    senderName: name,
    senderAvatar: profile?.avatarUrl ?? undefined,
    message: `📸 Shared a photo${caption} with the group`,
  }).catch(() => {});
}

/** Delete a moment (owner only). */
export async function deleteMoment(momentId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('deleteMoment: not authenticated');

  const { data: moment } = await supabase.from(T.moments).select('user_id, photo').eq('id', momentId).single();

  if (!moment) throw new Error('deleteMoment: moment not found');

  const momentUserId = moment.user_id as string | null;
  if (momentUserId && momentUserId !== user.id) {
    throw new Error('deleteMoment: can only delete own moments');
  }

  const { error } = await supabase.from(T.moments).delete().eq('id', momentId);
  if (error) throw new Error(`deleteMoment: ${error.message}`);
}

/** Get moments favorited by 2+ group members (group highlights). */
export async function getGroupHighlights(tripId?: string): Promise<Moment[]> {
  const id = await resolveTripId(tripId);
  const favorites = await getMomentFavorites(id);

  // Filter to moments with 2+ favorites
  const highlightIds = Object.entries(favorites)
    .filter(([, v]) => v.count >= 2)
    .map(([momentId]) => momentId);

  if (highlightIds.length === 0) return [];

  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .in('id', highlightIds)
    .eq('visibility', 'shared')
    .order('taken_at', { ascending: false });

  if (error) throw new Error(`getGroupHighlights: ${error.message}`);
  return (data ?? []).map(mapMoment);
}

/** Notify trip members that new moments were added. */
export async function notifyMomentsAdded(
  tripId: string,
  uploaderName: string,
  uploaderUserId: string,
  count: number,
  dayLabel?: string,
): Promise<void> {
  const title = `${uploaderName} added ${count} photo${count > 1 ? 's' : ''}`;
  const body = dayLabel ? `New moments from ${dayLabel}` : 'New moments added to the trip album';
  await notifyAllMembers(tripId, 'moments_added', title, body, { count }, uploaderUserId);
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
  const tripId = await resolveTripId(opts.tripId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('createAlbum: not authenticated');

  const { data, error } = await supabase
    .from('albums')
    .insert({
      trip_id: tripId,
      name: opts.name,
      owner_id: user.id,
      hide_from_mosaic: opts.hideFromMosaic ?? false,
      auto_reveal_at: opts.autoRevealAt ?? null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(`createAlbum: ${error?.message}`);

  // Add owner as member
  const memberRows = [
    { album_id: data.id, user_id: user.id, role: 'owner' as const },
    ...opts.members
      .filter((m) => m.userId !== user.id)
      .map((m) => ({ album_id: data.id, user_id: m.userId, role: m.role })),
  ];
  if (memberRows.length > 0) {
    await supabase.from('album_members').insert(memberRows);
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
  };
}

/** List all albums for a trip. */
export async function getAlbums(tripId?: string): Promise<Album[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .eq('trip_id', id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getAlbums: ${error.message}`);

  const albums: Album[] = [];
  for (const row of data ?? []) {
    // Get member + moment counts
    const { count: memberCount } = await supabase
      .from('album_members')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', row.id);

    const { count: momentCount } = await supabase
      .from('album_moments')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', row.id);

    // Get cover URL if set
    let coverUrl: string | undefined;
    if (row.cover_moment_id) {
      const { data: coverRow } = await supabase
        .from(T.moments)
        .select('public_url, storage_path')
        .eq('id', row.cover_moment_id)
        .single();
      if (coverRow) coverUrl = momentPhotoUrl(coverRow);
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
    });
  }
  return albums;
}

/** Get album detail with members. */
export async function getAlbumMembers(albumId: string): Promise<AlbumMember[]> {
  const { data, error } = await supabase.from('album_members').select('*').eq('album_id', albumId);

  if (error) throw new Error(`getAlbumMembers: ${error.message}`);

  const members: AlbumMember[] = [];
  for (const row of data ?? []) {
    // Resolve member name/avatar from group_members or profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', row.user_id)
      .single();

    const { count } = await supabase
      .from('album_moments')
      .select('*', { count: 'exact', head: true })
      .eq('album_id', albumId)
      .eq('added_by', row.user_id);

    members.push({
      id: row.id as string,
      userId: row.user_id as string,
      name: (profile?.full_name as string) ?? 'Unknown',
      avatar: (profile?.avatar_url as string) ?? undefined,
      role: row.role as string as AlbumMemberRole,
      momentCount: count ?? 0,
    });
  }
  return members;
}

/** Add moments to an album. */
export async function addMomentsToAlbum(albumId: string, momentIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || momentIds.length === 0) return;

  const rows = momentIds.map((mid) => ({
    album_id: albumId,
    moment_id: mid,
    added_by: user.id,
  }));
  const { error } = await supabase.from('album_moments').upsert(rows, { onConflict: 'album_id,moment_id' });
  if (error) throw new Error(`addMomentsToAlbum: ${error.message}`);
}

/** Get moments in an album. */
export async function getAlbumMoments(albumId: string): Promise<Moment[]> {
  const { data, error } = await supabase.from('album_moments').select('moment_id').eq('album_id', albumId);

  if (error || !data || data.length === 0) return [];

  const momentIds = data.map((r) => r.moment_id as string);
  const { data: moments, error: mError } = await supabase
    .from(T.moments)
    .select('*')
    .in('id', momentIds)
    .order('taken_at', { ascending: false });

  if (mError) throw new Error(`getAlbumMoments: ${mError.message}`);
  return (moments ?? []).map(mapMoment);
}

/** Get moments added since user's last view (for pending intake). */
export async function getPendingMoments(tripId?: string): Promise<{ moments: Moment[]; count: number }> {
  const id = await resolveTripId(tripId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { moments: [], count: 0 };

  // Get last viewed timestamp
  const { data: viewRow } = await supabase
    .from('moment_views')
    .select('last_viewed_at')
    .eq('user_id', user.id)
    .eq('trip_id', id)
    .single();

  const lastViewed = viewRow?.last_viewed_at as string | undefined;

  let query = supabase
    .from(T.moments)
    .select('*')
    .eq('trip_id', id)
    .eq('visibility', 'shared')
    .neq('user_id', user.id)
    .order('taken_at', { ascending: false });

  if (lastViewed) {
    query = query.gt('created_at', lastViewed);
  }

  const { data, error } = await query;
  if (error) return { moments: [], count: 0 };

  return {
    moments: (data ?? []).map(mapMoment),
    count: (data ?? []).length,
  };
}

/** Mark moments as viewed (updates last_viewed_at). */
export async function markMomentsViewed(tripId?: string): Promise<void> {
  const id = await resolveTripId(tripId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('moment_views').upsert(
    {
      user_id: user.id,
      trip_id: id,
      last_viewed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,trip_id' },
  );
}

/** Batch promote moments from private to shared (group). */
export async function promoteMomentsToGroup(momentIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || momentIds.length === 0) return;

  const { error } = await supabase
    .from(T.moments)
    .update({ visibility: 'shared' })
    .in('id', momentIds)
    .eq('user_id', user.id); // Can only promote own moments

  if (error) throw new Error(`promoteMomentsToGroup: ${error.message}`);
}

// ---------- TRIP FILES ----------

export async function getTripFiles(tripId?: string): Promise<TripFile[]> {
  const id = await resolveTripId(tripId);
  const { data, error } = await supabase.from(T.tripFiles).select('*').eq('trip_id', id);

  if (error) throw new Error(`getTripFiles: ${error.message}`);
  const files = (data ?? []).map(mapTripFile);
  return Promise.all(
    files.map(async (file) => {
      if (!file.storagePath) return file;
      try {
        const signedUrl = await getTripFilePreviewUrl(file.storagePath);
        return { ...file, fileUrl: signedUrl, previewError: undefined };
      } catch (signedError) {
        const message = signedError instanceof Error ? signedError.message : 'Preview link could not be created';
        if (__DEV__) console.warn('[trip-files] signed URL failed:', message);
        return { ...file, fileUrl: undefined, previewError: message };
      }
    }),
  );
}

export async function getTripFilePreviewUrl(storagePath: string, expiresInSeconds = 60 * 60): Promise<string> {
  const path = storagePath.trim();
  if (!path) throw new Error('File storage path is missing');
  const { data, error } = await supabase.storage.from('trip-files').createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Preview link could not be created');
  }
  return data.signedUrl;
}

export async function addTripFile(input: Omit<TripFile, 'id'> & { tripId?: string }): Promise<void> {
  const id = await resolveTripId(input.tripId);
  const fileUrl = input.fileUrl || input.storagePath;
  const { error } = await supabase.from(T.tripFiles).insert({
    trip_id: id,
    name: input.fileName,
    ...(fileUrl ? { file_url: fileUrl } : {}),
    ...(input.storagePath ? { storage_path: input.storagePath } : {}),
    ...(input.contentType ? { content_type: input.contentType } : {}),
    ...(input.sizeBytes ? { size_bytes: input.sizeBytes } : {}),
    ...(input.uploadedBy ? { uploaded_by: input.uploadedBy } : {}),
    file_type: input.type,
    ...(input.notes ? { description: input.notes } : {}),
    print_required: input.printRequired,
  });
  if (error) throw new Error(`addTripFile: ${error.message}`);
}

function safeStorageName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
  return cleaned || 'trip-file';
}

export async function uploadTripFile(input: {
  tripId?: string;
  fileName: string;
  type: TripFileType;
  localUri: string;
  contentType?: string;
  notes?: string;
  printRequired?: boolean;
}): Promise<void> {
  const tripId = await resolveTripId(input.tripId);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('uploadTripFile: not authenticated');
  if (!input.localUri) throw new Error('uploadTripFile: localUri is required');

  const fileName = safeStorageName(input.fileName);
  const contentType = input.contentType || guessMimeType(fileName);
  const storagePath = `trip-files/${tripId}/${user.id}/${Date.now()}-${fileName}`;
  await uploadLocalFileToStorage({
    bucket: 'trip-files',
    path: storagePath,
    fileUri: input.localUri,
    contentType,
    upsert: false,
    timeoutMs: 60_000,
    timeoutMessage: 'Document upload timed out. Please check your connection and try again.',
  });
  const fileInfo = await FileSystem.getInfoAsync(input.localUri).catch(() => null);

  try {
    await addTripFile({
      tripId,
      fileName: input.fileName,
      type: input.type,
      storagePath,
      contentType,
      sizeBytes: fileInfo?.exists && 'size' in fileInfo ? fileInfo.size : undefined,
      uploadedBy: user.id,
      notes: input.notes,
      printRequired: !!input.printRequired,
    });
  } catch (error) {
    await supabase.storage
      .from('trip-files')
      .remove([storagePath])
      .catch(() => {});
    throw error;
  }
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
] as const;

export async function deletePage(rowId: string, table?: string): Promise<void> {
  if (table) {
    const { error } = await supabase.from(table).delete().eq('id', rowId);
    if (error) throw new Error(`deletePage(${table}): ${error.message}`);
    return;
  }

  // Fallback: try each table. Supabase deletes return count 0 when no row
  // matches, so we look for an actual deletion.
  for (const t of ALL_TABLES) {
    const { error, count } = await supabase.from(t).delete({ count: 'exact' }).eq('id', rowId);
    if (!error && count && count > 0) return;
  }

  throw new Error(`deletePage: no row found with id ${rowId} in any table.`);
}

// ---------- WISHLIST ----------

function mapWishlistItem(row: Record<string, unknown>): WishlistItem {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    category: (row.category as string) ?? undefined,
    googlePlaceId: (row.google_place_id as string) ?? undefined,
    photoUrl: (row.photo_url as string) ?? undefined,
    rating: num(row.rating),
    totalRatings: num(row.total_ratings),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    address: (row.address as string) ?? undefined,
    destination: (row.destination as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    sourcePostId: (row.source_post_id as string) ?? undefined,
    sourceTripId: (row.source_trip_id as string) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export async function getWishlist(): Promise<WishlistItem[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('wishlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => mapWishlistItem(r as Record<string, unknown>));
}

export async function addToWishlist(item: Omit<WishlistItem, 'id' | 'createdAt'>): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const row = buildWishlistRow(userId, item);

  if (row.google_place_id) {
    const { data: existing, error: findError } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('google_place_id', row.google_place_id)
      .maybeSingle();

    if (findError) throw new Error(`addToWishlist lookup: ${findError.message}`);

    if (existing?.id) {
      const { error } = await supabase.from('wishlist').update(row).eq('id', existing.id);
      if (error) throw new Error(`addToWishlist: ${error.message}`);
      return;
    }
  }

  const { error } = await supabase.from('wishlist').insert(row);
  if (!error) return;

  if ((error as { code?: string }).code === '23505' && row.google_place_id) {
    const { error: updateError } = await supabase
      .from('wishlist')
      .update(row)
      .eq('user_id', userId)
      .eq('google_place_id', row.google_place_id);
    if (!updateError) return;
    throw new Error(`addToWishlist: ${updateError.message}`);
  }

  throw new Error(`addToWishlist: ${error.message}`);
}

export async function removeFromWishlist(id: string): Promise<void> {
  const { error } = await supabase.from('wishlist').delete().eq('id', id);
  if (error) throw new Error(`removeFromWishlist: ${error.message}`);
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
  coverPhotoUrl?: string;
  phone?: string;
  handle?: string;
  bio?: string;
  homeBase?: string;
  profileVisibility?: 'public' | 'companions' | 'private';
  publicStatsEnabled?: boolean;
  profileBadges?: string[];
  socials?: ProfileSocials;
  tier: UserTier;
  tripCount: number;
  completedTripCount: number;
  lastTripId?: string;
  onboardedAt?: string;
  onboardingState?: Record<string, unknown>;
  userSegment: UserSegment;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error || !data) return null;
  return {
    id: data.id,
    fullName: data.full_name ?? '',
    avatarUrl: data.avatar_url ?? undefined,
    coverPhotoUrl: data.cover_photo_url ?? undefined,
    phone: data.phone ?? undefined,
    handle: data.handle ?? undefined,
    bio: data.bio ?? undefined,
    homeBase: data.home_base ?? undefined,
    profileVisibility: data.profile_visibility ?? undefined,
    publicStatsEnabled: data.public_stats_enabled ?? undefined,
    profileBadges: data.profile_badges ?? undefined,
    socials: (data.socials as ProfileSocials) ?? undefined,
    tier: (data.tier as UserTier) ?? 'free',
    tripCount: (data.trip_count as number) ?? 0,
    completedTripCount: (data.completed_trip_count as number) ?? 0,
    lastTripId: (data.last_trip_id as string) ?? undefined,
    onboardedAt: (data.onboarded_at as string) ?? undefined,
    onboardingState: (data.onboarding_state as Record<string, unknown>) ?? undefined,
    userSegment: (data.user_segment as UserSegment) ?? 'new',
  };
}

export async function updateProfile(userId: string, updates: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const row: Record<string, unknown> = {};
  // Always include fields that are passed — even empty strings — so they persist
  if (updates.fullName !== undefined) row.full_name = updates.fullName;
  if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl || null;
  if (updates.coverPhotoUrl !== undefined) row.cover_photo_url = updates.coverPhotoUrl || null;
  if (updates.phone !== undefined) row.phone = updates.phone || null;
  if (updates.handle !== undefined) row.handle = updates.handle || null;
  if (updates.bio !== undefined) row.bio = updates.bio || null;
  if (updates.homeBase !== undefined) row.home_base = updates.homeBase || null;
  if (updates.profileVisibility !== undefined) row.profile_visibility = updates.profileVisibility;
  if (updates.publicStatsEnabled !== undefined) row.public_stats_enabled = updates.publicStatsEnabled;
  if (updates.profileBadges !== undefined) row.profile_badges = updates.profileBadges;
  if (updates.socials !== undefined) row.socials = updates.socials;
  if (updates.onboardedAt !== undefined) row.onboarded_at = updates.onboardedAt;
  if (updates.onboardingState !== undefined) row.onboarding_state = updates.onboardingState;
  if (Object.keys(row).length === 0) return;

  const { data: authData } = await supabase.auth.getUser();
  const isOwnProfile = authData?.user?.id === userId;

  const rpcSupportedKeys = new Set(['full_name', 'handle', 'avatar_url', 'cover_photo_url', 'phone', 'socials']);
  const canUseProfileRpc = Object.keys(row).every((key) => rpcSupportedKeys.has(key));

  if (isOwnProfile && canUseProfileRpc) {
    const { error: rpcError } = await supabase.rpc('upsert_own_profile', {
      p_full_name: updates.fullName ?? null,
      p_handle: updates.handle ?? null,
      p_avatar_url: updates.avatarUrl ?? null,
      p_phone: updates.phone ?? null,
      p_socials: updates.socials ?? null,
      p_cover_photo_url: updates.coverPhotoUrl ?? null,
    });
    if (!rpcError) return;
    const canFallbackFromRpc =
      rpcError.code === 'PGRST202' ||
      rpcError.message.includes('Could not find the function') ||
      rpcError.message.includes('schema cache') ||
      rpcError.message.includes('upsert_own_profile');
    if (!canFallbackFromRpc) {
      throw new Error(`updateProfile: ${rpcError.message}`);
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(row)
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (updateError) throw new Error(`updateProfile: ${updateError.message}`);
  if (updated) return;

  const { error: insertError } = await supabase.from('profiles').insert({ id: userId, ...row });
  if (insertError) throw new Error(`updateProfile: ${insertError.message}`);
}

export async function isHandleAvailable(handle: string, currentUserId: string): Promise<boolean> {
  const cleaned = handle.trim().toLowerCase();
  if (!cleaned) return false;

  const { data: rpcData, error: rpcError } = await supabase.rpc('is_handle_available', {
    p_handle: cleaned,
    p_current_user_id: currentUserId,
  });
  if (!rpcError && typeof rpcData === 'boolean') return rpcData;

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('handle', cleaned)
    .neq('id', currentUserId)
    .limit(1);
  return !data || data.length === 0;
}

export interface ProfileSearchResult {
  id: string;
  fullName: string;
  handle?: string;
  avatarUrl?: string;
}

export interface PublicProfileRow {
  id: string;
  fullName: string;
  handle?: string;
  avatarUrl?: string;
  companionPrivacy?: CompanionPrivacy;
}

export async function getPublicProfiles(userIds: string[]): Promise<PublicProfileRow[]> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_profiles', {
    p_user_ids: ids,
  });
  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      fullName: (r.full_name as string) ?? 'Traveler',
      handle: (r.handle as string) ?? undefined,
      avatarUrl: (r.avatar_url as string) ?? undefined,
      companionPrivacy: (r.companion_privacy as CompanionPrivacy) ?? undefined,
    }));
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, handle, avatar_url, companion_privacy')
    .in('id', ids);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: (r.full_name as string) ?? 'Traveler',
    handle: (r.handle as string) ?? undefined,
    avatarUrl: (r.avatar_url as string) ?? undefined,
    companionPrivacy: (r.companion_privacy as CompanionPrivacy) ?? undefined,
  }));
}

/** Search profiles by handle or name. Returns up to 20 results. */
export async function searchProfiles(query: string): Promise<ProfileSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  const q = query
    .trim()
    .replace(/^@/, '')
    .replace(/[\u0000-\u001F\u007F,]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim();
  if (q.length < 2) return [];

  const { data: rpcData, error: rpcError } = await supabase.rpc('search_public_profiles', {
    p_query: q,
    p_limit: 20,
  });
  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      fullName: (r.full_name as string) ?? 'Traveler',
      handle: (r.handle as string) ?? undefined,
      avatarUrl: (r.avatar_url as string) ?? undefined,
    }));
  }

  const rpcMissingOrBlocked = !!rpcError && (
    rpcError.code === 'PGRST202' ||
    rpcError.message?.includes('Could not find the function') ||
    rpcError.message?.includes('schema cache') ||
    rpcError.message?.includes('search_public_profiles') ||
    rpcError.message?.includes('permission denied')
  );
  if (rpcError && __DEV__) {
    console.warn('[searchProfiles] RPC failed:', rpcError.message);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, handle, avatar_url')
    .or(`handle.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(20);
  if (error) {
    if (__DEV__) console.warn('[searchProfiles] fallback failed:', error.message);
    throw new Error(
      rpcMissingOrBlocked
        ? 'Traveler search needs the latest profile backend update.'
        : `Profile search failed: ${error.message}`,
    );
  }
  if (rpcMissingOrBlocked && (!data || data.length === 0)) {
    throw new Error('Traveler search needs the latest profile backend update.');
  }
  if (!data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    handle: r.handle as string | undefined,
    avatarUrl: r.avatar_url as string | undefined,
  }));
}

export async function getPublicProfilePosts(userId: string, limit = 20, offset = 0): Promise<FeedPost[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_profile_posts', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });

  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((row: Record<string, unknown>) => {
      const mediaRows = Array.isArray(row.media) ? (row.media as Record<string, unknown>[]) : [];
      return {
        ...mapFeedPost(row),
        media: mediaRows.map((media) => ({
          id: media.id as string,
          mediaUrl:
            resolvePhotoUrl((media.mediaUrl as string | undefined) ?? (media.storagePath as string | undefined)) ?? '',
          storagePath: (media.storagePath as string) ?? '',
          mediaType: (media.mediaType as string) ?? 'image',
          orderIndex: (media.orderIndex as number) ?? 0,
        })),
      };
    });
  }

  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return [];
  const postIds = data.map((row) => row.id as string).filter(Boolean);
  let mediaByPost: Record<string, FeedPost['media']> = {};
  if (postIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('post_media')
      .select('id, post_id, media_url, storage_path, media_type, order_index')
      .in('post_id', postIds)
      .order('order_index', { ascending: true });
    mediaByPost = (mediaRows ?? []).reduce<Record<string, FeedPost['media']>>((acc, row) => {
      const postId = row.post_id as string;
      acc[postId] = [
        ...(acc[postId] ?? []),
        {
          id: row.id as string,
          mediaUrl:
            resolvePhotoUrl((row.media_url as string | undefined) ?? (row.storage_path as string | undefined)) ?? '',
          storagePath: row.storage_path as string,
          mediaType: (row.media_type as string) ?? 'image',
          orderIndex: row.order_index as number,
        },
      ];
      return acc;
    }, {});
  }
  return data.map((row: Record<string, unknown>) => ({
    ...mapFeedPost(row),
    media: mediaByPost[row.id as string] ?? [],
  }));
}

async function uploadProfileImage(userId: string, localUri: string, kind: 'avatar' | 'cover'): Promise<string> {
  const prepared = kind === 'cover' ? localUri : await compressImage(localUri, 500, 0.58);
  const timestamp = Date.now();
  const filename = `${kind}.jpg`;
  const storagePath = `profiles/${userId}/${kind}-${timestamp}-${filename}`;

  const bytes = await readFileAsBytes(prepared);
  const contentType = 'image/jpeg';
  const column = kind === 'cover' ? 'cover_photo_url' : 'avatar_url';

  const buckets = ['avatars', 'moments'] as const;
  for (const bucket of buckets) {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, bytes, { contentType, upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      const { error: updateError } = await supabase.from('profiles').update({ [column]: publicUrl }).eq('id', userId);
      if (updateError) throw new Error(`uploadProfileImage: ${updateError.message}`);
      return publicUrl;
    }
    if (bucket === buckets[buckets.length - 1]) {
      throw new Error(`uploadProfileImage: ${uploadError.message}`);
    }
  }
  throw new Error('uploadProfileImage: no bucket available');
}

export async function uploadProfilePhoto(userId: string, localUri: string): Promise<string> {
  return uploadProfileImage(userId, localUri, 'avatar');
}

export async function uploadProfileCoverPhoto(userId: string, localUri: string): Promise<string> {
  return uploadProfileImage(userId, localUri, 'cover');
}

export async function ensureProfile(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, full_name: name }, { onConflict: 'id', ignoreDuplicates: true });
  if (error && !error.message.includes('duplicate')) {
    throw new Error(`ensureProfile: ${error.message}`);
  }
}

// ---------- LIFETIME STATS & HIGHLIGHTS ----------

export async function getLifetimeStats(userId?: string): Promise<LifetimeStats | null> {
  let uid = userId;
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser();
    uid = authData?.user?.id;
  }
  if (!uid) return null;

  const { data, error } = await supabase.from('lifetime_stats').select('*').eq('user_id', uid).maybeSingle();
  if (error) {
    if (__DEV__) console.warn('[getLifetimeStats] fetch failed:', error.message);
    return null;
  }
  if (!data) return null;
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
  };
}

export async function getHighlights(userId: string): Promise<Highlight[]> {
  const { data } = await supabase.from('highlights').select('*').eq('user_id', userId).order('rank');
  if (!data) return [];
  return data.map(
    (h): Highlight => ({
      id: h.id as string,
      type: h.type as HighlightType,
      displayText: h.display_text as string,
      supportingData: (h.supporting_data as Record<string, unknown>) ?? undefined,
      rank: h.rank as number,
    }),
  );
}

export async function getPastTrips(userId: string): Promise<Trip[]> {
  let uid = userId;
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser();
    uid = authData?.user?.id ?? '';
  }
  if (!uid) return [];

  // Owned trips
  const { data: owned } = await supabase
    .from(T.trips)
    .select('*')
    .eq('user_id', uid)
    .or('is_past_import.eq.true,status.eq.Completed')
    .order('start_date', { ascending: false });

  // Member trips (covers legacy NULL user_id)
  const { data: memberTrips } = await supabase
    .from(T.trips)
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', uid)
    .or('is_past_import.eq.true,status.eq.Completed')
    .order('start_date', { ascending: false });

  const allRows = [...(owned ?? []), ...(memberTrips ?? [])];
  const seen = new Set<string>();
  const data = allRows.filter((r) => {
    const id = r.id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!data.length) return [];
  return data.map((r) => mapTrip(r as Record<string, unknown>));
}

export async function getAllUserTrips(userId?: string, includeDeleted = false): Promise<Trip[]> {
  let uid = userId;
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser();
    uid = authData?.user?.id;
  }
  if (!uid) {
    if (__DEV__) console.warn('[getAllUserTrips] No user ID available');
    return [];
  }

  // Fetch trips owned by user OR where user is a trip member (covers legacy NULL user_id trips)
  const ownedQuery = supabase.from(T.trips).select('*').eq('user_id', uid).order('start_date', { ascending: false });

  const memberQuery = supabase
    .from(T.trips)
    .select('*, group_members!inner(user_id)')
    .eq('group_members.user_id', uid)
    .order('start_date', { ascending: false });

  const { data: ownedTrips, error: ownedError } = await ownedQuery;
  const { data: memberTrips, error: memberError } = await memberQuery;

  if (ownedError) {
    if (__DEV__) console.error('[getAllUserTrips] ownedQuery error:', ownedError);
    throw new Error(`Owned trips fetch failed: ${ownedError.message}`);
  }
  if (memberError) {
    if (__DEV__) console.error('[getAllUserTrips] memberQuery error:', memberError);
    throw new Error(`Member trips fetch failed: ${memberError.message}`);
  }

  // Merge and deduplicate by id
  const allRows = [...(ownedTrips ?? []), ...(memberTrips ?? [])];
  const seen = new Set<string>();
  const unique = allRows.filter((r) => {
    const id = r.id as string;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Filter soft-deleted in JS (deleted_at column may not exist in DB)
  const result = includeDeleted ? unique : unique.filter((r) => !r.deleted_at);

  return result.map((r) => mapTrip(r as Record<string, unknown>));
}

/** Active trips: Planning or Active, not draft, not deleted, not archived */
export async function getActiveTrips(userId?: string): Promise<Trip[]> {
  const all = await getAllUserTrips(userId);
  return all.filter(
    (t) => (t.status === 'Planning' || t.status === 'Active') && !t.isDraft && !t.deletedAt && !t.archivedAt,
  );
}

/** Draft trips: incomplete onboarding drafts */
export async function getDraftTrips(userId?: string): Promise<Trip[]> {
  const all = await getAllUserTrips(userId);
  return all.filter((t) => t.isDraft === true && !t.deletedAt);
}

/** Archived trips */
export async function getArchivedTrips(userId?: string): Promise<Trip[]> {
  const all = await getAllUserTrips(userId, true);
  return all.filter((t) => t.archivedAt != null || t.deletedAt != null);
}

// ---------- TRIP LIFECYCLE ----------

/** Mark a trip as Completed (finish early or natural end). */
export async function finishTrip(tripId: string): Promise<void> {
  // Snapshot expense total and nights onto the trip row before completing
  try {
    const { total } = await getExpenseSummary(tripId);
    const trip = await getTripById(tripId);
    const nights = trip?.nights ?? 0;
    await supabase
      .from(T.trips)
      .update({ status: 'Completed', total_spent: total, total_nights: nights })
      .eq('id', tripId);
  } catch {
    // Fallback: just mark completed without stats
    const { error } = await supabase.from(T.trips).update({ status: 'Completed' }).eq('id', tripId);
    if (error) throw new Error(`finishTrip: ${error.message}`);
  }
  clearTripCache();
  invalidateTripCache(tripId);
  await clearTripLocalData();
}

/** Archive/cancel a trip without generating a memory. */
export async function archiveTrip(tripId: string): Promise<void> {
  // Snapshot stats before archiving (same as finishTrip)
  try {
    const { total } = await getExpenseSummary(tripId);
    const trip = await getTripById(tripId);
    const nights = trip?.nights ?? 0;
    await supabase
      .from(T.trips)
      .update({ status: 'Completed', total_spent: total, total_nights: nights, archived_at: new Date().toISOString() })
      .eq('id', tripId);
  } catch {
    const { error } = await supabase
      .from(T.trips)
      .update({ status: 'Completed', archived_at: new Date().toISOString() })
      .eq('id', tripId);
    if (error) throw new Error(`archiveTrip: ${error.message}`);
  }
  clearTripCache();
  invalidateTripCache(tripId);
  await clearTripLocalData();
}

/** Soft-delete a trip (30-day retention window). */
export async function softDeleteTrip(tripId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from(T.trips).update({ deleted_at: nowIso, archived_at: nowIso }).eq('id', tripId);
  if (error) throw new Error(`softDeleteTrip: ${error.message}`);
  clearTripCache();
  invalidateTripCache(tripId);
  await clearTripLocalData();
}

/** Restore a soft-deleted or archived trip. */
export async function restoreTrip(tripId: string): Promise<void> {
  const { error } = await supabase.from(T.trips).update({ deleted_at: null, archived_at: null }).eq('id', tripId);
  if (error) throw new Error(`restoreTrip: ${error.message}`);
  clearTripCache();
  invalidateTripCache(tripId);
  await clearTripLocalData();
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
    tripSnapshot: (row.trip_snapshot as TripMemorySnapshot) ?? {
      destination: '',
      startDate: '',
      endDate: '',
      nights: 0,
      accommodation: '',
      memberNames: [],
      memberCount: 0,
    },
    expenseSummary: (row.expense_summary as TripMemoryExpenses) ?? {
      total: 0,
      currency: 'PHP',
      topCategories: [],
      dailyAverage: 0,
    },
    placesSummary: (row.places_summary as TripMemoryPlace[]) ?? [],
    flightSummary: (row.flight_summary as TripMemoryFlight[]) ?? [],
    heroMomentId: (row.hero_moment_id as string) ?? undefined,
    featuredMomentIds: (row.featured_moment_ids as string[]) ?? [],
    status: (row.status as TripMemoryStatus) ?? 'draft',
    createdAt: row.created_at as string,
    savedAt: (row.saved_at as string) ?? undefined,
  };
}

/** Get the trip memory for a specific trip (current user). */
export async function getTripMemory(tripId: string): Promise<TripMemory | null> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return mapTripMemory(data);
}

/** Get all saved trip memories for a user (for past trips list). */
export async function getAllTripMemories(userId: string): Promise<TripMemory[]> {
  const { data } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'saved')
    .order('created_at', { ascending: false });
  if (!data) return [];
  return data.map(mapTripMemory);
}

/** Upsert a draft trip memory (overwrites existing draft). */
export async function saveTripMemoryDraft(memory: Omit<TripMemory, 'id' | 'createdAt' | 'savedAt'>): Promise<string> {
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
  };

  const { data, error } = await supabase
    .from('trip_memories')
    .upsert(row, { onConflict: 'trip_id,user_id' })
    .select('id')
    .single();
  if (error) throw new Error(`saveTripMemoryDraft: ${error.message}`);
  return data.id as string;
}

/** Finalize a draft memory — marks it as saved (immutable). */
export async function finalizeTripMemory(memoryId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_memories')
    .update({ status: 'saved', saved_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('status', 'draft');
  if (error) throw new Error(`finalizeTripMemory: ${error.message}`);
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
  const userId = input.userId?.trim();
  const localUri = input.localUri?.trim();
  if (!userId) throw new Error('addPersonalPhoto: userId is required');
  if (!localUri) throw new Error('addPersonalPhoto: localUri is required');

  const compressed = await withOperationTimeout(
    compressImageBestEffort(localUri, 1000, 0.68),
    'Preparing photo timed out. Please try a smaller photo.',
    60_000,
  );
  const timestamp = Date.now();
  const ext = 'jpg';
  const nonce = Math.random().toString(36).slice(2, 10);
  const storagePath = `personal/${userId}/${timestamp}-${nonce}.${ext}`;

  await uploadLocalFileToStorage({
    bucket: 'moments',
    path: storagePath,
    fileUri: compressed,
    contentType: 'image/jpeg',
    upsert: false,
    timeoutMs: 150_000,
    timeoutMessage: 'Photo upload timed out. Please check your connection and try again.',
  });

  const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) throw new Error('addPersonalPhoto: public URL could not be generated');

  const row = {
    user_id: userId,
    photo_url: publicUrl,
    storage_path: storagePath,
    location: input.location,
    latitude: input.latitude,
    longitude: input.longitude,
    caption: input.caption,
    taken_at: input.takenAt ?? new Date().toISOString().slice(0, 10),
    tags: input.tags ?? [],
  };

  let { data, error } = await withOperationTimeout(
    supabase.from('personal_photos').insert(row).select('id').single(),
    'Saving photo timed out. Please try again.',
    60_000,
  );
  if (error && isMissingColumnError(error, 'photo_url')) {
    const { photo_url: _photoUrl, ...fallbackRow } = row;
    const retry = await withOperationTimeout(
      supabase
        .from('personal_photos')
        .insert({ ...fallbackRow, public_url: publicUrl })
        .select('id')
        .single(),
      'Saving photo timed out. Please try again.',
      60_000,
    );
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    await supabase.storage
      .from('moments')
      .remove([storagePath])
      .catch(() => {});
    throw new Error(`addPersonalPhoto insert: ${error.message}`);
  }
  if (!data?.id) throw new Error('addPersonalPhoto insert: no row returned');
  return data.id as string;
}

export async function getPersonalPhotos(userId: string): Promise<import('./types').PersonalPhoto[]> {
  const { data, error } = await supabase
    .from('personal_photos')
    .select('*')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false });
  if (error) throw new Error(`getPersonalPhotos: ${error.message}`);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    photoUrl: (row.photo_url as string | undefined) ?? (row.public_url as string | undefined),
    storagePath: row.storage_path as string | undefined,
    location: row.location as string | undefined,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    caption: row.caption as string | undefined,
    takenAt: (row.taken_at as string) ?? new Date().toISOString().slice(0, 10),
    tags: (row.tags as string[]) ?? [],
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// DAILY EXPENSE TRACKER
// ═══════════════════════════════════════════════════════════════════════

import type {
  DailyExpense,
  DailyExpenseCategory,
  DailyExpenseSummary,
  DailyExpensePeriodSummary,
  SavingsGoal,
  SavingsEntry,
  SavingsMilestone,
} from '@/lib/types';

export async function getDailyTrackerEnabled(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase.from('profiles').select('daily_tracker_enabled').eq('id', auth.user.id).single();
  return data?.daily_tracker_enabled === true;
}

export async function setDailyTrackerEnabled(enabled: boolean): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from('profiles').update({ daily_tracker_enabled: enabled }).eq('id', auth.user.id);
}

export async function addDailyExpense(input: {
  description: string;
  amount: number;
  currency?: string;
  dailyCategory: DailyExpenseCategory;
  date?: string;
  notes?: string;
  photo?: string;
  placeName?: string;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const receiptUpload = await uploadExpenseReceiptPhoto(input.photo);
  const { error } = await supabase.from('expenses').insert({
    user_id: auth.user.id,
    trip_id: null,
    title: input.description,
    amount: input.amount,
    currency: input.currency ?? 'PHP',
    category:
      input.dailyCategory === 'Bills' || input.dailyCategory === 'Entertainment' || input.dailyCategory === 'Groceries'
        ? 'Other'
        : input.dailyCategory,
    daily_category: input.dailyCategory,
    expense_date: input.date ?? new Date().toISOString().slice(0, 10),
    notes: input.notes,
    photo_url: receiptUpload.publicUrl,
    place_name: input.placeName,
  });
  if (error && receiptUpload.storagePath) {
    await supabase.storage.from('moments').remove([receiptUpload.storagePath]).catch(() => {});
  }
  if (error) throw new Error(`addDailyExpense: ${error.message}`);
}

export async function getDailyExpenses(from: string, to: string): Promise<DailyExpense[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', auth.user.id)
    .is('trip_id', null)
    .not('daily_category', 'is', null)
    .gte('expense_date', from)
    .lte('expense_date', to)
    .order('expense_date', { ascending: false });
  if (error) throw new Error(`getDailyExpenses: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    description: (r.title as string) ?? '',
    amount: Number(r.amount ?? 0),
    currency: (r.currency as string) ?? 'PHP',
    category: (r.category as string) ?? 'Other',
    date: (r.expense_date as string) ?? '',
    notes: r.notes as string | undefined,
    photo: r.photo_url as string | undefined,
    placeName: r.place_name as string | undefined,
    dailyCategory: (r.daily_category as DailyExpenseCategory) ?? 'Other',
  })) as DailyExpense[];
}

export async function getDailyExpenseSummary(date: string): Promise<DailyExpenseSummary> {
  const exps = await getDailyExpenses(date, date);
  const byCategory: Partial<Record<DailyExpenseCategory, number>> = {};
  let total = 0;
  for (const e of exps) {
    total += e.amount;
    byCategory[e.dailyCategory] = (byCategory[e.dailyCategory] ?? 0) + e.amount;
  }
  return { date, total, byCategory, count: exps.length };
}

export async function getDailyExpensePeriodSummary(
  period: 'daily' | 'weekly' | 'monthly',
): Promise<DailyExpensePeriodSummary> {
  const now = new Date();
  let startDate: string;
  let endDate: string = now.toISOString().slice(0, 10);
  let days: number;

  if (period === 'daily') {
    startDate = endDate;
    days = 1;
  } else if (period === 'weekly') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    startDate = d.toISOString().slice(0, 10);
    days = 7;
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    startDate = d.toISOString().slice(0, 10);
    days = 30;
  }

  const exps = await getDailyExpenses(startDate, endDate);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of exps) {
    total += e.amount;
    byCategory[e.dailyCategory] = (byCategory[e.dailyCategory] ?? 0) + e.amount;
  }
  return {
    period,
    startDate,
    endDate,
    total,
    average: days > 0 ? total / days : 0,
    byCategory,
    count: exps.length,
  };
}

// ── Daily Tracker Settings & CRUD ────────────────────────────────────

import type { DailyTrackerSettings } from './types';

export async function getDailyTrackerSettings(): Promise<DailyTrackerSettings> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user?.id) return {};
  const { data } = await supabase.from('profiles').select('daily_tracker_settings').eq('id', authData.user.id).single();
  return (data?.daily_tracker_settings as DailyTrackerSettings) ?? {};
}

export async function setDailyTrackerSettings(settings: DailyTrackerSettings): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user?.id) return;
  await supabase.from('profiles').update({ daily_tracker_settings: settings }).eq('id', authData.user.id);
}

export async function deleteDailyExpense(expenseId: string): Promise<void> {
  const { error } = await supabase.from(T.expenses).delete().eq('id', expenseId);
  if (error) throw new Error(`deleteDailyExpense: ${error.message}`);
}

export async function updateDailyExpense(
  expenseId: string,
  input: { description?: string; amount?: number; dailyCategory?: DailyExpenseCategory },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.description != null) updates.title = input.description;
  if (input.amount != null) updates.amount = input.amount;
  if (input.dailyCategory != null) updates.daily_category = input.dailyCategory;
  const { error } = await supabase.from(T.expenses).update(updates).eq('id', expenseId);
  if (error) throw new Error(`updateDailyExpense: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════════
// SAVINGS GOALS
// ═══════════════════════════════════════════════════════════════════════

function mapSavingsGoal(row: Record<string, unknown>): SavingsGoal {
  return {
    id: row.id as string,
    title: (row.title as string) ?? 'Next Trip Fund',
    targetAmount: Number(row.target_amount ?? 0),
    targetCurrency: (row.target_currency as string) ?? 'PHP',
    targetDate: row.target_date as string | undefined,
    destination: row.destination as string | undefined,
    linkedTripId: row.linked_trip_id as string | undefined,
    currentAmount: Number(row.current_amount ?? 0),
    isActive: row.is_active as boolean,
    celebratedMilestones: (row.celebrated_milestones as number[]) ?? [],
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  };
}

function mapSavingsEntry(row: Record<string, unknown>): SavingsEntry {
  return {
    id: row.id as string,
    goalId: row.goal_id as string,
    amount: Number(row.amount ?? 0),
    currency: (row.currency as string) ?? 'PHP',
    note: row.note as string | undefined,
    entryDate: (row.entry_date as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  };
}

export async function getActiveSavingsGoal(): Promise<SavingsGoal | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveSavingsGoal: ${error.message}`);
  return data ? mapSavingsGoal(data) : null;
}

export async function createSavingsGoal(input: {
  title: string;
  targetAmount: number;
  targetCurrency?: string;
  targetDate?: string;
  destination?: string;
  linkedTripId?: string;
}): Promise<SavingsGoal> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  // Deactivate any existing active goal
  await supabase.from('savings_goals').update({ is_active: false }).eq('user_id', auth.user.id).eq('is_active', true);
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: auth.user.id,
      title: input.title,
      target_amount: input.targetAmount,
      target_currency: input.targetCurrency ?? 'PHP',
      target_date: input.targetDate ?? null,
      destination: input.destination ?? null,
      linked_trip_id: input.linkedTripId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`createSavingsGoal: ${error.message}`);
  return mapSavingsGoal(data);
}

export async function updateSavingsGoal(
  goalId: string,
  input: Partial<Pick<SavingsGoal, 'title' | 'targetAmount' | 'targetDate' | 'destination' | 'linkedTripId'>>,
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) update.title = input.title;
  if (input.targetAmount !== undefined) update.target_amount = input.targetAmount;
  if (input.targetDate !== undefined) update.target_date = input.targetDate;
  if (input.destination !== undefined) update.destination = input.destination;
  if (input.linkedTripId !== undefined) update.linked_trip_id = input.linkedTripId;
  const { error } = await supabase.from('savings_goals').update(update).eq('id', goalId);
  if (error) throw new Error(`updateSavingsGoal: ${error.message}`);
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId);
  if (error) throw new Error(`deleteSavingsGoal: ${error.message}`);
}

export async function addSavingsEntry(
  goalId: string,
  amount: number,
  note?: string,
): Promise<{ entry: SavingsEntry; newMilestones: SavingsMilestone[] }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Insert entry
  const { data: entryData, error: entryErr } = await supabase
    .from('savings_entries')
    .insert({
      goal_id: goalId,
      user_id: auth.user.id,
      amount,
      note: note ?? null,
    })
    .select()
    .single();
  if (entryErr) throw new Error(`addSavingsEntry: ${entryErr.message}`);

  // Update goal current_amount
  const { data: goalData, error: goalErr } = await supabase
    .from('savings_goals')
    .select('current_amount, target_amount, celebrated_milestones')
    .eq('id', goalId)
    .single();
  if (goalErr) throw new Error(`addSavingsEntry goal fetch: ${goalErr.message}`);

  const newAmount = Number(goalData.current_amount ?? 0) + amount;
  const target = Number(goalData.target_amount ?? 1);
  const celebrated = (goalData.celebrated_milestones as number[]) ?? [];
  const pct = (newAmount / target) * 100;

  // Check milestones
  const MILESTONES: SavingsMilestone[] = [25, 50, 75, 100];
  const newMilestones = MILESTONES.filter((m) => pct >= m && !celebrated.includes(m));

  const updatePayload: Record<string, unknown> = {
    current_amount: newAmount,
    updated_at: new Date().toISOString(),
  };
  if (newMilestones.length > 0) {
    updatePayload.celebrated_milestones = [...celebrated, ...newMilestones];
  }

  await supabase.from('savings_goals').update(updatePayload).eq('id', goalId);

  return { entry: mapSavingsEntry(entryData), newMilestones };
}

export async function getSavingsEntries(goalId: string, limit = 20): Promise<SavingsEntry[]> {
  const { data, error } = await supabase
    .from('savings_entries')
    .select('*')
    .eq('goal_id', goalId)
    .order('entry_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getSavingsEntries: ${error.message}`);
  return (data ?? []).map(mapSavingsEntry);
}

export async function markMilestoneCelebrated(goalId: string, milestone: number): Promise<void> {
  const { data } = await supabase.from('savings_goals').select('celebrated_milestones').eq('id', goalId).single();
  const current = (data?.celebrated_milestones as number[]) ?? [];
  if (current.includes(milestone)) return;
  await supabase
    .from('savings_goals')
    .update({ celebrated_milestones: [...current, milestone] })
    .eq('id', goalId);
}

// ---------- MOMENT COMMENTS ----------

/** Get comments for a moment, with user profile info. */
export async function getComments(momentId: string): Promise<MomentComment[]> {
  const { data, error } = await supabase
    .from('moment_comments')
    .select('id, moment_id, user_id, text, created_at')
    .eq('moment_id', momentId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getComments: ${error.message}`);
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((c) => c.user_id as string))];
  const profiles = await getPublicProfiles(userIds);
  const profileMap = new Map(profiles.map((p) => [p.id, { name: p.fullName, avatar: p.avatarUrl }]));

  return data.map((c) => ({
    id: c.id as string,
    momentId: c.moment_id as string,
    userId: c.user_id as string,
    userName: profileMap.get(c.user_id as string)?.name ?? 'Unknown',
    userAvatar: profileMap.get(c.user_id as string)?.avatar,
    text: c.text as string,
    createdAt: c.created_at as string,
  }));
}

/** Get comment counts for multiple moments (batch). */
export async function getCommentCounts(momentIds: string[]): Promise<Record<string, number>> {
  if (momentIds.length === 0) return {};
  const { data } = await supabase.from('moment_comments').select('moment_id').in('moment_id', momentIds);

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const mid = row.moment_id as string;
    counts[mid] = (counts[mid] ?? 0) + 1;
  }
  return counts;
}

/** Add a comment to a moment. Returns the new comment. */
export async function addComment(momentId: string, text: string): Promise<MomentComment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('addComment: not authenticated');

  const { data, error } = await supabase
    .from('moment_comments')
    .insert({ moment_id: momentId, user_id: user.id, text: text.trim() })
    .select('id, moment_id, user_id, text, created_at')
    .single();

  if (error || !data) throw new Error(`addComment: ${error?.message ?? 'insert failed'}`);

  // Fetch own profile for display
  const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();

  const comment: MomentComment = {
    id: data.id as string,
    momentId: data.moment_id as string,
    userId: user.id,
    userName: (profile?.full_name as string) ?? 'You',
    userAvatar: (profile?.avatar_url as string) ?? undefined,
    text: data.text as string,
    createdAt: data.created_at as string,
  };

  // Notify photo owner + other commenters (best-effort)
  notifyComment(momentId, comment.userName, user.id, text).catch(() => {});

  return comment;
}

/** Delete a comment. */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('moment_comments').delete().eq('id', commentId);
  if (error) throw new Error(`deleteComment: ${error.message}`);
}

/** Notify photo owner + other commenters about a new comment. */
async function notifyComment(
  momentId: string,
  commenterName: string,
  commenterId: string,
  commentText: string,
): Promise<void> {
  // Get the moment to find trip_id and owner
  const { data: moment } = await supabase
    .from(T.moments)
    .select('trip_id, user_id, caption')
    .eq('id', momentId)
    .single();
  if (!moment) return;

  const tripId = moment.trip_id as string;
  const photoOwnerId = moment.user_id as string | null;

  // Get all unique commenters on this photo
  const { data: commenters } = await supabase.from('moment_comments').select('user_id').eq('moment_id', momentId);
  const commenterIds = new Set((commenters ?? []).map((c) => c.user_id as string));

  // Also notify photo owner
  if (photoOwnerId) commenterIds.add(photoOwnerId);

  // Remove the person who just commented
  commenterIds.delete(commenterId);

  const truncated = commentText.length > 60 ? commentText.slice(0, 57) + '...' : commentText;
  const photoLabel = (moment.caption as string) || 'a photo';

  for (const userId of commenterIds) {
    await insertNotification({
      userId,
      tripId,
      type: 'moment_comment',
      title: `${commenterName} commented`,
      body: `"${truncated}" on ${photoLabel}`,
      data: { momentId, commenterId },
    });
  }

  // Notify @mentioned users (separate from comment thread notifications)
  const mentionMatches = commentText.match(/@([^\s@]+(?:\s[^\s@]+)?)/g);
  if (mentionMatches && tripId) {
    const members = await getGroupMembers(tripId);
    const alreadyNotified = new Set(commenterIds);
    for (const mention of mentionMatches) {
      const name = mention.slice(1); // remove @
      const member = members.find((m) => m.name === name);
      if (member?.userId && member.userId !== commenterId && !alreadyNotified.has(member.userId)) {
        alreadyNotified.add(member.userId);
        await insertNotification({
          userId: member.userId,
          tripId,
          type: 'user_mentioned',
          title: `${commenterName} mentioned you`,
          body: `"${truncated}" on ${photoLabel}`,
          data: { momentId, commenterId },
        });
      }
    }
  }
}

// ---------- COMPANION SYSTEM ----------

const DEFAULT_PRIVACY: CompanionPrivacy = {
  showStats: true,
  showSharedMoments: true,
  showPastTrips: true,
  showUpcomingTrips: false,
  showSocials: true,
};

type PublicProfileRpcRow = {
  id?: string;
  fullName?: string;
  handle?: string | null;
  avatarUrl?: string | null;
  coverPhotoUrl?: string | null;
  bio?: string | null;
  homeBase?: string | null;
  profileVisibility?: CompanionProfile['profileVisibility'];
  publicStatsEnabled?: boolean;
  profileBadges?: string[] | null;
  followersCount?: number;
  followingCount?: number;
  viewerIsFollowing?: boolean;
};

function mapPublicProfileRpcToProfileRow(row: PublicProfileRpcRow): Record<string, unknown> {
  return {
    id: row.id,
    full_name: row.fullName,
    handle: row.handle,
    avatar_url: row.avatarUrl,
    cover_photo_url: row.coverPhotoUrl,
    bio: row.bio,
    home_base: row.homeBase,
    profile_visibility: row.profileVisibility,
    public_stats_enabled: row.publicStatsEnabled,
    profile_badges: row.profileBadges,
  };
}

async function getPublicProfileRpc(targetUserId: string): Promise<PublicProfileRpcRow | null> {
  const { data, error } = await supabase.rpc('get_public_profile', {
    p_user_id: targetUserId,
  });

  if (error) {
    const canFallback =
      error.code === 'PGRST202' ||
      error.message?.includes('Could not find the function') ||
      error.message?.includes('schema cache') ||
      error.message?.includes('get_public_profile');
    if (!canFallback && __DEV__) {
      console.warn('[getPublicProfileRpc] failed:', error.message);
    }
    return null;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as PublicProfileRpcRow;
}

/** Get companion status between current user and target. */
export async function getCompanionStatus(targetUserId: string): Promise<CompanionStatus> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === targetUserId) return 'none';

  const { data: myTrips } = await supabase.from('group_members').select('trip_id').eq('user_id', user.id);

  const tripIds = [...new Set((myTrips ?? []).map((row) => row.trip_id as string).filter(Boolean))];
  if (tripIds.length > 0) {
    const { data: sharedMember } = await supabase
      .from('group_members')
      .select('trip_id')
      .eq('user_id', targetUserId)
      .in('trip_id', tripIds)
      .limit(1)
      .maybeSingle();
    if (sharedMember) return 'companion';
  }

  const { data, error } = await supabase
    .from('companions')
    .select('status, source')
    .or(
      `and(user_id.eq.${user.id},companion_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},companion_id.eq.${user.id})`,
    )
    .eq('source', 'trip')
    .limit(1)
    .maybeSingle();

  if (error) return 'none';
  if (!data) return 'none';
  return data.status === 'accepted' ? 'companion' : 'pending';
}

/** Get full companion profile for viewing. */
export async function getCompanionProfile(targetUserId: string): Promise<CompanionProfile> {
  const publicProfile = await getPublicProfileRpc(targetUserId);

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, avatar_url, cover_photo_url, handle, bio, home_base, profile_visibility, public_stats_enabled, profile_badges, phone, socials, companion_privacy',
    )
    .eq('id', targetUserId)
    .maybeSingle();

  let resolvedProfile = profile as Record<string, unknown> | null;
  if (!resolvedProfile && publicProfile) {
    resolvedProfile = mapPublicProfileRpcToProfileRow(publicProfile);
  }
  if (!resolvedProfile) {
    const [fallbackProfile] = await getPublicProfiles([targetUserId]);
    if (!fallbackProfile) throw new Error('Profile not found');
    resolvedProfile = {
      id: fallbackProfile.id,
      full_name: fallbackProfile.fullName,
      avatar_url: fallbackProfile.avatarUrl,
      handle: fallbackProfile.handle,
      companion_privacy: fallbackProfile.companionPrivacy,
    };
  }

  const status = await getCompanionStatus(targetUserId);

  // Count mutual trips
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let mutualTripCount = 0;
  if (user) {
    const { data: myTrips } = await supabase.from('group_members').select('trip_id').eq('user_id', user.id);
    const { data: theirTrips } = await supabase.from('group_members').select('trip_id').eq('user_id', targetUserId);
    if (myTrips && theirTrips) {
      const mySet = new Set(myTrips.map((r) => r.trip_id as string));
      mutualTripCount = theirTrips.filter((r) => mySet.has(r.trip_id as string)).length;
    }
  }

  // Get lifetime stats only if companion and privacy allows
  const privacy = (resolvedProfile.companion_privacy as CompanionPrivacy) ?? DEFAULT_PRIVACY;
  let lifetimeStats: LifetimeStats | undefined;
  if ((status === 'companion' && privacy.showStats) || !!resolvedProfile.public_stats_enabled) {
    lifetimeStats = (await getLifetimeStats(targetUserId).catch(() => undefined)) ?? undefined;

    // Fallback: compute basic stats from their trips if lifetime_stats row is empty
    if (!lifetimeStats) {
      try {
        const { data: memberRows } = await supabase.from('group_members').select('trip_id').eq('user_id', targetUserId);
        const tripIds = (memberRows ?? []).map((r) => r.trip_id as string);
        if (tripIds.length > 0) {
          const { data: trips } = await supabase
            .from(T.trips)
            .select('destination, start_date, end_date')
            .in('id', tripIds);
          const { data: moments } = await supabase
            .from(T.moments)
            .select('id')
            .in('trip_id', tripIds)
            .eq('visibility', 'shared');
          const destinations = new Set((trips ?? []).map((t) => t.destination as string).filter(Boolean));
          const totalNights = (trips ?? []).reduce((sum, t) => {
            const s = new Date(t.start_date as string);
            const e = new Date(t.end_date as string);
            return sum + Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
          }, 0);
          lifetimeStats = {
            totalTrips: tripIds.length,
            totalCountries: destinations.size,
            totalNights,
            totalMiles: 0,
            totalSpent: 0,
            homeCurrency: 'PHP',
            totalMoments: moments?.length ?? 0,
            countriesList: [...destinations],
          };
        }
      } catch {
        /* best-effort */
      }
    }
  }

  return {
    id: resolvedProfile.id as string,
    fullName: (resolvedProfile.full_name as string) ?? 'Traveler',
    avatarUrl: (resolvedProfile.avatar_url as string) ?? undefined,
    coverPhotoUrl: (resolvedProfile.cover_photo_url as string) ?? undefined,
    handle: (resolvedProfile.handle as string) ?? undefined,
    bio: (resolvedProfile.bio as string) ?? undefined,
    homeBase: (resolvedProfile.home_base as string) ?? undefined,
    profileVisibility: (resolvedProfile.profile_visibility as CompanionProfile['profileVisibility']) ?? 'public',
    publicStatsEnabled: (resolvedProfile.public_stats_enabled as boolean) ?? false,
    profileBadges: (resolvedProfile.profile_badges as string[]) ?? undefined,
    phone: (resolvedProfile.phone as string) ?? undefined,
    socials: (resolvedProfile.socials as CompanionProfile['socials']) ?? undefined,
    companionStatus: status,
    companionPrivacy: privacy,
    mutualTripCount,
    lifetimeStats,
  };
}

/** Get all companions for current user. */
export async function getCompanions(): Promise<CompanionProfile[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('companions')
    .select('user_id, companion_id, status')
    .or(`user_id.eq.${user.id},companion_id.eq.${user.id}`)
    .eq('status', 'accepted');

  const companionIds = new Set(
    (data ?? []).map((r) =>
      (r.user_id as string) === user.id ? (r.companion_id as string) : (r.user_id as string),
    ).filter(Boolean),
  );

  // Fallback for invited members linked from a placeholder row. Older backend
  // triggers only fired on INSERT, so shared-trip companions may not have a
  // companions row yet even though group_members already proves the relation.
  try {
    const { data: memberships } = await supabase
      .from(T.groupMembers)
      .select('trip_id')
      .eq('user_id', user.id);
    const tripIds = [...new Set((memberships ?? []).map((row) => row.trip_id as string).filter(Boolean))];
    if (tripIds.length > 0) {
      const { data: sharedMembers } = await supabase
        .from(T.groupMembers)
        .select('user_id')
        .in('trip_id', tripIds)
        .not('user_id', 'is', null)
        .neq('user_id', user.id);
      for (const row of sharedMembers ?? []) {
        const id = row.user_id as string;
        if (id) companionIds.add(id);
      }
    }
  } catch {
    /* best-effort fallback */
  }

  if (companionIds.size === 0) return [];

  const profiles = await getPublicProfiles([...companionIds]);

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl,
    handle: p.handle,
    companionStatus: 'companion' as CompanionStatus,
    companionPrivacy: p.companionPrivacy ?? DEFAULT_PRIVACY,
    mutualTripCount: 0,
  }));
}

export async function getFollowState(targetUserId: string): Promise<FollowState> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isFollowing: false, followersCount: 0, followingCount: 0 };

  const publicProfile = await getPublicProfileRpc(targetUserId);
  if (publicProfile) {
    return {
      isFollowing: !!publicProfile.viewerIsFollowing,
      followersCount: Number(publicProfile.followersCount ?? 0),
      followingCount: Number(publicProfile.followingCount ?? 0),
    };
  }

  const [following, followersCount, followingCount] = await Promise.all([
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .maybeSingle(),
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', targetUserId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', targetUserId),
  ]);

  return {
    isFollowing: !!following.data,
    followersCount: followersCount.count ?? 0,
    followingCount: followingCount.count ?? 0,
  };
}

export async function toggleFollow(targetUserId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('toggleFollow: not authenticated');
  if (user.id === targetUserId) return false;

  const { data: existing } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId)
    .maybeSingle();

  if (existing) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
    return false;
  }

  const { error } = await supabase.from('follows').insert({
    follower_id: user.id,
    following_id: targetUserId,
  });
  if (error) throw new Error(`toggleFollow: ${error.message}`);
  return true;
}

/** Send a companion request. */
export async function addCompanion(targetUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('companions').insert({
    user_id: user.id,
    companion_id: targetUserId,
    status: 'pending',
    source: 'manual',
  });
  if (error) throw new Error(`addCompanion: ${error.message}`);
}

/** Accept a pending companion request. */
export async function acceptCompanion(fromUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('companions')
    .update({ status: 'accepted' })
    .eq('user_id', fromUserId)
    .eq('companion_id', user.id);
  if (error) throw new Error(`acceptCompanion: ${error.message}`);

  // Create reverse entry
  await supabase.from('companions').upsert(
    {
      user_id: user.id,
      companion_id: fromUserId,
      status: 'accepted',
      source: 'manual',
    },
    { onConflict: 'user_id,companion_id' },
  );
}

/** Remove companion (both directions). */
export async function removeCompanion(targetUserId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  await supabase
    .from('companions')
    .delete()
    .or(
      `and(user_id.eq.${user.id},companion_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},companion_id.eq.${user.id})`,
    );
}

/** Get trips that both current user and target share. */
export async function getMutualTrips(targetUserId: string): Promise<Trip[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: myTrips } = await supabase.from('group_members').select('trip_id').eq('user_id', user.id);
  const { data: theirTrips } = await supabase.from('group_members').select('trip_id').eq('user_id', targetUserId);

  if (!myTrips || !theirTrips) return [];
  const mySet = new Set(myTrips.map((r) => r.trip_id as string));
  const mutualIds = theirTrips.map((r) => r.trip_id as string).filter((id) => mySet.has(id));

  if (mutualIds.length === 0) return [];

  const { data: trips } = await supabase
    .from(T.trips)
    .select('*')
    .in('id', mutualIds)
    .order('start_date', { ascending: false });

  const mapped = (trips ?? []).map(mapTrip);

  // Enrich with expense totals
  for (const trip of mapped) {
    try {
      const { data: exps } = await supabase.from(T.expenses).select('amount').eq('trip_id', trip.id);
      trip.totalSpent = (exps ?? []).reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    } catch {
      /* best-effort */
    }
  }

  return mapped;
}

/** Get shared moments from mutual trips. */
export async function getSharedMomentsWith(targetUserId: string): Promise<Moment[]> {
  const mutualTrips = await getMutualTrips(targetUserId);
  if (mutualTrips.length === 0) return [];

  const tripIds = mutualTrips.map((t) => t.id);
  const { data } = await supabase
    .from(T.moments)
    .select('*')
    .in('trip_id', tripIds)
    .eq('visibility', 'shared')
    .order('taken_at', { ascending: false })
    .limit(50);

  return (data ?? []).map(mapMoment);
}

/** Update companion privacy settings. */
export async function updateCompanionPrivacy(prefs: CompanionPrivacy): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  await supabase.from('profiles').update({ companion_privacy: prefs }).eq('id', user.id);
}

/** Get companion privacy for a user. */
export async function getCompanionPrivacySettings(): Promise<CompanionPrivacy> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PRIVACY;
  const { data } = await supabase.from('profiles').select('companion_privacy').eq('id', user.id).single();
  return (data?.companion_privacy as CompanionPrivacy) ?? DEFAULT_PRIVACY;
}

// ── Moment Dismissals (per-user hide/show) ─────────────────────────────────

/** Get set of moment IDs the current user has dismissed for a trip. */
export async function getDismissedMomentIds(tripId: string): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase
    .from('moment_dismissals')
    .select('moment_id, moments!inner(trip_id)')
    .eq('user_id', user.id)
    .eq('moments.trip_id', tripId);
  return new Set((data ?? []).map((r: any) => r.moment_id));
}

/** Dismiss a moment (hide from current user's view). */
export async function dismissMoment(momentId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('dismissMoment: not authenticated');
  const { error } = await supabase
    .from('moment_dismissals')
    .upsert({ user_id: user.id, moment_id: momentId }, { onConflict: 'user_id,moment_id' });
  if (error) throw new Error(`dismissMoment: ${error.message}`);
}

/** Undismiss a moment (show again in current user's view). */
export async function undismissMoment(momentId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('undismissMoment: not authenticated');
  const { error } = await supabase.from('moment_dismissals').delete().eq('user_id', user.id).eq('moment_id', momentId);
  if (error) throw new Error(`undismissMoment: ${error.message}`);
}

/** Batch dismiss multiple moments. */
export async function batchDismissMoments(momentIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('batchDismissMoments: not authenticated');
  const rows = momentIds.map((mid) => ({ user_id: user.id, moment_id: mid }));
  const { error } = await supabase.from('moment_dismissals').upsert(rows, { onConflict: 'user_id,moment_id' });
  if (error) throw new Error(`batchDismissMoments: ${error.message}`);
}

/** Save a group-shared moment to the current user's private collection (copy). */
export async function saveGroupPhotoToPrivate(momentId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('saveGroupPhotoToPrivate: not authenticated');

  // Fetch the source moment
  const { data: source, error: fetchErr } = await supabase.from('moments').select('*').eq('id', momentId).single();
  if (fetchErr || !source) throw new Error('saveGroupPhotoToPrivate: moment not found');

  // Insert as private copy owned by current user
  const { error } = await supabase.from('moments').insert({
    trip_id: source.trip_id,
    user_id: user.id,
    visibility: 'private',
    caption: source.caption,
    photo: source.photo,
    hd_url: source.hd_url,
    blurhash: source.blurhash,
    location: source.location,
    taken_at: source.taken_at,
    tags: source.tags,
  });
  if (error) throw new Error(`saveGroupPhotoToPrivate: ${error.message}`);
}

// ── Public Feed ─────────────────────────────────────────────────

const FEED_PAGE_SIZE = 20;

/** Fetch public moments feed with pagination. */
export async function getPublicFeed(offset = 0, limit = FEED_PAGE_SIZE): Promise<FeedPage> {
  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getPublicFeed: ${error.message}`);

  const moments = (data ?? []).map(mapMoment);
  return {
    moments,
    nextOffset: moments.length === limit ? offset + limit : null,
  };
}

/** Fetch trending public moments (most liked in recent hours). */
export async function getTrendingFeed(offset = 0, limit = FEED_PAGE_SIZE, hoursBack = 24): Promise<FeedPage> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('is_public', true)
    .gte('created_at', since)
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getTrendingFeed: ${error.message}`);

  const moments = (data ?? []).map(mapMoment);
  return {
    moments,
    nextOffset: moments.length === limit ? offset + limit : null,
  };
}

/** Fetch nearby public moments using bounding-box approximation.
 *  1 degree latitude ~111km, so 0.45 deg ~ 50km.
 *  Longitude adjusted by cos(lat). */
export async function getNearbyFeed(
  lat: number,
  lng: number,
  radiusKm = 50,
  offset = 0,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPage> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('is_public', true)
    .not('latitude', 'is', null)
    .gte('latitude', lat - latDelta)
    .lte('latitude', lat + latDelta)
    .gte('longitude', lng - lngDelta)
    .lte('longitude', lng + lngDelta)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getNearbyFeed: ${error.message}`);

  const moments = (data ?? []).map(mapMoment);
  return {
    moments,
    nextOffset: moments.length === limit ? offset + limit : null,
  };
}

/** Fetch public moments from user's companions. */
export async function getFriendsFeed(offset = 0, limit = FEED_PAGE_SIZE): Promise<FeedPage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('getFriendsFeed: not authenticated');

  // Get companion user IDs (people who share a trip with the current user)
  const { data: myMemberships } = await supabase.from('group_members').select('trip_id').eq('user_id', user.id);

  if (!myMemberships || myMemberships.length === 0) {
    return { moments: [], nextOffset: null };
  }

  const tripIds = myMemberships.map((m) => m.trip_id as string);

  const { data: companionRows } = await supabase
    .from('group_members')
    .select('user_id')
    .in('trip_id', tripIds)
    .neq('user_id', user.id);

  const companionIds = [...new Set((companionRows ?? []).map((r) => r.user_id as string))];
  if (companionIds.length === 0) {
    return { moments: [], nextOffset: null };
  }

  const { data, error } = await supabase
    .from(T.moments)
    .select('*')
    .eq('is_public', true)
    .in('user_id', companionIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getFriendsFeed: ${error.message}`);

  const moments = (data ?? []).map(mapMoment);
  return {
    moments,
    nextOffset: moments.length === limit ? offset + limit : null,
  };
}

/** Set a moment's public visibility. Only the moment owner can do this. */
export async function setMomentPublic(momentId: string, isPublic: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('setMomentPublic: not authenticated');

  const { error } = await supabase
    .from(T.moments)
    .update({ is_public: isPublic })
    .eq('id', momentId)
    .eq('user_id', user.id);

  if (error) throw new Error(`setMomentPublic: ${error.message}`);
}

// ── Feed Posts ───────────────────────────────────────────────────

function mapFeedPost(row: Record<string, unknown>): FeedPost {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as FeedPostType,
    caption: (row.caption as string) ?? undefined,
    momentId: (row.moment_id as string) ?? undefined,
    tripId: (row.trip_id as string) ?? undefined,
    photoUrl: resolvePhotoUrl(row.photo_url as string | undefined),
    locationName: (row.location_name as string) ?? undefined,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    layoutType: (row.layout_type as FeedPost['layoutType']) ?? undefined,
    likesCount: (row.likes_count as number) ?? 0,
    commentsCount: (row.comments_count as number) ?? 0,
    saveCount: (row.save_count as number) ?? 0,
    shareCount: (row.share_count as number) ?? 0,
    isPublic: !!row.is_public,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

const FEED_POST_PAGE = 20;

/** Fetch public feed posts, newest first. */
export async function getFeedPosts(
  offset = 0,
  limit = FEED_POST_PAGE,
): Promise<{ posts: FeedPost[]; nextOffset: number | null }> {
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getFeedPosts: ${error.message}`);
  const posts = (data ?? []).map(mapFeedPost);
  return { posts, nextOffset: posts.length === limit ? offset + limit : null };
}

/** Fetch trending posts (most liked in recent hours). */
export async function getTrendingPosts(
  offset = 0,
  limit = FEED_POST_PAGE,
  hoursBack = 24,
): Promise<{ posts: FeedPost[]; nextOffset: number | null }> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('is_public', true)
    .gte('created_at', since)
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getTrendingPosts: ${error.message}`);
  const posts = (data ?? []).map(mapFeedPost);
  return { posts, nextOffset: posts.length === limit ? offset + limit : null };
}

/** Fetch companion posts (from users who share a trip with you). */
export async function getCompanionPosts(
  offset = 0,
  limit = FEED_POST_PAGE,
): Promise<{ posts: FeedPost[]; nextOffset: number | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('getCompanionPosts: not authenticated');

  const { data: myTrips } = await supabase.from('group_members').select('trip_id').eq('user_id', user.id);
  if (!myTrips || myTrips.length === 0) return { posts: [], nextOffset: null };

  const tripIds = myTrips.map((m) => m.trip_id as string);
  const { data: companions } = await supabase
    .from('group_members')
    .select('user_id')
    .in('trip_id', tripIds)
    .neq('user_id', user.id);
  const companionIds = [...new Set((companions ?? []).map((r) => r.user_id as string))];
  if (companionIds.length === 0) return { posts: [], nextOffset: null };

  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('is_public', true)
    .in('user_id', companionIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`getCompanionPosts: ${error.message}`);
  const posts = (data ?? []).map(mapFeedPost);
  return { posts, nextOffset: posts.length === limit ? offset + limit : null };
}

/** Create a feed post. */
export async function createFeedPost(input: {
  type: FeedPostType;
  caption?: string;
  momentId?: string;
  tripId?: string;
  photoUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
}): Promise<FeedPost> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('createFeedPost: not authenticated');

  const { data, error } = await supabase
    .from('feed_posts')
    .insert({
      user_id: user.id,
      type: input.type,
      caption: input.caption ?? null,
      moment_id: input.momentId ?? null,
      trip_id: input.tripId ?? null,
      photo_url: input.photoUrl ?? null,
      location_name: input.locationName ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      metadata: input.metadata ?? {},
      is_public: true,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(`createFeedPost: ${error?.message ?? 'insert failed'}`);
  return mapFeedPost(data);
}

/** Delete a feed post. */
export async function deleteFeedPost(postId: string): Promise<void> {
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
  if (error) throw new Error(`deleteFeedPost: ${error.message}`);
}

/** Toggle like on a feed post. Returns true if now liked. */
export async function togglePostLike(postId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('togglePostLike: not authenticated');

  const { data: existing } = await supabase
    .from('feed_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('feed_post_likes').delete().eq('id', existing.id);
    return false;
  }
  const { error } = await supabase.from('feed_post_likes').insert({ post_id: postId, user_id: user.id });
  if (error) throw new Error(`togglePostLike: ${error.message}`);
  return true;
}

/** Get comments for a feed post. */
export async function getPostComments(postId: string): Promise<FeedPostComment[]> {
  const { data, error } = await supabase
    .from('feed_post_comments')
    .select('id, post_id, user_id, text, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`getPostComments: ${error.message}`);
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((c) => c.user_id as string))];
  const profiles = await getPublicProfiles(userIds);
  const pm = new Map(profiles.map((p) => [p.id, { name: p.fullName, avatar: p.avatarUrl }]));

  return data.map((c) => ({
    id: c.id as string,
    postId: c.post_id as string,
    userId: c.user_id as string,
    userName: pm.get(c.user_id as string)?.name ?? 'Traveler',
    userAvatar: pm.get(c.user_id as string)?.avatar,
    text: c.text as string,
    createdAt: c.created_at as string,
  }));
}

/** Add a comment to a feed post. */
export async function addPostComment(postId: string, text: string): Promise<FeedPostComment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('addPostComment: not authenticated');

  const { data, error } = await supabase
    .from('feed_post_comments')
    .insert({ post_id: postId, user_id: user.id, text: text.trim() })
    .select('id, post_id, user_id, text, created_at')
    .single();

  if (error || !data) throw new Error(`addPostComment: ${error?.message ?? 'insert failed'}`);

  const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single();

  return {
    id: data.id as string,
    postId: data.post_id as string,
    userId: user.id,
    userName: (profile?.full_name as string) ?? 'You',
    userAvatar: (profile?.avatar_url as string) ?? undefined,
    text: data.text as string,
    createdAt: data.created_at as string,
  };
}
