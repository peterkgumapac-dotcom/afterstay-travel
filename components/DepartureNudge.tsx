import { Plane } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import type { Flight, Trip } from '@/lib/types';
import { formatTimePHT, hoursUntil, safeParse } from '@/lib/utils';

interface Props {
  trip: Trip;
  returnFlight?: Flight;
}

/** Parse a simple time string like "40 min", "1h 30m", "90" into total minutes.
 *  Returns null if unparseable. */
function parseMinutes(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const plainNum = /^(\d+)$/.exec(trimmed);
  if (plainNum) return parseInt(plainNum[1], 10);

  const hm = /^(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/i.exec(trimmed);
  if (hm) return parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0);

  const mOnly = /^(\d+)\s*m(?:in(?:ute)?s?)?$/i.exec(trimmed);
  if (mOnly) return parseInt(mOnly[1], 10);

  return null;
}

// Visible only in the last 48 hours before return flight.
export default function DepartureNudge({ trip, returnFlight }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (!returnFlight) return null;
  const hrs = hoursUntil(returnFlight.departTime);
  if (hrs < 0 || hrs > 48) return null;

  const bufferMin = parseMinutes(trip.airportArrivalBuffer) ?? 90;
  const travelMin = parseMinutes(trip.airportToHotelTime) ?? 40;

  const depart = safeParse(returnFlight.departTime);
  const atAirport = new Date(depart.getTime() - bufferMin * 60000);
  const leaveByDate = new Date(atAirport.getTime() - travelMin * 60000);

  const departStr = formatTimePHT(returnFlight.departTime);
  const leaveBy = formatTimePHT(leaveByDate.toISOString());
  const arriveAirportBy = formatTimePHT(atAirport.toISOString());

  return (
    <View style={styles.card}>
      <View style={staticStyles.row}>
        <Plane size={18} color={colors.amber} />
        <Text style={styles.title}>Departure approaching</Text>
      </View>
      <Text style={styles.body}>
        Your flight <Text style={styles.bold}>{returnFlight.flightNumber}</Text> departs{' '}
        <Text style={styles.bold}>{departStr}</Text>.
      </Text>
      <Text style={styles.body}>
        Checkout {trip.checkOut || '11:00 AM (TBD)'}. Travel ~{travelMin} min + {bufferMin} min airport buffer.
      </Text>
      <View style={styles.leaveBy}>
        <Text style={styles.leaveByLabel}>LEAVE BY</Text>
        <Text style={styles.leaveByValue}>{leaveBy}</Text>
        <Text style={styles.leaveBySub}>Arrive airport by {arriveAirportBy}</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.amber + '14',
    borderWidth: 1,
    borderColor: colors.amber + '50',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  title: { color: colors.amber, fontWeight: '700', fontSize: 14 },
  body: { color: colors.text, fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700', color: colors.white },
  leaveBy: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.amber + '30',
  },
  leaveByLabel: { color: colors.amber, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  leaveByValue: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 2 },
  leaveBySub: { color: colors.text2, fontSize: 12, marginTop: 2 },
});

const staticStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
