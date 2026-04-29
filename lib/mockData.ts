/**
 * Mock data for developer test mode.
 * Used when segment override is active to simulate each user lifecycle state.
 */

import type {
  Trip,
  Flight,
  GroupMember,
  Expense,
  Moment,
  Place,
  PackingItem,
  LifetimeStats,
  UserSegment,
} from '@/lib/types';

// ── Types ───────────────────────────────────────────────────────────

/** Trip phases that can be simulated in test mode */
export type MockTripPhase = 'upcoming' | 'inflight' | 'arrived' | 'active';

/** Full mock key: non-active segments + active sub-phases */
export type MockKey = Exclude<UserSegment, 'active'> | `active:${MockTripPhase}`;

export const MOCK_KEYS: MockKey[] = [
  'new',
  'planning',
  'active:upcoming',
  'active:inflight',
  'active:arrived',
  'active:active',
  'returning',
];

export const MOCK_LABELS: Record<MockKey, string> = {
  new: 'New User',
  planning: 'Planning (Draft Trip)',
  'active:upcoming': 'Active — Upcoming (flight in 5 days)',
  'active:inflight': 'Active — In Flight (on the plane)',
  'active:arrived': 'Active — Just Arrived (landed 1hr ago)',
  'active:active': 'Active — At Destination (day 3)',
  returning: 'Returning (completed trips)',
};

export const MOCK_DESCRIPTIONS: Record<MockKey, string> = {
  new: 'First-time user, no trips created',
  planning: 'Has a draft "Tokyo Spring Trip" in progress',
  'active:upcoming': 'Bali trip booked, outbound flight in 5 days',
  'active:inflight': 'Currently on PR 535 MNL → DPS',
  'active:arrived': 'Just landed in Bali, heading to hotel',
  'active:active': 'Day 3 in Bali, exploring Seminyak',
  returning: 'Your real completed trips and stats',
};

// ── Helpers ──────────────────────────────────────────────────────────

const uuid = (n: number) => `mock-${n.toString().padStart(4, '0')}-0000-0000-000000000000`;

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

// ── Shared trip data ────────────────────────────────────────────────

const BALI_TRIP_BASE: Omit<Trip, 'id' | 'startDate' | 'endDate' | 'status'> = {
  name: 'Bali Adventure',
  destination: 'Bali, Indonesia',
  nights: 7,
  accommodation: 'Alila Seminyak',
  address: 'Jl. Taman Ganesha No.9, Seminyak, Bali',
  roomType: 'Deluxe Suite',
  checkIn: '14:00',
  checkOut: '12:00',
  hotelPhone: '+62 361 3021 888',
  bookingRef: 'BALI-2026-XK9',
  cost: 8500000,
  costCurrency: 'IDR',
  transport: 'plane',
  wifiSsid: 'Alila-Guest',
  wifiPassword: 'aloha2026',
  hotelLat: -8.6895,
  hotelLng: 115.1681,
  budgetLimit: 15000000,
  budgetMode: 'Limited',
  country: 'Indonesia',
  countryCode: 'ID',
  amenities: ['Pool', 'Spa', 'Beach Access', 'Restaurant', 'Bar'],
  hotelPhotos: JSON.stringify([
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
    'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800',
  ]),
};

const MEMBERS: GroupMember[] = [
  { id: uuid(30), name: 'Peter', role: 'Primary', profilePhoto: undefined },
  { id: uuid(31), name: 'Rina', role: 'Member', profilePhoto: undefined },
  { id: uuid(32), name: 'Marco', role: 'Member', profilePhoto: undefined },
  { id: uuid(33), name: 'Jess', role: 'Member', profilePhoto: undefined },
];

const PLACES: Place[] = [
  { id: uuid(60), name: 'Tanah Lot Temple', category: 'Culture', rating: 5, source: 'Suggested', vote: '👍 Yes', saved: true },
  { id: uuid(61), name: 'La Lucciola', category: 'Eat', rating: 4, source: 'Manual', vote: '👍 Yes', saved: true, priceEstimate: '$$' },
  { id: uuid(62), name: 'Potato Head Beach Club', category: 'Nightlife', rating: 4, source: 'Friend Rec', vote: 'Pending', saved: true },
  { id: uuid(63), name: 'Tegallalang Rice Terrace', category: 'Nature', rating: 5, source: 'Suggested', vote: 'Pending', saved: true },
];

