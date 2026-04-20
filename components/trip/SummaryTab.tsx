import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
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
  pastTrips: PastTripDisplay[];
  colors: ThemeColors;
  onAddTrip: () => void;
}

export function SummaryTab({
  totalMiles,
  totalTrips,
  countriesCount,
  totalNights,
  totalSpent,
  highlights,
  pastTrips,
  colors,
  onAddTrip,
}: SummaryTabProps) {
  const styles = getStyles(colors);

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

      {/* Past trips */}
      <GroupHeader
        kicker={`Past trips \u00B7 ${pastTrips.length}`}
        title="Where you've been"
        action={
          <TouchableOpacity>
            <Text style={styles.ghostAction}>View all</Text>
          </TouchableOpacity>
        }
        colors={colors}
      />
      <View style={styles.listContainer}>
        {pastTrips.map((t, i) => (
          <PastTripRow key={i} trip={t} />
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
