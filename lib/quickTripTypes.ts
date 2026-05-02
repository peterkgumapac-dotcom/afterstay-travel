export type QuickTripCategory =
  | 'family'
  | 'date'
  | 'coffee'
  | 'solo'
  | 'food'
  | 'activity'
  | 'other';

export const QUICK_TRIP_CATEGORIES: { key: QuickTripCategory; label: string; icon: string }[] = [
  { key: 'family', label: 'Family', icon: 'Users' },
  { key: 'date', label: 'Date', icon: 'Heart' },
  { key: 'coffee', label: 'Coffee', icon: 'Coffee' },
  { key: 'solo', label: 'Solo', icon: 'User' },
  { key: 'food', label: 'Food', icon: 'UtensilsCrossed' },
  { key: 'activity', label: 'Activity', icon: 'Dumbbell' },
  { key: 'other', label: 'Other', icon: 'Sparkles' },
];

/** Icon name for each category (lucide-react-native) */
export const CATEGORY_ICON: Record<QuickTripCategory, string> = Object.fromEntries(
  QUICK_TRIP_CATEGORIES.map((c) => [c.key, c.icon]),
) as Record<QuickTripCategory, string>;

/** @deprecated Use CATEGORY_ICON instead */
export const CATEGORY_EMOJI: Record<QuickTripCategory, string> = {
  family: 'Users',
  date: 'Heart',
  coffee: 'Coffee',
  solo: 'User',
  food: 'UtensilsCrossed',
  activity: 'Dumbbell',
  other: 'Sparkles',
};

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