const PACKING: PackingItem[] = [
  { id: uuid(70), item: 'Passport', category: 'Documents', packed: true },
  { id: uuid(71), item: 'Sunscreen SPF 50', category: 'Toiletries', packed: true },
  { id: uuid(72), item: 'Board shorts', category: 'Clothing', packed: true },
  { id: uuid(73), item: 'Power adapter', category: 'Tech', packed: false },
  { id: uuid(74), item: 'Reef-safe sunscreen', category: 'Toiletries', packed: false },
];

// ── Phase-specific flight timing ────────────────────────────────────

function makeFlights(phase: MockTripPhase): Flight[] {
  const base = {
    bookingRef: 'BALI-2026-XK9',
    baggage: '30kg',
    passenger: 'Peter Gumapac',
  };

  switch (phase) {
    case 'upcoming':
      // Flight departs in 5 days
      return [
        { id: uuid(20), direction: 'Outbound', flightNumber: 'PR 535', airline: 'Philippine Airlines', from: 'Manila (MNL)', to: 'Bali (DPS)', departTime: hoursFromNow(5 * 24), arriveTime: hoursFromNow(5 * 24 + 4), ...base },
        { id: uuid(21), direction: 'Return', flightNumber: 'PR 536', airline: 'Philippine Airlines', from: 'Bali (DPS)', to: 'Manila (MNL)', departTime: hoursFromNow(12 * 24), arriveTime: hoursFromNow(12 * 24 + 4), ...base },
      ];

    case 'inflight':
      // Departed 1.5 hours ago, arrives in 2.5 hours
      return [
        { id: uuid(20), direction: 'Outbound', flightNumber: 'PR 535', airline: 'Philippine Airlines', from: 'Manila (MNL)', to: 'Bali (DPS)', departTime: hoursFromNow(-1.5), arriveTime: hoursFromNow(2.5), ...base },
        { id: uuid(21), direction: 'Return', flightNumber: 'PR 536', airline: 'Philippine Airlines', from: 'Bali (DPS)', to: 'Manila (MNL)', departTime: hoursFromNow(7 * 24), arriveTime: hoursFromNow(7 * 24 + 4), ...base },
      ];

    case 'arrived':
      // Arrived 1 hour ago (within 4hr arrival window)
      return [
        { id: uuid(20), direction: 'Outbound', flightNumber: 'PR 535', airline: 'Philippine Airlines', from: 'Manila (MNL)', to: 'Bali (DPS)', departTime: hoursFromNow(-5), arriveTime: hoursFromNow(-1), ...base },
        { id: uuid(21), direction: 'Return', flightNumber: 'PR 536', airline: 'Philippine Airlines', from: 'Bali (DPS)', to: 'Manila (MNL)', departTime: hoursFromNow(7 * 24), arriveTime: hoursFromNow(7 * 24 + 4), ...base },
      ];

    case 'active':
      // Arrived 3 days ago, well past the 4hr window
      return [
        { id: uuid(20), direction: 'Outbound', flightNumber: 'PR 535', airline: 'Philippine Airlines', from: 'Manila (MNL)', to: 'Bali (DPS)', departTime: hoursFromNow(-3 * 24 - 4), arriveTime: hoursFromNow(-3 * 24), ...base },
        { id: uuid(21), direction: 'Return', flightNumber: 'PR 536', airline: 'Philippine Airlines', from: 'Bali (DPS)', to: 'Manila (MNL)', departTime: hoursFromNow(4 * 24), arriveTime: hoursFromNow(4 * 24 + 4), ...base },
      ];
  }
}

