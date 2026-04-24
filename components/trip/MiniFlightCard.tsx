import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import type { FlightDisplayData, ThemeColors } from './tripConstants';

interface MiniFlightCardProps {
  f: FlightDisplayData;
  colors: ThemeColors;
}

function getTerminalInfo(airline: string, iata: string): string | null {
  const a = airline.toLowerCase();
  if (iata === 'MNL') {
    if (a.includes('cebu pacific')) return 'Terminal 3 (NAIA)';
    if (a.includes('airasia')) return 'Terminal 3 (NAIA)';
    if (a.includes('philippine airlines') || a.includes('pal')) return 'Terminal 2 (NAIA)';
  }
  if (iata === 'MPH') return 'Godofredo P. Ramos Airport';
  return null;
}

export function MiniFlightCard({ f, colors }: MiniFlightCardProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const depTerminal = getTerminalInfo(f.airline, f.from);
  const arrTerminal = getTerminalInfo(f.airline, f.to);

  const copyRef = () => {
    Clipboard.setStringAsync(f.ref);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', `Booking ref ${f.ref} copied to clipboard`);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.logo, { backgroundColor: f.logo }]}>
            <Text style={styles.logoText}>{f.code}</Text>
          </View>
          <View>
            <Text style={styles.dirLabel}>{f.dir}</Text>
            <Text style={styles.flightInfo}>
              {f.airline} · {f.code} {f.num}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={copyRef} activeOpacity={0.7}>
          <Text style={styles.refText}>Ref {f.ref} {'\u2398'}</Text>
        </TouchableOpacity>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View>
          <Text style={styles.iataCode}>{f.from}</Text>
          <Text style={styles.timeText}>{f.dep}</Text>
          {depTerminal && <Text style={styles.terminalText}>{depTerminal}</Text>}
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.durText}>{f.dur}</Text>
          <Text style={[styles.terminalText, { marginTop: 2 }]}>{f.date}</Text>
        </View>
        <View style={styles.routeRight}>
          <Text style={styles.iataCode}>{f.to}</Text>
          <Text style={styles.timeText}>{f.arr}</Text>
          {arrTerminal && <Text style={styles.terminalText}>{arrTerminal}</Text>}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      padding: 14,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: colors.ink,
      fontSize: 9,
      fontWeight: '600',
    },
    dirLabel: {
      fontSize: 10,
      color: colors.text3,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    flightInfo: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
      marginTop: 1,
    },
    refText: {
      fontSize: 10,
      color: colors.text3,
      letterSpacing: 0.2,
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iataCode: {
      fontSize: 18,
      fontWeight: '500',
      color: colors.text,
      letterSpacing: -0.54,
    },
    timeText: {
      fontSize: 10,
      color: colors.text3,
      marginTop: 1,
    },
    durText: {
      fontSize: 9,
      color: colors.text3,
    },
    routeRight: {
      alignItems: 'flex-end',
    },
    terminalText: {
      fontSize: 9,
      color: colors.accent,
      marginTop: 2,
      fontWeight: '500',
    },
  });
