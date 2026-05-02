import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { base64ToBytes } from './base64';
import { compressImage } from './compressImage';
import type {
  QuickTrip,
  QuickTripPhoto,
  QuickTripCompanion,
  QuickTripExpense,
  CreateQuickTripInput,
} from './quickTripTypes';

// ---------- MAPPERS ----------

function mapQuickTrip(row: Record<string, unknown>): QuickTrip {
  return {
    id: row.id as string,
    createdByUserId: row.created_by_user_id as string,
    title: (row.title as string) ?? '',
    placeName: (row.place_name as string) ?? '',
    placeAddress: row.place_address as string | undefined,
    googlePlaceId: row.google_place_id as string | undefined,
    latitude: row.latitude as number | undefined,
    longitude: row.longitude as number | undefined,
    category: (row.category as QuickTrip['category']) ?? 'other',
    occurredAt: row.occurred_at as string,
    coverPhotoUrl: row.cover_photo_url as string | undefined,
    photoCount: (row.photo_count as number) ?? 0,
    companionCount: (row.companion_count as number) ?? 0,
    totalSpendAmount: (row.total_spend_amount as number) ?? 0,
    totalSpendCurrency: (row.total_spend_currency as string) ?? 'PHP',
    notes: row.notes as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapPhoto(row: Record<string, unknown>): QuickTripPhoto {
  return {
    id: row.id as string,
    quickTripId: row.quick_trip_id as string,
    photoUrl: row.photo_url as string,
    ordinal: (row.ordinal as number) ?? 0,
    exifTakenAt: row.exif_taken_at as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapCompanion(row: Record<string, unknown>): QuickTripCompanion {
  return {
    id: row.id as string,
    quickTripId: row.quick_trip_id as string,
    userId: row.user_id as string | undefined,
    displayName: (row.display_name as string) ?? '',
    avatarUrl: row.avatar_url as string | undefined,
    createdAt: row.created_at as string,
  };
}

function mapExpense(row: Record<string, unknown>): QuickTripExpense {
  return {
    id: row.id as string,
    quickTripId: row.quick_trip_id as string,
    createdByUserId: row.created_by_user_id as string | undefined,
    amount: (row.amount as number) ?? 0,
    currency: (row.currency as string) ?? 'PHP',
    description: row.description as string | undefined,
    paidByCompanionId: row.paid_by_companion_id as string | undefined,
    splitType: row.split_type as QuickTripExpense['splitType'],
    occurredAt: row.occurred_at as string,
    receiptPhotoUrl: row.receipt_photo_url as string | undefined,
    createdAt: row.created_at as string,
  };
}

// ---------- QUICK TRIPS CRUD ----------

/** Fetch all quick trips for the current user, newest first. */
export async function getQuickTrips(): Promise<QuickTrip[]> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('quick_trips')
    .select('*')
    .eq('created_by_user_id', userId)
    .order('occurred_at', { ascending: false });

  if (error || !data) return [];
  return data.map((r) => mapQuickTrip(r as Record<string, unknown>));
}

/** Fetch a single quick trip by ID. */
export async function getQuickTripById(id: string): Promise<QuickTrip | null> {
  const { data, error } = await supabase
    .from('quick_trips')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return mapQuickTrip(data as Record<string, unknown>);
}

/** Fetch photos for a quick trip, ordered by ordinal. */
export async function getQuickTripPhotos(quickTripId: string): Promise<QuickTripPhoto[]> {
  const { data, error } = await supabase
    .from('quick_trip_photos')
    .select('*')
    .eq('quick_trip_id', quickTripId)
    .order('ordinal', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => mapPhoto(r as Record<string, unknown>));
}

/** Fetch companions for a quick trip. */
export async function getQuickTripCompanions(quickTripId: string): Promise<QuickTripCompanion[]> {
  const { data, error } = await supabase
    .from('quick_trip_companions')
    .select('*')
    .eq('quick_trip_id', quickTripId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => mapCompanion(r as Record<string, unknown>));
}

/** Create a quick trip with photos and companions. */
export async function createQuickTrip(input: CreateQuickTripInput): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const title = input.title?.trim() || `${input.category === 'food' ? 'Dinner' : input.category === 'coffee' ? 'Coffee' : 'Trip'} at ${input.placeName}`;

  // Insert quick trip
  const { data: qt, error: qtErr } = await supabase
    .from('quick_trips')
    .insert({
      created_by_user_id: userId,
      title,
      place_name: input.placeName,
      place_address: input.placeAddress ?? null,
      google_place_id: input.googlePlaceId ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      category: input.category,
      occurred_at: input.occurredAt,
      notes: input.notes ?? null,
      photo_count: input.photoUris.length,
      companion_count: input.companions.length,
    })
    .select('id')
    .single();

  if (qtErr || !qt) throw new Error(`Failed to create quick trip: ${qtErr?.message}`);
  const quickTripId = qt.id as string;

  // Upload photos
  let coverUrl: string | undefined;
  for (let i = 0; i < input.photoUris.length; i++) {
    try {
      const uri = input.photoUris[i];
      const compressed = await compressImage(uri, 1200, 0.8);
      const ext = 'jpg';
      const storagePath = `quick-trips/${quickTripId}/${i}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(compressed, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToBytes(base64);
      const { error: uploadErr } = await supabase.storage
        .from('moments')
        .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('moments').getPublicUrl(storagePath);
        const publicUrl = urlData?.publicUrl;
        if (publicUrl) {
          if (i === 0) coverUrl = publicUrl;
          await supabase.from('quick_trip_photos').insert({
            quick_trip_id: quickTripId,
            photo_url: publicUrl,
            ordinal: i,
          });
        }
      }
    } catch {
      // Best-effort photo upload
    }
  }

  // Update cover photo
  if (coverUrl) {
    await supabase.from('quick_trips').update({ cover_photo_url: coverUrl }).eq('id', quickTripId);
  }

  // Insert companions
  if (input.companions.length > 0) {
    const companionRows = input.companions.map((c) => ({
      quick_trip_id: quickTripId,
      user_id: c.userId ?? null,
      display_name: c.displayName,
      avatar_url: c.avatarUrl ?? null,
    }));
    await supabase.from('quick_trip_companions').insert(companionRows);
  }

  return quickTripId;
}

/** Delete a quick trip (cascade deletes photos, companions, expenses). */
export async function deleteQuickTrip(id: string): Promise<void> {
  await supabase.from('quick_trips').delete().eq('id', id);
}

// ---------- EXPENSES ----------

/** Fetch expenses for a quick trip. */
export async function getQuickTripExpenses(quickTripId: string): Promise<QuickTripExpense[]> {
  const { data, error } = await supabase
    .from('quick_trip_expenses')
    .select('*')
    .eq('quick_trip_id', quickTripId)
    .order('occurred_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => mapExpense(r as Record<string, unknown>));
}

/** Add an expense to a quick trip and update denormalized total. */
export async function addQuickTripExpense(input: {
  quickTripId: string;
  amount: number;
  currency?: string;
  description?: string;
  paidByCompanionId?: string;
  splitType?: 'even' | 'custom' | 'record_only';
  occurredAt?: string;
  receiptPhotoUrl?: string;
}): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();

  const { error } = await supabase.from('quick_trip_expenses').insert({
    quick_trip_id: input.quickTripId,
    created_by_user_id: authData?.user?.id ?? null,
    amount: input.amount,
    currency: input.currency ?? 'PHP',
    description: input.description ?? null,
    paid_by_companion_id: input.paidByCompanionId ?? null,
    split_type: input.splitType ?? 'even',
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    receipt_photo_url: input.receiptPhotoUrl ?? null,
  });

  if (error) throw new Error(`Failed to add expense: ${error.message}`);

  // Update denormalized total
  await refreshQuickTripTotal(input.quickTripId);
}

/** Delete an expense and update denormalized total. */
export async function deleteQuickTripExpense(expenseId: string, quickTripId: string): Promise<void> {
  await supabase.from('quick_trip_expenses').delete().eq('id', expenseId);
  await refreshQuickTripTotal(quickTripId);
}

/** Get expense summary for a quick trip. */
export async function getQuickTripExpenseSummary(
  quickTripId: string,
): Promise<{ total: number; count: number }> {
  const expenses = await getQuickTripExpenses(quickTripId);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  return { total, count: expenses.length };
}

/** Refresh the denormalized total_spend_amount on quick_trips. */
async function refreshQuickTripTotal(quickTripId: string): Promise<void> {
  const { total } = await getQuickTripExpenseSummary(quickTripId);
  await supabase
    .from('quick_trips')
    .update({ total_spend_amount: total, updated_at: new Date().toISOString() })
    .eq('id', quickTripId);
}
