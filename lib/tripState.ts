import { safeParse, MS_PER_DAY } from '@/lib/utils';
import type { Trip, Flight, GroupMember } from '@/lib/types';

// ── Runtime Trip State (date-based, never trust DB status) ──

export type TripRuntimeState = 'upcoming' | 'active' | 'completed';
export type TripPhase = 'planning' | 'upcoming' | 'inflight' | 'arrived' | 'active' | 'completed';

const PHASE_RANK: Record<TripPhase, number> = {
  planning: 0,
  upcoming: 1,
  inflight: 2,
  arrived: 3,
  active: 4,
  completed: 5,
};

const ARRIVED_WINDOW_MS = 4 * 60 * 60 * 1000;

export function getTripRuntimeState(trip: Trip): TripRuntimeState {
  const now = new Date();
  const start = safeParse(trip.startDate);
  const end = safeParse(trip.endDate);
  // Add a full day buffer so the trip stays "active" through the last day
  const endPlusDay = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  if (now < start) return 'upcoming';
  if (now <= endPlusDay) return 'active';
  return 'completed';
}

function parseMs(value?: string): number {
  if (!value) return NaN;
  return safeParse(value).getTime();
}

function normalizeName(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function flightTimeMs(flight: Flight): number {
  const departMs = parseMs(flight.departTime);
  return Number.isNaN(departMs) ? Number.POSITIVE_INFINITY : departMs;
}

export function isReturnFlightDirection(value?: string): boolean {
  const direction = normalizeName(value);
  return ['return', 'inbound', 'arrival', 'arrive', 'back', 'homebound'].some((token) => direction.includes(token));
}

export function isOutboundFlightDirection(value?: string): boolean {
  const direction = normalizeName(value);
  return ['outbound', 'departure', 'depart', 'going', 'out'].some((token) => direction.includes(token));
}

export function sortFlightsByTime(flights: Flight[]): Flight[] {
  return [...flights].sort((a, b) => flightTimeMs(a) - flightTimeMs(b));
}

function routeCode(value?: string): string {
  return normalizeName(value).replace(/[^a-z0-9]/g, '');
}

function isReverseRoute(a: Flight, b: Flight): boolean {
  const aFrom = routeCode(a.from);
  const aTo = routeCode(a.to);
  const bFrom = routeCode(b.from);
  const bTo = routeCode(b.to);
  return !!(aFrom && aTo && aFrom === bTo && aTo === bFrom);
}

export function inferFlightLeg(
  flight: Flight,
  allFlights: Flight[],
): 'outbound' | 'return' {
  if (isReturnFlightDirection(flight.direction)) return 'return';

  const sorted = sortFlightsByTime(allFlights);
  const index = sorted.findIndex((item) => item.id === flight.id);
  const earlierFlights = index >= 0 ? sorted.slice(0, index) : [];
  if (earlierFlights.some((item) => isReverseRoute(item, flight))) {
    return 'return';
  }

  return 'outbound';
}

function chooseForMember(
  flights: Flight[],
  members: GroupMember[] = [],
  userId?: string,
): Flight | undefined {
  if (flights.length <= 1) return flights[0];

  const currentMember = members.find((m) => m.userId === userId);
  if (currentMember?.flightId) {
    const linked = flights.find((f) => f.id === currentMember.flightId);
    if (linked) return linked;
  }

  const currentName = normalizeName(currentMember?.name);
  if (currentName) {
    const byPassenger = flights.find((f) => normalizeName(f.passenger) === currentName);
    if (byPassenger) return byPassenger;
  }

  return flights.find((f) => !f.passenger) ?? flights[0];
}

export function selectUserOutboundFlight(
  flights: Flight[],
  members: GroupMember[] = [],
  userId?: string,
): Flight | undefined {
  const sorted = sortFlightsByTime(flights);
  const explicitOutbound = sorted.filter((f) => isOutboundFlightDirection(f.direction));
  if (explicitOutbound.length > 0) return chooseForMember(explicitOutbound, members, userId);

  const nonReturn = sorted.filter((f) => !isReturnFlightDirection(f.direction));
  return chooseForMember(nonReturn.length > 0 ? nonReturn : sorted, members, userId);
}

export function selectReturnFlight(
  flights: Flight[],
  members: GroupMember[] = [],
  userId?: string,
): Flight | undefined {
  const sorted = sortFlightsByTime(flights);
  const explicitReturns = sorted.filter((f) => isReturnFlightDirection(f.direction));
  if (explicitReturns.length > 0) return chooseForMember(explicitReturns, members, userId);

  const outbound = selectUserOutboundFlight(sorted, members, userId);
  const remaining = sorted.filter((f) => f.id !== outbound?.id);
  return chooseForMember(remaining, members, userId);
}

export interface TripDayMetrics {
  status: 'upcoming' | 'active' | 'completed';
  dayNumber: number;
  totalDays: number;
  daysLeft: number;
}

export function getTripDayMetrics(trip: Trip | null | undefined, nowMs = Date.now()): TripDayMetrics {
  const startMs = parseMs(trip?.startDate);
  const endMs = parseMs(trip?.endDate);
  const hasDates = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs;
  const totalDays = hasDates ? Math.max(1, Math.ceil((endMs - startMs) / MS_PER_DAY)) : 1;

  if (!hasDates || nowMs < startMs) {
    return { status: 'upcoming', dayNumber: 1, totalDays, daysLeft: totalDays };
  }

  if (nowMs > endMs + MS_PER_DAY) {
    return { status: 'completed', dayNumber: totalDays, totalDays, daysLeft: 0 };
  }

  const rawDay = Math.floor((nowMs - startMs) / MS_PER_DAY) + 1;
  const dayNumber = Math.min(totalDays, Math.max(1, rawDay));
  return {
    status: 'active',
    dayNumber,
    totalDays,
    daysLeft: Math.max(0, totalDays - dayNumber),
  };
}

export function computeTripPhase({
  trip,
  flights,
  members,
  userId,
  manualPhase,
  nowMs = Date.now(),
}: {
  trip: Trip;
  flights: Flight[];
  members?: GroupMember[];
  userId?: string;
  manualPhase?: TripPhase | null;
  nowMs?: number;
}): TripPhase {
  const tripEndMs = parseMs(trip.endDate);
  if (trip.status === 'Completed' || (!Number.isNaN(tripEndMs) && nowMs > tripEndMs + MS_PER_DAY)) {
    return 'completed';
  }

  const outbound = selectUserOutboundFlight(flights, members, userId);
  const departMs = parseMs(outbound?.departTime);
  const arriveMs = parseMs(outbound?.arriveTime);
  const hasValidFlightTimes = !Number.isNaN(departMs) && !Number.isNaN(arriveMs) && arriveMs >= departMs;

  let computed: TripPhase;
  if (hasValidFlightTimes) {
    if (nowMs < departMs) computed = 'upcoming';
    else if (nowMs < arriveMs) computed = 'inflight';
    else if (nowMs < arriveMs + ARRIVED_WINDOW_MS) computed = 'arrived';
    else computed = 'active';
  } else {
    const tripStartMs = parseMs(trip.startDate);
    const hasBookingData = !!(trip.accommodation || trip.address || flights.length > 0);
    const daysAway = Number.isNaN(tripStartMs) ? Number.POSITIVE_INFINITY : (tripStartMs - nowMs) / MS_PER_DAY;
    computed = (hasBookingData || daysAway <= 7) ? 'upcoming' : 'planning';
  }

  if (manualPhase && PHASE_RANK[manualPhase] > PHASE_RANK[computed] && manualPhase !== 'completed') {
    return manualPhase;
  }

  return computed;
}

// ── Date/Time Validation ──

export function isValidDateTime(value: unknown): value is string {
  if (!value || typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

// ── Trip Data Health ──

export interface TripDataHealth {
  hasAccommodation: boolean;
  hasValidFlights: boolean;
  hasAnyFlights: boolean;
  hasDocuments: boolean;
  hasMembers: boolean;
  flightIssues: FlightIssue[];
}

export interface FlightIssue {
  flightId: string;
  direction: string;
  flightNumber: string;
  issue: 'missing_times' | 'invalid_depart' | 'invalid_arrive' | 'missing_airports';
}

export function getTripDataHealth(
  trip: Trip,
  flights: Flight[],
  memberCount: number,
  fileCount?: number,
): TripDataHealth {
  const hasAccommodation = !!(
    trip.accommodation ||
    trip.address
  );

  const flightIssues: FlightIssue[] = [];
  for (const f of flights) {
    if (!f.departTime && !f.arriveTime) {
      flightIssues.push({ flightId: f.id, direction: f.direction, flightNumber: f.flightNumber, issue: 'missing_times' });
    } else {
      if (!isValidDateTime(f.departTime)) {
        flightIssues.push({ flightId: f.id, direction: f.direction, flightNumber: f.flightNumber, issue: 'invalid_depart' });
      }
      if (!isValidDateTime(f.arriveTime)) {
        flightIssues.push({ flightId: f.id, direction: f.direction, flightNumber: f.flightNumber, issue: 'invalid_arrive' });
      }
    }
    if (!f.from && !f.to) {
      flightIssues.push({ flightId: f.id, direction: f.direction, flightNumber: f.flightNumber, issue: 'missing_airports' });
    }
  }

  return {
    hasAccommodation,
    hasValidFlights: flights.length > 0 && flightIssues.length === 0,
    hasAnyFlights: flights.length > 0,
    hasDocuments: (fileCount ?? 0) > 0,
    hasMembers: memberCount > 1,
    flightIssues,
  };
}
