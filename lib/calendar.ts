import * as Calendar from 'expo-calendar';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { safeParse } from '@/lib/utils';

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function getDefaultCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (Platform.OS === 'ios') {
    const defaultCal = await Calendar.getDefaultCalendarAsync();
    return defaultCal?.id ?? calendars[0]?.id ?? null;
  }
  // Android
  const primary = calendars.find(c => c.isPrimary);
  return primary?.id ?? calendars[0]?.id ?? null;
}

export async function syncTripToCalendar(
  trip: { name: string; startDate: string; endDate: string; accommodation: string },
  flights: { direction: string; flightNumber: string; airline: string; from: string; to: string; departTime: string; arriveTime: string; bookingRef?: string }[],
  packingItems?: { item: string; packed: boolean }[],
): Promise<number> {
  const calId = await getDefaultCalendarId();
  if (!calId) throw new Error('No calendar found');

  let count = 0;
  const outbound = flights.find(f => f.direction === 'Outbound');
  const returnFlight = flights.find(f => f.direction === 'Return');

  // Event 1: Day before departure — Packing reminder
  if (outbound) {
    const departDate = safeParse(outbound.departTime);
    const dayBefore = new Date(departDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(20, 0, 0, 0);
    const dayBeforeEnd = new Date(dayBefore);
    dayBeforeEnd.setHours(21, 0, 0, 0);

    const packingList = packingItems
      ? packingItems.map(i => `${i.packed ? '\u2705' : '\u2B1C'} ${i.item}`).join('\n')
      : '';

    await Calendar.createEventAsync(calId, {
      title: `\uD83D\uDCCB Pack for ${trip.name} \u2014 Trip Tomorrow!`,
      startDate: dayBefore,
      endDate: dayBeforeEnd,
      notes: `Flight ${outbound.flightNumber} departs ${formatEventTime(outbound.departTime)} tomorrow from ${outbound.from}.\nBe at airport by ${formatEventTime(new Date(safeParse(outbound.departTime).getTime() - 120 * 60000).toISOString())}.\n\nPacking list:\n${packingList}\n\nDon't forget: passport, boarding pass, charger\nCabin limit: 7kg per person`,
      alarms: [{ relativeOffset: -60 }],
      timeZone: 'Asia/Manila',
    });
    count++;
  }

  // Event 2: Departure day — Outbound flight
  if (outbound) {
    const airportArrival = new Date(safeParse(outbound.departTime).getTime() - 120 * 60000);
    await Calendar.createEventAsync(calId, {
      title: `\u2708\uFE0F Flight to ${trip.name.split(' ')[0]} \u2014 ${outbound.flightNumber}`,
      startDate: airportArrival,
      endDate: safeParse(outbound.arriveTime),
      location: `${outbound.from} \u2192 ${outbound.to}`,
      notes: `${outbound.airline} ${outbound.flightNumber}${outbound.bookingRef ? ` \u00B7 Ref: ${outbound.bookingRef}` : ''}\nDepart: ${formatEventTime(outbound.departTime)} \u00B7 Arrive: ${formatEventTime(outbound.arriveTime)}\nAfter landing: boat ~20min + trike ~10min to ${trip.accommodation}`,
      alarms: [{ relativeOffset: -120 }],
      timeZone: 'Asia/Manila',
    });
    count++;
  }

  // Event 3: Day before return — Checkout prep
  if (returnFlight) {
    const returnDate = safeParse(returnFlight.departTime);
    const dayBeforeReturn = new Date(returnDate);
    dayBeforeReturn.setDate(dayBeforeReturn.getDate() - 1);
    dayBeforeReturn.setHours(18, 0, 0, 0);
    const dayBeforeReturnEnd = new Date(dayBeforeReturn);
    dayBeforeReturnEnd.setHours(19, 0, 0, 0);

    await Calendar.createEventAsync(calId, {
      title: '\uD83D\uDCCB Last Night \u2014 Pack & Buy Pasalubong!',
      startDate: dayBeforeReturn,
      endDate: dayBeforeReturnEnd,
      notes: `Flight ${returnFlight.flightNumber} departs ${formatEventTime(returnFlight.departTime)} tomorrow.\nLeave hotel by ${formatEventTime(new Date(safeParse(returnFlight.departTime).getTime() - 150 * 60000).toISOString())}.\nCheckout: 12:00 PM (noon)\n\n\uD83C\uDF81 Buy pasalubong for loved ones!\nComplete checkout checklist tonight.${returnFlight.bookingRef ? `\nRef: ${returnFlight.bookingRef}` : ''}`,
      alarms: [{ relativeOffset: -60 }],
      timeZone: 'Asia/Manila',
    });
    count++;
  }

  // Event 4: Return day — Flight home
  if (returnFlight) {
    const leaveHotel = new Date(safeParse(returnFlight.departTime).getTime() - 150 * 60000);
    await Calendar.createEventAsync(calId, {
      title: `\u2708\uFE0F Flight Home \u2014 ${returnFlight.flightNumber}`,
      startDate: leaveHotel,
      endDate: safeParse(returnFlight.arriveTime),
      location: `${trip.accommodation} \u2192 ${returnFlight.from} \u2192 ${returnFlight.to}`,
      notes: `${returnFlight.airline} ${returnFlight.flightNumber}${returnFlight.bookingRef ? ` \u00B7 Ref: ${returnFlight.bookingRef}` : ''}\nLeave hotel: ${formatEventTime(leaveHotel.toISOString())}\nDepart: ${formatEventTime(returnFlight.departTime)} \u00B7 Arrive: ${formatEventTime(returnFlight.arriveTime)}`,
      alarms: [{ relativeOffset: -480 }, { relativeOffset: -60 }],
      timeZone: 'Asia/Manila',
    });
    count++;
  }

  return count;
}

function formatEventTime(iso: string): string {
  // Device-timezone-safe PHT formatting — same as lib/utils formatTime
  const d = safeParse(iso);
  const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  let h = pht.getUTCHours();
  const m = pht.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Generate .ics file content for sharing with group members
export function generateICS(events: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AfterStay//Trip//EN'];
  for (const ev of events) {
    const dtStart = formatICSDate(ev.startDate);
    const dtEnd = formatICSDate(ev.endDate);
    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeICS(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${escapeICS(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeICS(ev.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export async function shareCalendarInvite(
  events: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }[],
): Promise<void> {
  const ics = generateICS(events);
  const path = `${cacheDirectory}trip-events.ics`;
  await writeAsStringAsync(path, ics);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/calendar', UTI: 'com.apple.ical.ics' });
  }
}
