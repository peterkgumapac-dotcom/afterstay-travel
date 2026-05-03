import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check, Download, FileText, Pencil, Trash2, X } from 'lucide-react-native';
import type { TripFile } from '@/lib/types';
import { GroupHeader } from './GroupHeader';
import type { ThemeColors } from './tripConstants';
import { FILE_COLORS } from './tripConstants';

interface PackingGroupState {
  [category: string]: { t: string; by: string; d: boolean; id: string }[];
}

interface EssentialsTabProps {
  packingState: PackingGroupState;
  packingStats: { total: number; done: number };
  files: TripFile[];
  colors: ThemeColors;
  addingItem: boolean;
  newItemText: string;
  editingItemId: string | null;
  editingItemText: string;
  onToggleItem: (itemId: string) => void;
  onStartEditItem: (itemId: string, itemText: string) => void;
  onSetEditingItemText: (text: string) => void;
  onSaveEditingItem: () => void;
  onCancelEditingItem: () => void;
  onDeleteItem: (itemId: string, itemText: string) => void;
  onSetAddingItem: (v: boolean) => void;
  onSetNewItemText: (t: string) => void;
  onAddItem: () => void;
  onUpload: () => void;
  onDownload: (url: string) => void;
  onFilePress?: (file: TripFile) => void;
}

export function EssentialsTab({
  packingState,
  packingStats,
  files,
  colors,
  addingItem,
  newItemText,
  editingItemId,
  editingItemText,
  onToggleItem,
  onStartEditItem,
  onSetEditingItemText,
  onSaveEditingItem,
  onCancelEditingItem,
  onDeleteItem,
  onSetAddingItem,
  onSetNewItemText,
  onAddItem,
  onUpload,
  onDownload,
  onFilePress,
}: EssentialsTabProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);

  const renderPackingActions = (itemId: string, itemText: string) => (
    <Animated.View entering={FadeIn.duration(150)} style={styles.packingActions}>
      <Pressable
        style={[styles.actionCircle, { backgroundColor: colors.accent }]}
        onPress={() => onStartEditItem(itemId, itemText)}
        accessibilityLabel={`Edit ${itemText}`}
      >
        <Pencil size={15} color={colors.bg} strokeWidth={2.5} />
      </Pressable>
      <Pressable
        style={[styles.actionCircle, { backgroundColor: colors.danger }]}
        onPress={() => onDeleteItem(itemId, itemText)}
        accessibilityLabel={`Delete ${itemText}`}
      >
        <Trash2 size={15} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );

  return (
    <>
      <View style={styles.packingHeader}>
        <Text style={styles.packingCount}>
          <Text style={styles.packingCountAccent}>
            {packingStats.done}
          </Text>{' '}
          of {packingStats.total} packed
        </Text>
        <TouchableOpacity style={styles.addItemBtn} onPress={() => onSetAddingItem(true)}>
          <Text style={styles.addItemBtnText}>+ Add item</Text>
        </TouchableOpacity>
      </View>

      {addingItem && (
        <View style={styles.addItemRow}>
          <TextInput
            style={styles.addItemInput}
            value={newItemText}
            onChangeText={onSetNewItemText}
            placeholder="Item name"
            placeholderTextColor={colors.text3}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onAddItem}
            onBlur={() => {
              if (!newItemText.trim()) {
                onSetAddingItem(false);
              }
            }}
          />
        </View>
      )}

      {Object.entries(packingState).map(([group, items]) => (
        <View key={group}>
          <GroupHeader
            kicker={group}
            title={`${items.filter((i) => i.d).length} / ${items.length} ready`}
            colors={colors}
          />
          <View style={styles.packingList}>
            {items.map((it) => (
              <Swipeable
                key={it.id}
                renderRightActions={() => renderPackingActions(it.id, it.t)}
                overshootRight={false}
                friction={2}
                rightThreshold={36}
                onSwipeableOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                {editingItemId === it.id ? (
                  <View style={styles.editItemRow}>
                    <TextInput
                      style={styles.editItemInput}
                      value={editingItemText}
                      onChangeText={onSetEditingItemText}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={onSaveEditingItem}
                      placeholder="Item name"
                      placeholderTextColor={colors.text3}
                    />
                    <Pressable style={styles.editIconBtn} onPress={onCancelEditingItem} accessibilityLabel="Cancel edit">
                      <X size={16} color={colors.text3} strokeWidth={2.4} />
                    </Pressable>
                    <Pressable style={[styles.editSaveBtn, { backgroundColor: colors.accent }]} onPress={onSaveEditingItem}>
                      <Check size={16} color={colors.bg} strokeWidth={2.6} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => onToggleItem(it.id)}
                    style={[
                      styles.packingRow,
                      { opacity: it.d ? 0.7 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        it.d && styles.checkboxChecked,
                      ]}
                    >
                      {it.d && (
                        <Check size={12} color={colors.onBlack} strokeWidth={3} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.packingItemText,
                        it.d && styles.packingItemDone,
                      ]}
                    >
                      {it.t}
                    </Text>
                    <View style={styles.packingByChip}>
                      <Text style={styles.packingByText}>{it.by}</Text>
                    </View>
                  </Pressable>
                  )}
              </Swipeable>
            ))}
          </View>
        </View>
      ))}

      {/* Files section */}
      <View style={styles.filesHeader}>
        <Text style={styles.filesCount}>
          {files.length} file{files.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={onUpload}>
          <Text style={styles.uploadBtnText}>+ Upload</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filesList}>
        {files.map((f, idx) => {
          const iconColor = FILE_COLORS[idx % FILE_COLORS.length];
          return (
            <TouchableOpacity
              key={f.id}
              style={styles.fileRow}
              activeOpacity={0.7}
              onPress={() => onFilePress?.(f)}
            >
              <View
                style={[
                  styles.fileIcon,
                  {
                    backgroundColor: iconColor + '20',
                    borderColor: iconColor + '40',
                  },
                ]}
              >
                <FileText size={18} color={iconColor} />
              </View>
              <View style={styles.fileInfo}>
                <Text
                  style={styles.fileName}
                  numberOfLines={1}
                >
                  {f.fileName}
                </Text>
                <Text style={styles.fileMeta}>
                  {f.type}{f.notes ? ` \u00B7 ${f.notes}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.downloadBtn}
                accessibilityLabel={`Download ${f.fileName}`}
                onPress={(e) => {
                  e.stopPropagation();
                  if (f.fileUrl) onDownload(f.fileUrl);
                }}
              >
                <Download size={14} color={colors.text} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    packingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    packingCount: {
      fontSize: 12,
      color: colors.text3,
    },
    packingCountAccent: {
      color: colors.accent,
      fontWeight: '600',
    },
    addItemBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    addItemBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    addItemRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    addItemInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    packingList: {
      paddingHorizontal: 16,
      gap: 6,
    },
    packingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    packingItemText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    packingItemDone: {
      textDecorationLine: 'line-through',
    },
    packingByChip: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      backgroundColor: colors.card2,
      borderRadius: 99,
    },
    packingByText: {
      fontSize: 10,
      color: colors.text3,
      fontWeight: '600',
    },
    packingActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
    },
    actionCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: 12,
    },
    editItemInput: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 10,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    editIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card2,
    },
    editSaveBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    filesCount: {
      fontSize: 12,
      color: colors.text3,
    },
    uploadBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    uploadBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },
    filesList: {
      paddingHorizontal: 16,
      gap: 8,
    },
    fileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    fileIcon: {
      width: 40,
      height: 44,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileInfo: {
      flex: 1,
      minWidth: 0,
    },
    fileName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    fileMeta: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },
    downloadBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
