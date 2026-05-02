import type { Flight, Trip } from './types';

const AIRPORT_DESTINATION_MAP: Record<string, string> = {
  MPH: 'Boracay, Philippines',
  KLO: 'Boracay, Philippines',
  CEB: 'Cebu, Philippines',
  MNL: 'Manila, Philippines',
  PPS: 'Palawan, Philippines',
  USU: 'Coron, Palawan',
  DAD: 'Da Nang, Vietnam',
  DPS: 'Bali, Indonesia',
  BKK: 'Bangkok, Thailand',
  SIN: 'Singapore',
  TOK: 'Tokyo, Japan',
};

function clean(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function airportCode(value?: string | null) {
  const text = clean(value);
  const paren = text.match(/\(([A-Z]{3})\)/i)?.[1];
  if (paren) return paren.toUpperCase();
  const standalone = text.match(/\b[A-Z]{3}\b/i)?.[0];
  return standalone ? standalone.toUpperCase() : '';
}

function normalizePlaceLabel(value?: string | null) {
  const text = clean(value);
  if (!text) return '';

  const code = airportCode(text);
  if (code && AIRPORT_DESTINATION_MAP[code]) return AIRPORT_DESTINATION_MAP[code];

  if (/boracay|caticlan|godofredo|mp[h]?/i.test(text)) return 'Boracay, Philippines';
  if (/kalibo/i.test(text)) return 'Boracay, Philippines';
  return text;
}

function firstFlightDestination(flights: Flight[]) {
  const sorted = [...flights].sort((a, b) => {
    const at = a.departTime ? new Date(a.departTime).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.departTime ? new Date(b.departTime).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });
  const outbound = sorted.find((flight) => clean(flight.to));
  if (outbound?.to) return normalizePlaceLabel(outbound.to);
  const returned = sorted.find((flight) => clean(flight.from));
  return normalizePlaceLabel(returned?.from);
}

export function resolveTripMediaLocation(trip: Trip | null | undefined, flights: Flight[] = []) {
  if (!trip) return { query: '', label: '', source: 'none' as const };

  const destination = normalizePlaceLabel(trip.destination);
  if (destination) return { query: destination, label: destination, source: 'destination' as const };

  const accommodation = clean(trip.accommodation);
  const address = normalizePlaceLabel(trip.address);
  if (accommodation && address) {
    const query = `${accommodation}, ${address}`;
    return { query, label: address, source: 'stay' as const };
  }
  if (address) return { query: address, label: address, source: 'stay' as const };
  if (accommodation) return { query: accommodation, label: accommodation, source: 'stay' as const };

  const flightLocation = firstFlightDestination(flights);
  if (flightLocation) return { query: flightLocation, label: flightLocation, source: 'flight' as const };

  return { query: '', label: '', source: 'none' as const };
}
