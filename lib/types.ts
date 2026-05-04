// Centralized domain types for the AfterStay travel app.

export type TripStatus = 'Planning' | 'Active' | 'Completed';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string; // ISO
  endDate: string; // ISO
  nights: number;
  accommodation: string;
  address: string;
  roomType: string;
  checkIn?: string;
  checkOut?: string;
  hotelPhone?: string;
  bookingRef?: string;
  cost?: number;
  costCurrency?: string;
  transport?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  doorCode?: string;
  locationRating?: string;
  amenities?: string[];
  notes?: string;
  status: TripStatus;
  heroImageUrl?: string;
  hotelUrl?: string;
  airportArrivalBuffer?: string;
  airportToHotelTime?: string;
  customQuickAccess?: string;
  transportNotes?: string;
  houseRules?: string;
  emergencyContacts?: string;
  hotelPhotos?: string; // JSON string of URL array
  hotelLat?: number;
  hotelLng?: number;
  budgetLimit?: number;
  budgetMode?: 'Limited' | 'Unlimited';
  // Lifetime / past-trip fields
  userId?: string;
  isPastImport?: boolean;
  confidenceLevel?: 'real' | 'user_added';
  datePrecision?: 'exact' | 'month_year';
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  totalSpent?: number;
  totalNights?: number;
  isDraft?: boolean;
  deletedAt?: string;
  archivedAt?: string;
}

export type TripFileType = 'Boarding Pass' | 'Hotel Confirmation' | 'Itinerary' | 'Insurance' | 'ID/Passport' | 'Receipt' | 'Other';

export interface TripFile {
  id: string;
  fileName: string;
  fileUrl?: string;
  storagePath?: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  previewError?: string;
  type: TripFileType;
  notes?: string;
  printRequired: boolean;
}

export interface Flight {
  id: string;
  direction: 'Outbound' | 'Return';
  flightNumber: string;
  airline: string;
  from: string;
  to: string;
  departTime: string; // ISO
  arriveTime: string; // ISO
  bookingRef?: string;
  seatNumber?: string;
  baggage?: string;
  passenger?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  role: 'Primary' | 'Member';
  userId?: string;
  flightId?: string;
  checkedBaggage?: boolean;
  sharesAccommodation?: boolean;
  travelNotes?: string;
  phone?: string;
  email?: string;
  profilePhoto?: string;
}

export interface PackingItem {
  id: string;
  item: string;
  category: 'Clothing' | 'Tech' | 'Toiletries' | 'Documents' | 'Gear' | 'Other';
  packed: boolean;
  owner?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: 'Food' | 'Transport' | 'Activity' | 'Accommodation' | 'Shopping' | 'Other';
  date: string; // ISO
  paidBy?: string;
  photo?: string;
  placeName?: string;
  placeLatitude?: number;
  placeLongitude?: number;
  splitType?: 'Equal' | 'Custom' | 'Individual';
  notes?: string;
  userId?: string;
}

export type PlaceCategory =
  | 'Eat'
  | 'Do'
  | 'Nature'
  | 'Essentials'
  | 'Transport'
  | 'Nightlife'
  | 'Wellness'
  | 'Culture'
  | 'Coffee'
  | 'Stay';

export type PlaceSource = 'Suggested' | 'Manual' | 'Friend Rec';
export type PlaceVote = '👍 Yes' | '👎 No' | 'Pending';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  distance?: string;
  notes?: string;
  priceEstimate?: string;
  rating?: number;
  source: PlaceSource;
  vote: PlaceVote;
  voteByMember?: Record<string, PlaceVote>;
  photoUrl?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  googleMapsUri?: string;
  totalRatings?: number;
  saved?: boolean;
}

export interface WishlistItem {
  id: string;
  name: string;
  category?: string;
  googlePlaceId?: string;
  photoUrl?: string;
  rating?: number;
  totalRatings?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  destination?: string;
  notes?: string;
  sourcePostId?: string;
  sourceTripId?: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  task: string;
  done: boolean;
  doneBy?: string;
  dueAt?: string;
}

export interface WeatherDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  condition: string;
  icon: string;
  chanceOfRain: number;
}

export type MomentTag = 'Beach' | 'Food' | 'Sunset' | 'Group' | 'Activity' | 'Hotel' | 'Scenery' | 'Night';

export type MomentVisibility = 'shared' | 'private' | 'album' | 'public';

export interface Moment {
  id: string;
  caption: string;
  photo?: string;
  hdPhoto?: string;
  blurhash?: string;
  location?: string;
  takenBy?: string;
  userId?: string;
  date: string;
  tags: MomentTag[];
  visibility?: MomentVisibility;
  isPublic?: boolean;
  likesCount?: number;
  commentsCount?: number;
  dayNumber?: number;
  latitude?: number;
  longitude?: number;
}

