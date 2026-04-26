import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, CircleDot, Clock, MapPin, Plus } from 'lucide-react-native';
import ConstellationHero from '@/components/summary/ConstellationHero';
import HighlightsStrip from '@/components/summary/HighlightsStrip';
import PastTripRow from '@/components/summary/PastTripRow';
import { GroupHeader } from './GroupHeader';
import type { PastTripDisplay, ThemeColors } from './tripConstants';

interface SummaryTabProps {
  totalMiles: number;
  totalTrips: number;
  countriesCount: number;
  totalNights: number;
  totalSpent: number;
  highlights: { icon: string; label: string; sub: string; tint: string }[];
  activeTrips: PastTripDisplay[];
  incomingTrips: PastTripDisplay[];
  pastTrips: PastTripDisplay[];
  colors: ThemeColors;
  onAddTrip: () => void;
  onTripPress?: (tripId: string) => void;
}

export function SummaryTab({
  totalMiles,
  totalTrips,
  countriesCount,
  totalNights,
  totalSpent,
  highlights,
  activeTrips,
  incomingTrips,
  pastTrips,
  colors,
  onAddTrip,
  onTripPress,
}: SummaryTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <>
      <ConstellationHero
        miles={totalMiles}
        trips={totalTrips}
        countries={countriesCount}
        nights={totalNights}
        spent={totalSpent}
      />

      {/* Highlights */}
      <GroupHeader
        kicker="Highlights"
        title="Your travel story"
        colors={colors}
      />
      <HighlightsStrip highlights={highlights} />

      {/* Active Trips */}
      {activeTrips.length > 0 && (
        <>
          <GroupHeader
            kicker={`Active \u00B7 ${activeTrips.length}`}
            title="Happening now"
            colors={colors}
          />
          <View style={styles.listContainer}>
            {activeTrips.map((t, i) => (
              <View key={i} style={styles.tripCardWrapper}>
                <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1 }}>
                  <PastTripRow
                    trip={t}
                    hasMemory={t.hasMemory}
                    onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!) : undefined}
                  />
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Incoming Trips */}
      {incomingTrips.length > 0 && (
        <>
          <GroupHeader
            kicker={`Incoming \u00B7 ${incomingTrips.length}`}
            title="Coming up"
            colors={colors}
          />
          <View style={styles.listContainer}>
            {incomingTrips.map((t, i) => (
              <View key={i} style={styles.tripCardWrapper}>
                <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <PastTripRow
                    trip={t}
                    hasMemory={t.hasMemory}
                    onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!) : undefined}
                  />
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Past Trips */}
      <GroupHeader
        kicker={`Past trips \u00B7 ${pastTrips.length}`}
        title="Where you've been"
        action={
          pastTrips.length > 3 ? (
            <TouchableOpacity>
              <Text style={styles.ghostAction}>View all</Text>
            </TouchableOpacity>
          ) : undefined
        }
        colors={colors}
      />
      <View style={styles.listContainer}>
        {pastTrips.length === 0 && (
          <Text style={styles.emptyText}>No past trips yet</Text>
        )}
        {pastTrips.map((t, i) => (
          <PastTripRow
            key={i}
            trip={t}
            hasMemory={t.hasMemory}
            onPress={t.tripId && onTripPress ? () => onTripPress(t.tripId!) : undefined}
          />
        ))}

        {/* Add past trip row */}
        <TouchableOpacity
          onPress={onAddTrip}
          style={styles.addPastTripRow}
          activeOpacity={0.7}
        >
          <View style={styles.addPastTripIcon}>
            <Plus size={18} color={colors.accent} />
          </View>
          <View style={styles.addPastTripInfo}>
            <Text style={styles.addPastTripTitle}>
              Add a past trip
            </Text>
            <Text style={styles.addPastTripSub}>
              Backfill your travel history
            </Text>
          </View>
          <ChevronRight size={14} color={colors.text3} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ghostAction: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    listContainer: {
      paddingHorizontal: 16,
      gap: 8,
    },
    tripCardWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    emptyText: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      paddingVertical: 16,
    },
    addPastTripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: colors.border2,
      borderStyle: 'dashed',
      borderRadius: 14,
    },
    addPastTripIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addPastTripInfo: {
      flex: 1,
    },
    addPastTripTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    addPastTripSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
  });
