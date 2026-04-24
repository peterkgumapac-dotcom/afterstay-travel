import type { Flight, GroupMember, Trip } from './types';

/** Format date to Google Calendar format: 20260420T070000Z */
function toGCalDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15) + 'Z';
}

/** Format date-only string to all-day event format: 20260420 */
function toGCalAllDay(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

interface CalendarInviteOpts {
  trip: Trip;
  flights?: Flight[];
  members?: GroupMember[];
  /** Which member to pre-fill as invitee (their email) */
  inviteEmail?: string;
}

/**
 * Generates a Google Calendar URL that opens the user's calendar
 * with a pre-filled trip event including alerts and guest emails.
 */
export function buildTripCalendarUrl(opts: CalendarInviteOpts): string {
  const { trip, flights = [], members = [], inviteEmail } = opts;

  const outbound = flights.find(f => f.direction === 'Outbound');
  const returnFlight = flights.find(f => f.direction === 'Return');

  // Event title
  const title = `${trip.destination || trip.name} Trip`;

  // Event dates — use flight times if available, otherwise trip dates (all-day)
  let dates: string;
  if (outbound?.departTime && returnFlight?.arriveTime) {
    dates = `${toGCalDate(outbound.departTime)}/${toGCalDate(returnFlight.arriveTime)}`;
  } else if (outbound?.departTime) {
    // Use outbound flight to end of trip
    const endDate = new Date(trip.endDate + 'T23:59:59+08:00');
    dates = `${toGCalDate(outbound.departTime)}/${toGCalDate(endDate.toISOString())}`;
  } else {
    // All-day event spanning trip dates
    const endNext = new Date(trip.endDate + 'T00:00:00+08:00');
    endNext.setDate(endNext.getDate() + 1);
    dates = `${toGCalAllDay(trip.startDate)}/${toGCalAllDay(endNext.toISOString().slice(0, 10))}`;
  }

  // Event details — flight info + hotel
  const lines: string[] = [];

  if (outbound) {
    lines.push(`✈ Outbound: ${outbound.airline || ''} ${outbound.flightNumber}`);
    lines.push(`   ${outbound.from} → ${outbound.to}`);
  }
  if (returnFlight) {
    lines.push(`✈ Return: ${returnFlight.airline || ''} ${returnFlight.flightNumber}`);
    lines.push(`   ${returnFlight.from} → ${returnFlight.to}`);
  }
  if (trip.accommodation) {
    lines.push('');
    lines.push(`🏨 ${trip.accommodation}`);
    if (trip.address) lines.push(`   ${trip.address}`);
    if (trip.checkIn) lines.push(`   Check-in: ${trip.checkIn}`);
    if (trip.checkOut) lines.push(`   Check-out: ${trip.checkOut}`);
  }
  if (trip.wifiSsid) {
    lines.push(`📶 WiFi: ${trip.wifiSsid}${trip.wifiPassword ? ` / ${trip.wifiPassword}` : ''}`);
  }

  lines.push('');
  lines.push('Shared via AfterStay');

  const details = lines.join('\n');

  // Location
  const location = trip.address || trip.accommodation || trip.destination || '';

  // Guests — collect all member emails + specific invitee
  const emails = new Set<string>();
  if (inviteEmail) emails.add(inviteEmail);
  for (const m of members) {
    if (m.email) emails.add(m.email);
  }

  // Build URL
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates,
    details,
    location,
  });

  if (emails.size > 0) {
    params.set('add', [...emails].join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

