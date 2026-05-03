import type { Flight } from './types';

function normalizePart(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function flightShareKey(flight: Flight): string {
  return [
    flight.direction,
    flight.flightNumber,
    flight.airline,
    flight.from,
    flight.to,
    flight.departTime,
    flight.arriveTime,
  ].map(normalizePart).join('|');
}

function hasShareableFlightDetails(flight: Flight): boolean {
  return Boolean(
    normalizePart(flight.flightNumber)
    || normalizePart(flight.from)
    || normalizePart(flight.to)
    || normalizePart(flight.departTime)
    || normalizePart(flight.arriveTime),
  );
}

function passengerBelongsToPrimary(passenger: unknown, primaryBookerName?: string | null): boolean {
  const passengerName = normalizePart(passenger);
  if (!passengerName) return true;

  const primaryName = normalizePart(primaryBookerName);
  if (!primaryName) return false;
  if (passengerName === primaryName) return true;

  const passengerTokens = passengerName.split(/\s+/).filter((part) => part.length > 1);
  const primaryTokens = primaryName.split(/\s+/).filter((part) => part.length > 1);
  return passengerTokens.some((part) => primaryTokens.includes(part));
}

export function getPrimaryBookerFlights(flights: Flight[], primaryBookerName?: string | null): Flight[] {
  const seen = new Set<string>();
  const unique: Flight[] = [];

  for (const flight of flights) {
    if (!passengerBelongsToPrimary(flight.passenger, primaryBookerName)) continue;
    if (!hasShareableFlightDetails(flight)) continue;
    const key = flightShareKey(flight);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(flight);
  }

  return unique.sort((a, b) => {
    const aTime = a.departTime ? new Date(a.departTime).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.departTime ? new Date(b.departTime).getTime() : Number.MAX_SAFE_INTEGER;
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
    if (a.direction !== b.direction) return a.direction === 'Outbound' ? -1 : 1;
    return normalizePart(a.flightNumber).localeCompare(normalizePart(b.flightNumber));
  });
}