function makeTripDates(phase: MockTripPhase): { startDate: string; endDate: string } {
  switch (phase) {
    case 'upcoming':
      return { startDate: daysFromNow(5), endDate: daysFromNow(12) };
    case 'inflight':
      return { startDate: daysFromNow(0), endDate: daysFromNow(7) };
    case 'arrived':
      return { startDate: daysFromNow(0), endDate: daysFromNow(7) };
    case 'active':
      return { startDate: daysFromNow(-3), endDate: daysFromNow(4) };
  }
}

function makeExpenses(phase: MockTripPhase): Expense[] {
  if (phase === 'upcoming') return []; // no expenses yet
  if (phase === 'inflight') return [
    { id: uuid(40), description: 'Airport lounge', amount: 1200, currency: 'PHP', category: 'Food', date: daysFromNow(0), paidBy: 'Peter' },
  ];
  if (phase === 'arrived') return [
    { id: uuid(40), description: 'Airport lounge', amount: 1200, currency: 'PHP', category: 'Food', date: daysFromNow(0), paidBy: 'Peter' },
    { id: uuid(41), description: 'Grab from airport', amount: 180000, currency: 'IDR', category: 'Transport', date: daysFromNow(0), paidBy: 'Peter' },
  ];
  // active — full expense list
  return [
    { id: uuid(40), description: 'Grab from airport', amount: 180000, currency: 'IDR', category: 'Transport', date: daysFromNow(-3), paidBy: 'Peter' },
    { id: uuid(41), description: 'La Lucciola dinner', amount: 950000, currency: 'IDR', category: 'Food', date: daysFromNow(-2), paidBy: 'Marco' },
    { id: uuid(42), description: 'Surf lesson', amount: 500000, currency: 'IDR', category: 'Activity', date: daysFromNow(-2), paidBy: 'Rina' },
    { id: uuid(43), description: 'Seminyak market', amount: 320000, currency: 'IDR', category: 'Shopping', date: daysFromNow(-1), paidBy: 'Peter' },
    { id: uuid(44), description: 'Potato Head brunch', amount: 780000, currency: 'IDR', category: 'Food', date: daysFromNow(0), paidBy: 'Jess' },
  ];
}

function makeMoments(phase: MockTripPhase): Moment[] {
  if (phase === 'upcoming' || phase === 'inflight') return [];
  if (phase === 'arrived') return [
    { id: uuid(50), caption: 'We made it!', date: daysFromNow(0), location: 'Ngurah Rai Airport', tags: ['Group'], takenBy: 'Peter' },
  ];
  return [
    { id: uuid(50), caption: 'Sunset at Tanah Lot', date: daysFromNow(-2), location: 'Tanah Lot Temple', tags: ['Sunset', 'Scenery'], takenBy: 'Peter' },
    { id: uuid(51), caption: 'Beach day!', date: daysFromNow(-1), location: 'Seminyak Beach', tags: ['Beach', 'Group'], takenBy: 'Rina' },
    { id: uuid(52), caption: 'Morning surf', date: daysFromNow(0), location: 'Canggu', tags: ['Activity', 'Beach'], takenBy: 'Marco' },
  ];
}

// ── Planning trip ───────────────────────────────────────────────────

const PLANNING_TRIP: Trip = {
  id: uuid(1),
  name: 'Tokyo Spring Trip',
  destination: 'Tokyo, Japan',
  startDate: daysFromNow(21),
  endDate: daysFromNow(28),
  nights: 7,
  accommodation: 'Shinjuku Granbell Hotel',
  address: '2-14-5 Kabukicho, Shinjuku, Tokyo',
  roomType: 'Superior Double',
  checkIn: '15:00',
  checkOut: '11:00',
  hotelPhone: '+81 3-6833-1234',
  cost: 42000,
  costCurrency: 'JPY',
  transport: 'plane',
  status: 'Planning',
  hotelLat: 35.6938,
  hotelLng: 139.7034,
  budgetLimit: 150000,
  budgetMode: 'Limited',
  isDraft: true,
  country: 'Japan',
  countryCode: 'JP',
};

const PLANNING_MEMBERS: GroupMember[] = [
  { id: uuid(10), name: 'You', role: 'Primary', profilePhoto: undefined },
  { id: uuid(11), name: 'Rina', role: 'Member', profilePhoto: undefined },
];

