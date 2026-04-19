import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing } from '@/constants/theme';
import { FLIGHTS } from '@/lib/flightData';

interface Props {
  direction?: 'outbound' | 'return';
}

export const FlightCard: React.FC<Props> = ({ direction = 'outbound' }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const flight = direction === 'outbound' ? FLIGHTS.outbound : FLIGHTS.return;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.airlineLogo}>
          <Text style={styles.airlineCode}>
            {flight.number.split(' ')[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.airlineName}>
            {flight.airline} {'\u00B7'} {flight.number}
          </Text>
          <Text style={styles.refText}>Ref: {flight.ref}</Text>
        </View>
        <Text style={styles.dateText}>{flight.dateShort}</Text>
      </View>

      {/* Route */}
      <View style={styles.route}>
        <View style={styles.airport}>
          <Text style={styles.airportCode}>{flight.depart.code}</Text>
          <Text style={styles.timeText}>{flight.depart.time}</Text>
        </View>

        <View style={styles.routeLine}>
          <View style={styles.line} />
          <View style={styles.planeCircle}>
            <Plane size={14} color={colors.accent} />
          </View>
          <View style={styles.line} />
        </View>

        <View style={[styles.airport, { alignItems: 'flex-end' }]}>
          <Text style={styles.airportCode}>{flight.arrive.code}</Text>
          <Text style={styles.timeText}>{flight.arrive.time}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.ticketDivider}>
        <View style={styles.notchLeft} />
        <View style={styles.dashedLine} />
        <View style={styles.notchRight} />
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Duration {flight.duration} {'\u00B7'} 3 passengers {'\u00B7'} Peter +20kg bag
      </Text>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  airlineLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  airlineCode: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  airlineName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  refText: {
    color: colors.text3,
    fontSize: 11,
    marginTop: 1,
  },
  dateText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  airport: {
    alignItems: 'flex-start',
    width: 60,
  },
  airportCode: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  timeText: {
    color: colors.text2,
    fontSize: 12,
    marginTop: 2,
  },
  routeLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border2,
  },
  planeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notchLeft: {
    width: 12,
    height: 24,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.bg,
    marginLeft: -16,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  notchRight: {
    width: 12,
    height: 24,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: colors.bg,
    marginRight: -16,
  },
  footer: {
    color: colors.text3,
    fontSize: 11,
    textAlign: 'center',
  },
});
