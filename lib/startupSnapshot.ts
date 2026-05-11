import { cacheGetForUser, cacheSetForUser } from '@/lib/cache';
import type { Flight, Trip, UserSegment } from '@/lib/types';

const STARTUP_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

interface StartupProfileIdentity {
  fullName?: string | null;
  avatarUrl?: string | null;
}

interface StartupFlightSummary {
  id: string;
  direction: Flight['direction'];
  flightNumber: string;
  airline: string;
  from: string;
  to: string;
  departTime: string;
  arriveTime: string;
}

interface StartupTripCounts {
  active: number;
  past: number;
  draft: number;
  upcoming: number;
  quick: number;
}

interface StartupSnapshot {
  activeTrip: Trip | null;
  segment: UserSegment;
  profileIdentity: StartupProfileIdentity | null;
  firstFlight: StartupFlightSummary | null;
  recentTripCounts: StartupTripCounts;
  timestamp: string;
}

function startupSnapshotKey(userId: string): string {
  return `startup:snapshot:v1:${userId}`;
}

export async function getStartupSnapshot(userId: string): Promise<StartupSnapshot | undefined> {
  return cacheGetForUser<StartupSnapshot>(startupSnapshotKey(userId), userId, STARTUP_SNAPSHOT_TTL_MS);
}

export async function setStartupSnapshot(userId: string, snapshot: StartupSnapshot): Promise<void> {
  await cacheSetForUser(startupSnapshotKey(userId), snapshot, userId);
}

export function summarizeFirstFlight(flights: Flight[] | null | undefined): StartupFlightSummary | null {
  const flight = flights?.[0];
  if (!flight) return null;
  return {
    id: flight.id,
    direction: flight.direction,
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    from: flight.from,
    to: flight.to,
    departTime: flight.departTime,
    arriveTime: flight.arriveTime,
  };
}
