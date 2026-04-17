import { Alert, Linking, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Calendar as CalendarIcon, ExternalLink, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { buildGoogleCalendarURL } from '@/lib/googleCalendarURL';
import { colors, radius, spacing } from '@/constants/theme';
import { requestCalendarPermission, syncTripToCalendar, shareCalendarInvite } from '@/lib/calendar';
import type { Flight, Trip } from '@/lib/types';
import { safeParse } from '@/lib/utils';

interface Props {
  trip: Trip;
  flights: Flight[];
  packingItems?: { item: string; packed: boolean }[];
}

export default function CalendarSync({ trip, flights, packingItems }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [openingGCal, setOpeningGCal] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const granted = await requestCalendarPermission();
      if (!granted) {
        Alert.alert('Permission denied', 'Calendar access is required to sync events.');
        return;
      }
      const count = await syncTripToCalendar(trip, flights, packingItems);
      Alert.alert('Synced!', `${count} events added to your calendar.`);
    } catch (e: any) {
      Alert.alert('Sync failed', e?.message ?? 'Unknown error');
    } finally {
      setSyncing(false);
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const events = buildShareEvents(trip, flights);
      await shareCalendarInvite(events);
    } catch (e: any) {
      Alert.alert('Share failed', e?.message ?? 'Unknown error');
    } finally {
      setSharing(false);
    }
  };

  const openInGoogleCalendar = async () => {
    setOpeningGCal(true);
    try {
      const events = buildShareEvents(trip, flights);
      if (events.length === 0) {
        Alert.alert('No events', 'No flight events to add to Google Calendar.');
        return;
      }

      const openEvent = async (index: number): Promise<void> => {
        if (index >= events.length) return;
        const event = events[index];
        const url = buildGoogleCalendarURL({
          title: event.title,
          startISO: event.startDate.toISOString(),
          endISO: event.endDate.toISOString(),
          location: event.location,
          description: event.notes,
        });

        if (index < events.length - 1) {
          Alert.alert(
            `Event ${index + 1} of ${events.length}`,
            `Opening: ${event.title}\n\nAfter adding this event, come back for the next one.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open',
                onPress: async () => {
                  await Linking.openURL(url);
                  openEvent(index + 1);
                },
              },
            ],
          );
        } else {
          Alert.alert(
            events.length > 1 ? `Event ${index + 1} of ${events.length}` : 'Open in Google Calendar',
            `Opening: ${event.title}`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open',
                onPress: () => Linking.openURL(url),
              },
            ],
          );
        }
      };

      await openEvent(0);
    } catch (e: any) {
      Alert.alert('Failed to open Google Calendar', e?.message ?? 'Unknown error');
    } finally {
      setOpeningGCal(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.btn, pressed ? { opacity: 0.8 } : null]}
        onPress={sync}
        disabled={syncing}
      >
        {syncing ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <>
            <CalendarIcon size={16} color={colors.white} />
            <Text style={styles.text}>Sync to Calendar</Text>
          </>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.shareBtn, pressed ? { opacity: 0.8 } : null]}
        onPress={share}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color={colors.green2} size="small" />
        ) : (
          <>
            <Share2 size={16} color={colors.green2} />
            <Text style={styles.shareText}>Share with Group</Text>
          </>
        )}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.shareBtn, pressed ? { opacity: 0.8 } : null]}
        onPress={openInGoogleCalendar}
        disabled={openingGCal}
      >
        {openingGCal ? (
          <ActivityIndicator color={colors.green2} size="small" />
        ) : (
          <>
            <ExternalLink size={16} color={colors.green2} />
            <Text style={styles.shareText}>Google Calendar</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

function buildShareEvents(
  trip: Trip,
  flights: Flight[],
): { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }[] {
  const events: { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }[] = [];
  const outbound = flights.find(f => f.direction === 'Outbound');
  const returnFlight = flights.find(f => f.direction === 'Return');

  if (outbound) {
    const airportArrival = new Date(safeParse(outbound.departTime).getTime() - 120 * 60000);
    events.push({
      title: `Flight to ${trip.name.split(' ')[0]} \u2014 ${outbound.flightNumber}`,
      startDate: airportArrival,
      endDate: safeParse(outbound.arriveTime),
      location: `${outbound.from} \u2192 ${outbound.to}`,
      notes: `${outbound.airline} ${outbound.flightNumber}${outbound.bookingRef ? ` \u00B7 Ref: ${outbound.bookingRef}` : ''}\nDepart: ${outbound.departTime}\nArrive: ${outbound.arriveTime}`,
    });
  }

  if (returnFlight) {
    const leaveHotel = new Date(safeParse(returnFlight.departTime).getTime() - 150 * 60000);
    events.push({
      title: `Flight Home \u2014 ${returnFlight.flightNumber}`,
      startDate: leaveHotel,
      endDate: safeParse(returnFlight.arriveTime),
      location: `${returnFlight.from} \u2192 ${returnFlight.to}`,
      notes: `${returnFlight.airline} ${returnFlight.flightNumber}${returnFlight.bookingRef ? ` \u00B7 Ref: ${returnFlight.bookingRef}` : ''}\nDepart: ${returnFlight.departTime}\nArrive: ${returnFlight.arriveTime}`,
    });
  }

  return events;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  btn: {
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  text: { color: colors.white, fontWeight: '700', fontSize: 14 },
  shareBtn: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green + '40',
  },
  shareText: { color: colors.green2, fontWeight: '700', fontSize: 14 },
});
