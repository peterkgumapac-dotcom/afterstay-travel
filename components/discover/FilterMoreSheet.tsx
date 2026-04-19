import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
  Switch, ScrollView, Dimensions,
} from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Filters } from '../../lib/filters';
import { useTheme } from '@/constants/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  filters: Filters;
  onUpdate: (next: Partial<Filters>) => void;
  onReset: () => void;
  onClose: () => void;
}

export const FilterMoreSheet: React.FC<Props> = ({
  visible, filters, onUpdate, onReset, onClose,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onReset(); }}>
              <View style={styles.resetBtn}>
                <RotateCcw color={colors.text2} size={14} />
                <Text style={styles.resetText}>Reset</Text>
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {/* Minimum rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Minimum rating</Text>
              <View style={styles.optionRow}>
                {[0, 3.5, 4.0, 4.5].map(val => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.option,
                      filters.minRating === val && styles.optionActive,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onUpdate({ minRating: val });
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      filters.minRating === val && styles.optionTextActive,
                    ]}>
                      {val === 0 ? 'Any' : `${val}+`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Max price */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price level</Text>
              <View style={styles.optionRow}>
                {([null, 1, 2, 3, 4] as const).map(val => (
                  <TouchableOpacity
                    key={String(val)}
                    style={[
                      styles.option,
                      filters.maxPrice === val && styles.optionActive,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onUpdate({ maxPrice: val });
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      filters.maxPrice === val && styles.optionTextActive,
                    ]}>
                      {val === null ? 'Any' : '\u20B1'.repeat(val) + ' or less'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Open now */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Open now only</Text>
                  <Text style={styles.sectionHint}>
                    Hide places that are currently closed
                  </Text>
                </View>
                <Switch
                  value={filters.openNow}
                  onValueChange={(v) => {
                    Haptics.selectionAsync();
                    onUpdate({ openNow: v });
                  }}
                  trackColor={{ false: colors.border2, true: colors.accent }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.applyBtn} onPress={onClose}>
            <Text style={styles.applyBtnText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.canvas,
    height: SCREEN_H * 0.7,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: colors.border2,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  resetText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHint: {
    color: colors.text3,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 0,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border2,
  },
  optionActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  optionText: {
    color: colors.text2,
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  applyBtn: {
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
});