export type FeedFilter = 'recent' | 'trending' | 'nearby' | 'friends';

export interface FeedPage {
  moments: Moment[];
  nextOffset: number | null;
}

// ── Feed Posts (multi-type newsfeed) ──────────────────────────
export type FeedPostType = 'photo' | 'text' | 'trip_summary' | 'budget' | 'recommendation' | 'trip_invite' | 'carousel' | 'collage' | 'story_reference';

export type LayoutType = 'single' | 'carousel' | 'polaroid_stack' | 'grid';

export interface PostMedia {
  id: string;
  mediaUrl: string;
  storagePath: string;
  mediaType: string;
  width?: number;
  height?: number;
  orderIndex: number;
}

export interface FeedPost {
  id: string;
  userId: string;
  type: FeedPostType;
  caption?: string;
  momentId?: string;
  tripId?: string;
  photoUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  metadata: Record<string, unknown>;
  layoutType?: LayoutType;
  media?: PostMedia[];
  likesCount: number;
  commentsCount: number;
  saveCount: number;
  shareCount: number;
  isPublic: boolean;
  createdAt: string;
  userName?: string;
  userAvatar?: string;
  tripName?: string;
  dayNumber?: number;
  viewerHasLiked?: boolean;
  viewerHasSaved?: boolean;
}

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  storagePath: string;
  caption?: string;
  placeId?: string;
  locationName?: string;
  visibility: string;
  createdAt: string;
  expiresAt: string;
  userName?: string;
  userAvatar?: string;
  viewed?: boolean;
}

export interface StoryView {
  userId: string;
  storyId: string;
  viewedAt: string;
}

export interface PostTag {
  id: string;
  postId: string;
  taggedUserId: string;
  taggedByUserId: string;
  userName?: string;
  userAvatar?: string;
  createdAt: string;
}

export interface FeedPostComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
}

export type AlbumMemberRole = 'owner' | 'contributor' | 'viewer' | 'surprise';

export interface Album {
  id: string;
  tripId: string;
  name: string;
  coverMomentId?: string;
  coverUrl?: string;
  ownerId: string;
  hideFromMosaic: boolean;
  autoRevealAt?: string;
  memberCount: number;
  momentCount: number;
  createdAt: string;
}

export interface AlbumMember {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  color?: string;
  role: AlbumMemberRole;
  momentCount: number;
}

export interface PersonalPhoto {
  id: string;
  userId: string;
  photoUrl?: string;
  storagePath?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  caption?: string;
  takenAt: string;
  tags?: string[];
}

export interface AIRecommendation {
  name: string;
  category: PlaceCategory;
  distance: string;
  price_estimate: string;
  reason: string;
  rating: number;
}

// ---------- LIFETIME / PAST TRIPS ----------

export interface LifetimeStats {
  totalTrips: number;
  totalCountries: number;
  totalNights: number;
  totalMiles: number;
  totalSpent: number;
  homeCurrency: string;
  totalMoments: number;
  countriesList: string[];
  earliestTripDate?: string;
}

export type HighlightType =
  | 'countries_visited' | 'miles_traveled' | 'beach_streak'
  | 'total_moments' | 'longest_trip' | 'most_visited'
  | 'favorite_companion' | 'first_solo' | 'first_trip'
  | 'new_territory' | 'start_of_something';

export interface Highlight {
  id: string;
  type: HighlightType;
  displayText: string;
  supportingData?: Record<string, unknown>;
  rank: number;
}

// ---------- Premium + Trip Memories ----------

export type UserTier = 'free' | 'premium';
export type UserSegment = 'new' | 'planning' | 'active' | 'returning';

export interface TripMemoryStats {
  mostPhotographedSpot?: string;
  favoriteFood?: string;
  busiestDay?: string;
  totalPhotos: number;
  totalPlacesVisited: number;
  totalExpenses: number;
  longestDayOut?: string;
  topTag?: string;
}

export interface TripMemoryVibe {
  dominantMood: string;
  topTags: string[];
  vibeDescription: string;
}

export interface TripMemorySnapshot {
  destination: string;
  startDate: string;
  endDate: string;
  nights: number;
  accommodation: string;
  memberNames: string[];
  memberCount: number;
  heroImageUrl?: string;
}

export interface TripMemoryExpenses {
  total: number;
  currency: string;
  topCategories: { category: string; amount: number }[];
  biggestSplurge?: { description: string; amount: number };
  dailyAverage: number;
}

export interface TripMemoryPlace {
  name: string;
  category: string;
  rating?: number;
  vote: string;
}

export interface TripMemoryFlight {
  direction: string;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
}

