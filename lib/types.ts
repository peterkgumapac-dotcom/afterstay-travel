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
}

export type TripFileType = 'Boarding Pass' | 'Hotel Confirmation' | 'Itinerary' | 'Insurance' | 'ID/Passport' | 'Receipt' | 'Other';

export interface TripFile {
  id: string;
  fileName: string;
  fileUrl?: string;
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
  baggage?: string;
  passenger?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  role: 'Primary' | 'Member';
  flightId?: string;
  checkedBaggage?: boolean;
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
  | 'Coffee';

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
  googleMapsUri?: string;
  totalRatings?: number;
  saved?: boolean;
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

export interface Moment {
  id: string;
  caption: string;
  photo?: string;
  location?: string;
  takenBy?: string;
  date: string;
  tags: MomentTag[];
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
