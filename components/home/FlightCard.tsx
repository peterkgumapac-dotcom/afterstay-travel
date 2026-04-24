import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT, formatTimePHT } from '@/lib/utils';
import type { Flight } from '@/lib/types';

interface Props {
  flight?: Flight;
  direction?: 'outbound' | 'return';
}

export const FlightCard: React.FC<Props> = ({ flight: flightProp, direction = 'outbound' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (!flightProp) {
    return (
      <View style={styles.card}>
        <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
          No {direction} flight data available
        </Text>
      </View>
    );
  }

  const depCode = flightProp.from;
  const arrCode = flightProp.to;
  const depTime = formatTimePHT(flightProp.departTime);
  const arrTime = formatTimePHT(flightProp.arriveTime);
  const depCity = flightProp.from;
  const arrCity = flightProp.to;
  const flightCode = flightProp.flightNumber;
  const ref = flightProp.bookingRef ?? '';
  const dateShort = formatDatePHT(flightProp.departTime);
  const airline = flightProp.airline ?? '';
  const airlineCode = flightCode.split(' ')[0] ?? '';

  return (
    <View style={styles.card}>
      {/* Header: airline logo + info + on-time chip */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.airlineLogo}>
            <Text style={styles.airlineLogoText}>{airlineCode}</Text>
          </View>
          <View>
            <Text style={styles.airlineName}>{airline} {'\u00B7'} {flightCode}</Text>
            <Text style={styles.refText}>{ref ? `Ref ${ref} \u00B7 ` : ''}{dateShort}</Text>
          </View>
        </View>
        <View style={styles.onTimePill}>
          <View style={styles.onTimeDot} />
          <Text style={styles.onTimeText}>Confirmed</Text>
        </View>
      </View>

      {/* Route: dep -> plane -> arr */}
      <View style={styles.route}>
        <View>
          <Text style={styles.routeCode}>{depCode}</Text>
          <Text style={styles.routeMeta}>{depTime} {'\u00B7'} {depCity}</Text>
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
          <Text style={styles.routeCode}>{arrCode}</Text>
          <Text style={styles.routeMeta}>{arrTime} {'\u00B7'} {arrCity}</Text>
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
        <Text style={styles.footerText}>{dateShort}</Text>
        {flightProp.baggage ? (
          <>
            <Text style={styles.footerDot}>{'\u2022'}</Text>
            <Text style={styles.footerText}>{flightProp.baggage}</Text>
          </>
        ) : null}
      </View>
    </View>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
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
    routeCode: {
      fontFamily: 'SpaceMono',
      fontSize: 22,
      fontWeight: '500',
      letterSpacing: -0.8,
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
    },
    footerText: {
      fontSize: 11,
      color: colors.text3,
    },
    footerDot: {
      fontSize: 11,
      color: colors.text3,
    },
  });
