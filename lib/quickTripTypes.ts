export type QuickTripCategory =
  | 'family'
  | 'date'
  | 'coffee'
  | 'solo'
  | 'food'
  | 'activity'
  | 'other';

export const QUICK_TRIP_CATEGORIES: { key: QuickTripCategory; label: string; emoji: string }[] = [
  { key: 'family', label: 'Family', emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66' },
  { key: 'date', label: 'Date', emoji: '\u2764\uFE0F' },
  { key: 'coffee', label: 'Coffee', emoji: '\u2615' },
  { key: 'solo', label: 'Solo', emoji: '\uD83E\uDDD8' },
  { key: 'food', label: 'Food', emoji: '\uD83C\uDF7D\uFE0F' },
  { key: 'activity', label: 'Activity', emoji: '\uD83C\uDFC4' },
  { key: 'other', label: 'Other', emoji: '\u2728' },
];

export const CATEGORY_EMOJI: Record<QuickTripCategory, string> = Object.fromEntries(
  QUICK_TRIP_CATEGORIES.map((c) => [c.key, c.emoji]),
) as Record<QuickTripCategory, string>;

export interface QuickTrip {
  id: string;
  createdByUserId: string;
  title: string;
  placeName: string;
  placeAddress?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
  category: QuickTripCategory;
  occurredAt: string;
  coverPhotoUrl?: string;
  photoCount: number;
  companionCount: number;
  totalSpendAmount: number;
  totalSpendCurrency: string;
  notes?: string;
  createdAt: string;
}

export interface QuickTripPhoto {
  id: string;
  quickTripId: string;
  photoUrl: string;
  ordinal: number;
  exifTakenAt?: string;
  createdAt: string;
}

export interface QuickTripCompanion {
  id: string;
  quickTripId: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface QuickTripExpense {
  id: string;
  quickTripId: string;
  createdByUserId?: string;
  amount: number;
  currency: string;
  description?: string;
  paidByCompanionId?: string;
  splitType?: 'even' | 'custom' | 'record_only';
  occurredAt: string;
  receiptPhotoUrl?: string;
  createdAt: string;
}

export interface QuickTripExpenseSplit {
  id: string;
  quickTripExpenseId: string;
  companionId: string;
  amountOwed: number;
  settledAt?: string;
  createdAt: string;
}

export interface CreateQuickTripInput {
  title?: string;
  placeName: string;
  placeAddress?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
  category: QuickTripCategory;
  occurredAt: string;
  notes?: string;
  photoUris: string[];
  companions: { displayName: string; userId?: string; avatarUrl?: string }[];
}
