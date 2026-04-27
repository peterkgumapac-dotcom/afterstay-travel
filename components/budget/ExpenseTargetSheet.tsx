import React, { useMemo, useState } from 'react';
import {
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
  Briefcase,
  ChevronRight,
  NotebookPen,
  Plus,
  Zap,
} from 'lucide-react-native';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';
import { CATEGORY_EMOJI, type QuickTrip } from '@/lib/quickTripTypes';
import type { ExpenseTarget } from '@/lib/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  hasActiveTrip: boolean;
  quickTrips: QuickTrip[];
  onSelectTarget: (target: ExpenseTarget) => void;
}

export default function ExpenseTargetSheet({
  visible,
  onClose,
  hasActiveTrip,
  quickTrips,
  onSelectTarget,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [showQuickTrips, setShowQuickTrips] = useState(false);

  const handleSelect = (target: ExpenseTarget) => {
    onSelectTarget(target);
    onClose();
    setShowQuickTrips(false);
  };

  const handleClose = () => {
    onClose();
    setShowQuickTrips(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleRow}><View style={styles.handle} /></View>

          <Text style={styles.title}>Log expense to...</Text>
          <Text style={styles.subtitle}>Choose where to record this expense</Text>

          {!showQuickTrips ? (
            <View style={styles.options}>
              {/* Active Trip */}
              {hasActiveTrip && (
                <TouchableOpacity
                  style={styles.optionRow}
                  activeOpacity={0.7}
                  onPress={() => handleSelect({ type: 'trip' })}
                >
                  <View style={[styles.optionIcon, { backgroundColor: colors.gold + '18' }]}>
                    <Briefcase size={20} color={colors.gold} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Active Trip</Text>
                    <Text style={styles.optionDesc}>Add to your current trip's budget</Text>
                  </View>
                  <ChevronRight size={16} color={colors.text3} />
                </TouchableOpacity>
              )}

              {/* Quick Trip */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() =>
                  quickTrips.length > 0
                    ? setShowQuickTrips(true)
                    : handleSelect({ type: 'quick-trip', quickTripId: '__new__' })
                }
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.accent + '18' }]}>
                  <Zap size={20} color={colors.accent} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Quick Trip</Text>
                  <Text style={styles.optionDesc}>
                    {quickTrips.length > 0
                      ? 'Log to an outing or create a new one'
                      : 'Create a quick trip and log the expense'}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.text3} />
              </TouchableOpacity>

              {/* Just Log It */}
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={() => handleSelect({ type: 'standalone' })}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.coral + '18' }]}>
                  <NotebookPen size={20} color={colors.coral} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Just Log It</Text>
                  <Text style={styles.optionDesc}>Personal expense — not tied to any trip</Text>
                </View>
                <ChevronRight size={16} color={colors.text3} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tripList}>
              <TouchableOpacity onPress={() => setShowQuickTrips(false)} style={styles.backRow}>
                <ChevronRight
                  size={16}
                  color={colors.text2}
                  style={{ transform: [{ rotate: '180deg' }] }}
                />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>

              <Text style={styles.tripListTitle}>Select a quick trip</Text>

              <ScrollView style={styles.tripScroll} showsVerticalScrollIndicator={false}>
                {/* New Quick Trip */}
                <TouchableOpacity
                  style={styles.tripRow}
                  activeOpacity={0.7}
                  onPress={() => handleSelect({ type: 'quick-trip', quickTripId: '__new__' })}
                >
                  <View style={[styles.tripIcon, { backgroundColor: colors.accent + '18' }]}>
                    <Plus size={16} color={colors.accent} />
                  </View>
                  <View style={styles.tripInfo}>
                    <Text style={[styles.tripName, { color: colors.accent }]}>New Quick Trip</Text>
                    <Text style={styles.tripMeta}>Create a new outing</Text>
                  </View>
                </TouchableOpacity>

                {quickTrips.map((qt) => {
                  const emoji = CATEGORY_EMOJI[qt.category] ?? '\u2728';
                  return (
                    <TouchableOpacity
                      key={qt.id}
                      style={styles.tripRow}
                      activeOpacity={0.7}
                      onPress={() => handleSelect({ type: 'quick-trip', quickTripId: qt.id })}
                    >
                      {qt.coverPhotoUrl ? (
                        <Image source={{ uri: qt.coverPhotoUrl }} style={styles.tripCover} />
                      ) : (
                        <View style={styles.tripIcon}>
                          <Text style={{ fontSize: 16 }}>{emoji}</Text>
                        </View>
                      )}
                      <View style={styles.tripInfo}>
                        <Text style={styles.tripName} numberOfLines={1}>
                          {qt.title || qt.placeName}
                        </Text>
                        <Text style={styles.tripMeta}>
                          {formatDatePHT(qt.occurredAt)}
                          {qt.totalSpendAmount > 0
                            ? ` \u00B7 ${qt.totalSpendCurrency} ${qt.totalSpendAmount.toLocaleString()}`
                            : ''}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.text3} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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

    // Quick trip list
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
    tripCover: {
      width: 36,
      height: 36,
      borderRadius: 10,
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
    tripMeta: {
      fontSize: 12,
      color: colors.text3,
    },
  });