export type TripMemoryStatus = 'draft' | 'saved';

export interface TripMemory {
  id: string;
  tripId: string;
  userId: string;
  narrative: string;
  dayHighlights: { day: string; summary: string }[];
  statsCard: TripMemoryStats;
  vibeAnalysis: TripMemoryVibe;
  tripSnapshot: TripMemorySnapshot;
  expenseSummary: TripMemoryExpenses;
  placesSummary: TripMemoryPlace[];
  flightSummary: TripMemoryFlight[];
  heroMomentId?: string;
  featuredMomentIds: string[];
  status: TripMemoryStatus;
  createdAt: string;
  savedAt?: string;
}

// ── Expense targeting (budget screen) ──────────────────────────────

// ── AI Concierge ───────────────────────────────────────────────────

export type ConciergeWhat = 'food' | 'coffee' | 'activity' | 'nightlife' | 'wellness' | 'explore';
export type ConciergeWhen = 'now' | 'later_today' | 'tomorrow' | string;
export type ConciergeWho = 'just_me' | 'everyone' | string[];

export interface ConciergeResultPlace {
  name: string;
  reason: string;
  isQuickMoment: boolean;
  estimatedDuration: string;
  priceRange: string;
  placeId?: string;
  photoUrl?: string;
  rating?: number;
  totalRatings?: number;
  lat?: number;
  lng?: number;
  openNow?: boolean;
  types?: string[];
  address?: string;
}

// ── Expense targeting (budget screen) ──────────────────────────────

// ── Companion System ─────────────────────────────────────────────

// ── Moment Comments ──────────────────────────────────────────────

export interface MomentComment {
  id: string;
  momentId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
}

// ── Companion System ─────────────────────────────────────────────

export type CompanionStatus = 'none' | 'pending' | 'companion';

export interface CompanionPrivacy {
  showStats: boolean;
  showSharedMoments: boolean;
  showPastTrips: boolean;
  showUpcomingTrips: boolean;
  showSocials: boolean;
}

export interface CompanionProfile {
  id: string;
  fullName: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  handle?: string;
  bio?: string;
  homeBase?: string;
  profileVisibility?: 'public' | 'companions' | 'private';
  publicStatsEnabled?: boolean;
  profileBadges?: string[];
  phone?: string;
  socials?: {
    instagram?: string;
    tiktok?: string;
    x?: string;
    facebook?: string;
  };
  companionStatus: CompanionStatus;
  companionPrivacy: CompanionPrivacy;
  mutualTripCount: number;
  lifetimeStats?: LifetimeStats;
}

export interface FollowState {
  isFollowing: boolean;
  isFollowedBy?: boolean;
  followersCount: number;
  followingCount: number;
}

export type ExpenseTarget =
  | { type: 'trip'; tripId?: string }
  | { type: 'quick-trip'; quickTripId: string }
  | { type: 'standalone' }
  | { type: 'daily-tracker' };

export interface UnifiedExpenseHistoryItem {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  source: 'trip' | 'quick-trip' | 'standalone' | 'daily';
  sourceLabel?: string;
  sourceId?: string;
  paidBy?: string;
  splitType?: string;
  placeName?: string;
}

// ── Daily Expense Tracker ────────────────────────────────────────────

export type DailyExpenseCategory = 'Food' | 'Transport' | 'Bills' | 'Entertainment' | 'Groceries' | 'Other';

export interface DailyExpense extends Expense {
  dailyCategory: DailyExpenseCategory;
}

export interface DailyExpenseSummary {
  date: string;
  total: number;
  byCategory: Partial<Record<DailyExpenseCategory, number>>;
  count: number;
}

export interface DailyExpensePeriodSummary {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  total: number;
  average: number;
  byCategory: Record<string, number>;
  count: number;
}

export interface DailyTrackerSettings {
  weeklyBudget?: number;
  monthlyBudget?: number;
  income?: number;
  currency?: string;
  weeklyReport?: boolean;
  trackedCategories?: DailyExpenseCategory[];
}

// ── Savings Goal ─────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  targetCurrency: string;
  targetDate?: string;
  destination?: string;
  linkedTripId?: string;
  currentAmount: number;
  isActive: boolean;
  celebratedMilestones: number[];
  createdAt: string;
  updatedAt: string;
}

export interface SavingsEntry {
  id: string;
  goalId: string;
  amount: number;
  currency: string;
  note?: string;
  entryDate: string;
  createdAt: string;
}

export type SavingsMilestone = 25 | 50 | 75 | 100;

export interface DestinationOverview {
  summary: string;
  highlights: string[];
  budgetRange: { budget: string; mid: string; luxury: string };
  bestMonths: string;
  weatherNote: string;
  gettingThere: string;
}
