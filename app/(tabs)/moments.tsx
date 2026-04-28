import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentsTab } from '@/components/moments/MomentsTab';
import { useTheme } from '@/constants/ThemeContext';
import { useUserSegment } from '@/contexts/UserSegmentContext';
import { getAllUserTrips } from '@/lib/supabase';
import { getAllTripsPromise, getAllTripsCached } from '@/hooks/useTrips';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export default function MomentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { activeTrip: segActiveTrip, pastTrips: segPastTrips, segment } = useUserSegment();
  const activeTrip = segActiveTrip ?? null;
  const [extraPastTrips, setExtraPastTrips] = useState<Trip[]>([]);
  const pastTrips = segPastTrips.length > 0 ? segPastTrips : extraPastTrips;
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(undefined);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (activeTrip) {
      setSelectedTripId(activeTrip.id);
    } else if (pastTrips.length > 0) {
      setSelectedTripId((prev) => prev ?? pastTrips[0].id);
    } else {
      // Fallback: context might still be loading — fetch independently
      const cachedAll = getAllTripsCached();
      if (cachedAll) {
        const completed = cachedAll.filter((tr) => tr.status === 'Completed');
        setExtraPastTrips(completed);
        if (completed.length > 0) setSelectedTripId(completed[0].id);
      }
      getAllTripsPromise(true).catch(() => [] as Trip[]).then((all) => {
        const completed = all.filter((tr) => tr.status === 'Completed');
        setExtraPastTrips(completed);
        if (completed.length > 0) setSelectedTripId((prev) => prev ?? completed[0].id);
      });
    }
  }, [activeTrip, pastTrips]);

  const selectedTrip = useMemo(() => {
    if (activeTrip && selectedTripId === activeTrip.id) return activeTrip;
    return pastTrips.find((t) => t.id === selectedTripId);
  }, [activeTrip, pastTrips, selectedTripId]);

  const needsPicker = activeTrip === null && pastTrips.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moments</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Trip picker — only when no active trip */}
      {needsPicker && (
        <View style={styles.pickerWrap}>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowPicker(!showPicker)}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerLabel} numberOfLines={1}>
              {selectedTrip?.destination ?? selectedTrip?.name ?? 'Select trip'}
            </Text>
            <Text style={styles.pickerDates}>
              {selectedTrip ? `${formatDatePHT(selectedTrip.startDate)} – ${formatDatePHT(selectedTrip.endDate)}` : ''}
            </Text>
            <ChevronDown size={16} color={colors.text3} />
          </TouchableOpacity>

          {showPicker && (
            <View style={styles.pickerDropdown}>
              {pastTrips.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.pickerRow, t.id === selectedTripId && styles.pickerRowActive]}
                  onPress={() => {
                    setSelectedTripId(t.id);
                    setShowPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerRowText, t.id === selectedTripId && styles.pickerRowTextActive]}>
                    {t.destination ?? t.name}
                  </Text>
                  <Text style={styles.pickerRowDates}>
                    {formatDatePHT(t.startDate)} – {formatDatePHT(t.endDate)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* No trips at all */}
      {activeTrip === null && pastTrips.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No trips yet — create a trip to start capturing moments</Text>
        </View>
      )}

      {/* Moments content */}
      {selectedTripId && <MomentsTab tripId={selectedTripId} />}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },

    // Trip picker
    pickerWrap: {
      paddingHorizontal: 16, marginBottom: 8, zIndex: 10,
    },
    pickerBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    pickerLabel: {
      flex: 1, fontSize: 14, fontWeight: '600', color: colors.text,
    },
    pickerDates: {
      fontSize: 11, color: colors.text3,
    },
    pickerDropdown: {
      marginTop: 4, backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    pickerRowActive: {
      backgroundColor: colors.accentBg,
    },
    pickerRowText: {
      fontSize: 14, fontWeight: '600', color: colors.text,
    },
    pickerRowTextActive: {
      color: colors.accent,
    },
    pickerRowDates: {
      fontSize: 11, color: colors.text3,
    },

    // Empty
    emptyWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 14, color: colors.text3, textAlign: 'center', lineHeight: 20,
    },
  });
