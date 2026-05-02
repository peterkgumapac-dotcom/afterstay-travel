import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { AnimatedPressable } from '@/components/shared/AnimatedPressable';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';
import type { Flight } from '@/lib/types';

interface Props {
  flight?: Flight;
  direction?: 'outbound' | 'return';
  onAddFlight?: () => void;
}

const KNOWN_AIRPORT_HINTS = [
  { code: 'MPH', label: 'Boracay/Caticlan', patterns: [/boracay/i, /caticlan/i, /godofredo/i, /\bmph\b/i] },
  { code: 'MNL', label: 'Manila', patterns: [/manila/i, /ninoy/i, /\bmnl\b/i] },
  { code: 'CEB', label: 'Cebu', patterns: [/cebu/i, /mactan/i, /\bceb\b/i] },
  { code: 'KLO', label: 'Kalibo', patterns: [/kalibo/i, /\bklo\b/i] },
];

const cleanAirportLabel = (value?: string | null) =>
  (value ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(international|domestic|airport|terminal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildFallbackCode = (label: string) => {
  const letters = label.replace(/[^a-z]/gi, '').toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : (letters || '---');
};

const resolveAirportDisplay = (value?: string | null) => {
  const raw = (value ?? '').trim();

  if (!raw) {
    return { code: '---', label: 'Airport' };
  }

  const known = KNOWN_AIRPORT_HINTS.find(({ patterns }) => patterns.some((pattern) => pattern.test(raw)));
  if (known) {
    return known;
  }

  const explicitCode = raw.match(/\b[A-Z]{3}\b/)?.[0];
  const label = cleanAirportLabel(raw) || raw;

  return {
    code: explicitCode ?? buildFallbackCode(label),
    label,
  };
};

export const FlightCard: React.FC<Props> = ({ flight: flightProp, direction = 'outbound', onAddFlight }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const openFlight = onAddFlight ?? (() => router.push('/(tabs)/trip'));

  if (!flightProp) {
    return (
      <AnimatedPressable
        style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}
        onPress={openFlight}
      >
        <Plane size={22} color={colors.text3} strokeWidth={1.5} />
        <Text style={{ color: colors.text2, fontSize: 13, fontWeight: '500', marginTop: 8 }}>
          Add your {direction} flight
        </Text>
        <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
          Tap to add flight details
        </Text>
      </AnimatedPressable>
    );
  }

  const departure = resolveAirportDisplay(flightProp.from);
  const arrival = resolveAirportDisplay(flightProp.to);
  const depCode = departure.code;
  const arrCode = arrival.code;
  const depTime = flightProp.departTime ? formatTimePHT(flightProp.departTime) : '—';
  const arrTime = flightProp.arriveTime ? formatTimePHT(flightProp.arriveTime) : '—';
  const depCity = departure.label;
  const arrCity = arrival.label;
  const flightCode = flightProp.flightNumber ?? '';
  const ref = flightProp.bookingRef ?? '';
  const dateShort = flightProp.departTime ? formatDatePHT(flightProp.departTime) : '—';
  const airline = flightProp.airline ?? '';
  const airlineCode = (flightCode.match(/\b[A-Z0-9]{2}\b/)?.[0] ?? airline.slice(0, 2)).toUpperCase();

  return (
    <AnimatedPressable
      style={styles.card}
      onPress={openFlight}
      accessibilityLabel="Open flight details"
      haptic={false}
    >
      {/* Header: airline logo + info + on-time chip */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.airlineLogo}>
            <Text style={styles.airlineLogoText} numberOfLines={1} adjustsFontSizeToFit>{airlineCode}</Text>
          </View>
          <View style={styles.headerCopy}>
            <View style={styles.legRow}>
              <Text style={styles.legChip}>{direction === 'return' ? 'Return' : 'Outbound'}</Text>
            </View>
            <Text style={styles.airlineName} numberOfLines={1}>{airline} {'\u00B7'} {flightCode}</Text>
            <Text style={styles.refText} numberOfLines={1}>{ref ? `Ref ${ref} \u00B7 ` : ''}{dateShort}</Text>
          </View>
        </View>
        <View style={styles.onTimePill}>
          <View style={styles.onTimeDot} />
          <Text style={styles.onTimeText}>Confirmed</Text>
        </View>
      </View>

      {/* Route: dep -> plane -> arr */}
      <View style={styles.route}>
        <View style={styles.routeSide}>
          <Text style={styles.routeCode} numberOfLines={1} adjustsFontSizeToFit>{depCode}</Text>
          <Text style={styles.routeMeta} numberOfLines={2}>{depTime} {'\u00B7'} {depCity}</Text>
        </View>

        <View style={styles.routeCenter}>
          <View style={styles.routeDash} />
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M17.8 19.2L16.5 17.2 14 16l-2 3-2-3-2.5 1.2-1.3 2L2 17l1.5-2L8 13l-2-8 2 1 4 6 4-6 2-1-2 8 4.5 2L22 17z"
              stroke={colors.textDim}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <View style={styles.routeDash} />
        </View>

        <View style={styles.routeRight}>
          <Text style={styles.routeCode} numberOfLines={1} adjustsFontSizeToFit>{arrCode}</Text>
          <Text style={[styles.routeMeta, styles.routeMetaRight]} numberOfLines={2}>{arrTime} {'\u00B7'} {arrCity}</Text>
        </View>
      </View>

      {/* Ticket divider with notches */}
      <View style={styles.ticketDivider}>
        <View style={[styles.notchLeft, { backgroundColor: colors.bg }]} />
        <View style={styles.dashedLine} />
        <View style={[styles.notchRight, { backgroundColor: colors.bg }]} />
      </View>

      {/* Footer stats */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {depCode} {'\u2192'} {arrCode}
        </Text>
        <Text style={styles.footerDot}>{'\u2022'}</Text>
        <Text style={styles.footerText} numberOfLines={1}>{dateShort}</Text>
        {flightProp.baggage ? (
          <>
            <Text style={styles.footerDot}>{'\u2022'}</Text>
            <Text style={styles.footerText} numberOfLines={1}>{flightProp.baggage}</Text>
          </>
        ) : null}
      </View>
    </AnimatedPressable>
  );
};

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 16,
      marginHorizontal: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    legRow: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    legChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: colors.card2,
      color: colors.text2,
      fontSize: 9,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    airlineLogo: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.text2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    airlineLogoText: {
      color: colors.bg,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.04 * 10,
    },
    airlineName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    refText: {
      fontSize: 11,
      color: colors.text3,
    },
    onTimePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    onTimeDot: {
      width: 5,
      height: 5,
      borderRadius: 99,
      backgroundColor: colors.accent,
    },
    onTimeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.accent,
    },
    route: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    routeSide: {
      width: 76,
      minWidth: 0,
    },
    routeCode: {
      fontFamily: 'SpaceMono',
      fontSize: 22,
      fontWeight: '500',
      letterSpacing: 0,
      color: colors.text,
    },
    routeMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    routeCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    routeDash: {
      flex: 1,
      height: 1,
      backgroundColor: colors.textDim,
      opacity: 0.6,
    },
    routeRight: {
      alignItems: 'flex-end',
      width: 76,
      minWidth: 0,
    },
    routeMetaRight: {
      textAlign: 'right',
    },
    ticketDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 12,
      marginHorizontal: -4,
    },
    notchLeft: {
      width: 12,
      height: 24,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
      marginLeft: -12,
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
      marginRight: -12,
    },
    footer: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
      minWidth: 0,
    },
    footerText: {
      flexShrink: 1,
      fontSize: 11,
      color: colors.text3,
    },
    footerDot: {
      fontSize: 11,
      color: colors.text3,
    },
  });
