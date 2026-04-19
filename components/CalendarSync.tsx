import { Alert, Linking, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Calendar as CalendarIcon, ExternalLink, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { buildGoogleCalendarURL } from '@/lib/googleCalendarURL';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { requestCalendarPermission, syncTripToCalendar, shareCalendarInvite } from '@/lib/calendar';
import type { Flight, GroupMember, Trip } from '@/lib/types';
import { safeParse } from '@/lib/utils';

interface Props {
  trip: Trip;
  flights: Flight[];
  packingItems?: { item: string; packed: boolean }[];
  members?: GroupMember[];
}

export default function CalendarSync({ trip, flights, packingItems, members = [] }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
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
      // Collect attendee emails from non-primary members
      const attendeeEmails = members
        .filter(m => m.role !== 'Primary' && m.email)
        .map(m => m.email!);

      const outbound = flights.find(f => f.direction === 'Outbound');
      const returnFlight = flights.find(f => f.direction === 'Return');

      const gcalEvents = [
        ...(outbound ? [{
          title: `\u2708\uFE0F Flight to ${trip.name.split(' ')[0]} \u2014 ${outbound.flightNumber}`,
          description: `${outbound.airline} ${outbound.flightNumber}\nRef: ${outbound.bookingRef || 'N/A'}\nDepart: ${outbound.from}\nArrive: ${outbound.to}\n\nArrive at airport 2 hours before departure.`,
          location: `${outbound.from} Airport`,
          startISO: outbound.departTime,
          endISO: outbound.arriveTime,
          attendeeEmails,
        }] : []),
        {
          title: `\uD83C\uDFE8 Check-in ${trip.accommodation || 'Hotel'}`,
          description: `${trip.accommodation || 'Hotel'}\nCheck-in 3:00 PM`,
          location: trip.accommodation || 'Hotel',
          startISO: `${trip.startDate}T15:00:00+08:00`,
          endISO: `${trip.startDate}T16:00:00+08:00`,
          attendeeEmails,
        },
        {
          title: `\uD83C\uDFE8 Check-out ${trip.accommodation || 'Hotel'}`,
          description: 'Check out by 12:00 PM.',
          location: trip.accommodation || 'Hotel',
          startISO: `${trip.endDate}T11:00:00+08:00`,
          endISO: `${trip.endDate}T12:00:00+08:00`,
          attendeeEmails,
        },
        ...(returnFlight ? [{
          title: `\u2708\uFE0F Flight Home \u2014 ${returnFlight.flightNumber}`,
          description: `${returnFlight.airline} ${returnFlight.flightNumber}\nRef: ${returnFlight.bookingRef || 'N/A'}\nDepart: ${returnFlight.from}\nArrive: ${returnFlight.to}`,
          location: `${returnFlight.from} Airport`,
          startISO: returnFlight.departTime,
          endISO: returnFlight.arriveTime,
          attendeeEmails,
        }] : []),
      ];

      if (gcalEvents.length === 0) {
        Alert.alert('No events', 'No events to add.');
        return;
      }

      const attendeeNames = members
        .filter(m => m.role !== 'Primary' && m.email)
        .map(m => m.name.split(' ')[0]);

      const openEvent = (index: number) => {
        if (index >= gcalEvents.length) {
          Alert.alert('Done!', `All ${gcalEvents.length} events sent.`);
          return;
        }
        const ev = gcalEvents[index];
        const url = buildGoogleCalendarURL(ev);

        Alert.alert(
          `Event ${index + 1} of ${gcalEvents.length}`,
          `${ev.title}${attendeeNames.length > 0 ? `\n\nGuests: ${attendeeNames.join(', ')}` : ''}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: index < gcalEvents.length - 1 ? 'Open' : 'Open (last)',
              onPress: () => {
                Linking.openURL(url).then(() => {
                  if (index + 1 < gcalEvents.length) {
                    setTimeout(() => openEvent(index + 1), 1500);
                  }
                });
              },
            },
          ],
        );
      };

      openEvent(0);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Unknown error');
    } finally {
      setOpeningGCal(false);
    }
  };

  return (
    <View style={staticStyles.container}>
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

const getStyles = (colors: any) => StyleSheet.create({
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

const staticStyles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
