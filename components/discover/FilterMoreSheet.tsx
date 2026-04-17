import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Pressable,
  Switch, ScrollView, Dimensions,
} from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Filters } from '../../lib/filters';

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
                <RotateCcw color="#8b95a5" size={14} />
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
                  trackColor={{ false: '#2a3040', true: '#2dd4a0' }}
                  thumbColor="#fff"
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0a0d12',
    height: SCREEN_H * 0.7,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: '#2a3040',
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
    color: '#fff',
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
    backgroundColor: '#1a1f27',
  },
  resetText: {
    color: '#8b95a5',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f27',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionHint: {
    color: '#5a6577',
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
    backgroundColor: '#1a1f27',
    borderWidth: 1,
    borderColor: '#2a3040',
  },
  optionActive: {
    backgroundColor: 'rgba(45,212,160,0.12)',
    borderColor: '#2dd4a0',
  },
  optionText: {
    color: '#8b95a5',
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#2dd4a0',
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
    backgroundColor: '#2dd4a0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});
