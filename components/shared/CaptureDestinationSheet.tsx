import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  ChevronRight,
  FolderHeart,
  MapPin,
  Sparkles,
  X,
  Zap,
} from 'lucide-react-native';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { getAllUserTrips } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

export type CaptureDestination =
  | { type: 'quick-trip' }
  | { type: 'personal' }
  | { type: 'trip'; tripId: string; tripName: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (destination: CaptureDestination) => void;
}

export default function CaptureDestinationSheet({ visible, onClose, onSelect }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [pastTrips, setPastTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrips, setShowTrips] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowTrips(false);
    setLoading(true);
    getAllUserTrips('')
      .then((trips) => setPastTrips(trips.filter((t) => t.status === 'Completed' || t.status === 'Active')))
      .catch(() => setPastTrips([]))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleRow}><View style={styles.handle} /></View>

          <Text style={styles.title}>Where does this go?</Text>
          <Text style={styles.subtitle}>Tag your photo so it shows up in the right place</Text>

          {!showTrips ? (
            <View style={styles.options}>
              {/* Quick Trip */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() => onSelect({ type: 'quick-trip' })}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.accent + '18' }]}>
                  <Zap size={20} color={colors.accent} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Quick Trip</Text>
                  <Text style={styles.optionDesc}>Coffee, dinner, outing — a single occasion</Text>
                </View>
                <ChevronRight size={16} color={colors.text3} />
              </TouchableOpacity>

              {/* Personal Album */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() => onSelect({ type: 'personal' })}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.coral + '18' }]}>
                  <FolderHeart size={20} color={colors.coral} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Personal Album</Text>
                  <Text style={styles.optionDesc}>Save to your personal collection</Text>
                </View>
                <ChevronRight size={16} color={colors.text3} />
              </TouchableOpacity>

              {/* Add to Trip */}
              {pastTrips.length > 0 && (
                <TouchableOpacity
                  style={styles.optionRow}
                  activeOpacity={0.7}
                  onPress={() => setShowTrips(true)}
                >
                  <View style={[styles.optionIcon, { backgroundColor: colors.gold + '18' }]}>
                    <MapPin size={20} color={colors.gold} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Add to a Trip</Text>
                    <Text style={styles.optionDesc}>Upload to an existing trip's moments</Text>
                  </View>
                  <ChevronRight size={16} color={colors.text3} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.tripList}>
              <TouchableOpacity onPress={() => setShowTrips(false)} style={styles.backRow}>
                <ChevronRight size={16} color={colors.text2} style={{ transform: [{ rotate: '180deg' }] }} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text style={styles.tripListTitle}>Select a trip</Text>

              {loading ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
              ) : (
                <ScrollView style={styles.tripScroll} showsVerticalScrollIndicator={false}>
                  {pastTrips.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.tripRow}
                      activeOpacity={0.7}
                      onPress={() => onSelect({ type: 'trip', tripId: t.id, tripName: t.name })}
                    >
                      <View style={styles.tripIcon}>
                        <MapPin size={16} color={colors.accent} />
                      </View>
                      <View style={styles.tripInfo}>
                        <Text style={styles.tripName} numberOfLines={1}>{t.destination || t.name}</Text>
                        <Text style={styles.tripDates}>
                          {formatDatePHT(t.startDate)} – {formatDatePHT(t.endDate)} · {t.nights} nights
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, t.status === 'Active' && styles.activeBadge]}>
                        <Text style={[styles.statusText, t.status === 'Active' && styles.activeText]}>
                          {t.status === 'Active' ? 'Active' : 'Past'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
      maxHeight: '75%',
    },
    handleRow: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text3,
      paddingHorizontal: 20,
      marginBottom: 20,
    },

    // Options
    options: {
      paddingHorizontal: 16,
      gap: 8,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: {
      flex: 1,
      gap: 2,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    optionDesc: {
      fontSize: 12,
      color: colors.text3,
    },

    // Trip list
    tripList: {
      paddingHorizontal: 16,
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 12,
    },
    backText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text2,
    },
    tripListTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    tripScroll: {
      maxHeight: 300,
    },
    tripRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    tripIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripInfo: {
      flex: 1,
      gap: 2,
    },
    tripName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    tripDates: {
      fontSize: 11,
      color: colors.text3,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.card2,
    },
    activeBadge: {
      backgroundColor: colors.accent + '20',
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text3,
    },
    activeText: {
      color: colors.accent,
    },
  });
