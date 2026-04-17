import { ArrowRight, ChevronDown, ChevronUp, Luggage, Plane } from 'lucide-react-native';
import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { Flight } from '@/lib/types';
import { flightDuration, formatTime, formatDatePHT } from '@/lib/utils';
import Pill from './Pill';

interface Props {
  flight: Flight;
  passengers?: string[];
}

export default function FlightCard({ flight, passengers }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <Pressable onPress={toggle} style={styles.card}>
      {/* Collapsed header — always visible */}
      <View style={styles.collapsedRow}>
        <Text style={styles.collapsedEmoji}>✈️</Text>
        <Text style={styles.collapsedText} numberOfLines={1}>
          {flight.airline} · {flight.from} → {flight.to} · {formatDatePHT(flight.departTime)}
        </Text>
        <Chevron size={18} color={colors.text3 as string} />
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={styles.details}>
          <View style={styles.topRow}>
            <View style={styles.airline}>
              <View style={styles.logo}>
                <Plane size={16} color={colors.green2} />
              </View>
              <View>
                <Text style={styles.flightNum}>{flight.flightNumber}</Text>
                <Text style={styles.airlineName}>{flight.airline}</Text>
              </View>
            </View>
            <Pill
              label={flight.direction}
              tone={flight.direction === 'Outbound' ? 'blue' : 'amber'}
            />
          </View>

          <View style={styles.routeRow}>
            <View style={styles.portBlock}>
              <Text style={styles.port}>{flight.from}</Text>
              <Text style={styles.time}>{formatTime(flight.departTime)}</Text>
            </View>

            <View style={styles.arrow}>
              <View style={styles.line} />
              <ArrowRight size={16} color={colors.text3} />
            </View>

            <View style={[styles.portBlock, { alignItems: 'flex-end' }]}>
              <Text style={styles.port}>{flight.to}</Text>
              <Text style={styles.time}>{formatTime(flight.arriveTime)}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {flightDuration(flight.departTime, flight.arriveTime)}
            </Text>
            {flight.bookingRef ? (
              <Text style={styles.meta}>
                Ref <Text style={styles.mono}>{flight.bookingRef}</Text>
              </Text>
            ) : null}
          </View>

          {passengers && passengers.length > 0 ? (
            <View style={{ gap: 2 }}>
              <Text style={[styles.meta, { fontWeight: '600' }]}>Passengers:</Text>
              {passengers.map(name => (
                <Text key={name} style={styles.meta}>• {name}</Text>
              ))}
            </View>
          ) : flight.passenger ? (
            <Text style={styles.meta}>Traveler: {flight.passenger}</Text>
          ) : null}

          {flight.baggage ? (
            <View style={styles.baggageRow}>
              <Luggage size={13} color={colors.text2} />
              <Text style={styles.baggage}>{flight.baggage}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  collapsedEmoji: {
    fontSize: 14,
  },
  collapsedText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  details: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  airline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.green + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightNum: { color: colors.text, fontSize: 15, fontWeight: '700' },
  airlineName: { color: colors.text2, fontSize: 12, marginTop: 1 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  portBlock: { flex: 1, gap: 2 },
  port: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  time: { color: colors.text2, fontSize: 13 },
  arrow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  metaRow: { flexDirection: 'row', gap: spacing.lg },
  meta: { color: colors.text2, fontSize: 12 },
  mono: { fontFamily: 'SpaceMono', color: colors.text },
  baggageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  baggage: { color: colors.text2, fontSize: 12 },
});