// ── Mock: Past trip for returning ────────────────────────────────────

const PAST_TRIP: Trip = {
  id: uuid(3),
  name: 'Boracay Getaway',
  destination: 'Boracay, Philippines',
  startDate: daysFromNow(-45),
  endDate: daysFromNow(-38),
  nights: 7,
  accommodation: 'Canyon Hotels & Resorts',
  address: 'Station 1, Boracay Island',
  roomType: 'Ocean View Suite',
  status: 'Completed',
  hotelLat: 11.9710,
  hotelLng: 121.9215,
  cost: 35000,
  costCurrency: 'PHP',
  transport: 'plane',
  country: 'Philippines',
  countryCode: 'PH',
  totalSpent: 28500,
  totalNights: 7,
};

const PAST_MOMENTS: Moment[] = [
  { id: uuid(80), caption: 'White Beach sunset', date: daysFromNow(-43), location: 'White Beach', tags: ['Sunset', 'Beach'], takenBy: 'Peter' },
  { id: uuid(81), caption: 'Island hopping!', date: daysFromNow(-42), location: 'Crystal Cove', tags: ['Activity', 'Scenery'], takenBy: 'Rina' },
];

// ── Returning stats ─────────────────────────────────────────────────

const RETURNING_STATS: LifetimeStats = {
  totalTrips: 5,
  totalCountries: 3,
  totalNights: 28,
  totalMiles: 8200,
  totalSpent: 125000,
  homeCurrency: 'PHP',
  totalMoments: 47,
  countriesList: ['Philippines', 'Japan', 'Indonesia'],
  earliestTripDate: '2024-12-15',
};

// ── Export ───────────────────────────────────────────────────────────

export interface MockSegmentData {
  trip: Trip | null;
  flights: Flight[];
  members: GroupMember[];
  expenses: Expense[];
  moments: Moment[];
  places: Place[];
  packing: PackingItem[];
  pastTrips: Trip[];
  draftTrips: Trip[];
  lifetimeStats: LifetimeStats | null;
  /** The trip phase this mock represents (only set for active sub-phases) */
  tripPhase?: MockTripPhase;
}

const EMPTY: MockSegmentData = {
  trip: null,
  flights: [],
  members: [],
  expenses: [],
  moments: [],
  places: [],
  packing: [],
  pastTrips: [],
  draftTrips: [],
  lifetimeStats: null,
};

/** Parse a MockKey into segment + optional phase */
export function parseMockKey(key: MockKey): { segment: UserSegment; phase?: MockTripPhase } {
  if (key.startsWith('active:')) {
    return { segment: 'active', phase: key.split(':')[1] as MockTripPhase };
  }
  return { segment: key as UserSegment };
}

export function getMockDataForKey(key: MockKey): MockSegmentData {
  const { segment, phase } = parseMockKey(key);

  switch (segment) {
    case 'new':
      return EMPTY;

    case 'planning':
      return {
        ...EMPTY,
        draftTrips: [PLANNING_TRIP],
        members: PLANNING_MEMBERS,
      };

    case 'active': {
      const p = phase ?? 'active';
      const dates = makeTripDates(p);
      const trip: Trip = {
        ...BALI_TRIP_BASE,
        id: uuid(2),
        status: 'Active',
        ...dates,
      };
      return {
        trip,
        flights: makeFlights(p),
        members: MEMBERS,
        expenses: makeExpenses(p),
        moments: makeMoments(p),
        places: PLACES,
        packing: PACKING,
        pastTrips: [],
        draftTrips: [],
        lifetimeStats: null,
        tripPhase: p,
      };
    }

    case 'returning':
      return {
        ...EMPTY,
        pastTrips: [PAST_TRIP],
        moments: PAST_MOMENTS,
        lifetimeStats: RETURNING_STATS,
      };

    default:
      return EMPTY;
  }
}

/** @deprecated Use getMockDataForKey with MockKey instead */
export function getMockDataForSegment(segment: UserSegment): MockSegmentData {
  const key: MockKey = segment === 'active' ? 'active:active' : segment;
  return getMockDataForKey(key);
}
