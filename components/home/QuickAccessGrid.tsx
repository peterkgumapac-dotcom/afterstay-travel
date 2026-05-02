import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { AnimatedPressable } from '@/components/shared/AnimatedPressable';
import { updateTripProperty } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Trip } from '@/lib/types';

interface Tile {
  id: string;
  iconName: string;
  label: string;
  value: string;
}

interface Props {
  trip?: Trip | null;
}

// Map tile IDs to trip fields and updateTripProperty keys
const TILE_TO_TRIP_KEY: Record<string, string> = {
  checkin: 'Check-in Time',
  checkout: 'Check-out Time',
  wifi: 'WiFi Network',
  door: 'Door Code',
};

function buildTilesFromTrip(trip?: Trip | null): Tile[] {
  return [
    { id: 'checkin', iconName: 'checkin', label: 'Check-in', value: trip?.checkIn || 'Not set' },
    { id: 'checkout', iconName: 'checkout', label: 'Checkout', value: trip?.checkOut || 'Not set' },
    { id: 'wifi', iconName: 'wifi', label: 'WiFi', value: trip?.wifiSsid || 'Not set' },
    { id: 'door', iconName: 'door', label: 'Door code', value: trip?.doorCode || '\u2014' },
  ];
}

function buildHints(trip?: Trip | null): Record<string, string> {
  return {
    checkin: trip?.startDate ? formatDatePHT(trip.startDate) : '',
    checkout: trip?.endDate ? formatDatePHT(trip.endDate) : '',
    wifi: trip?.wifiSsid ? '' : 'Add on arrival',
    door: trip?.doorCode ? '' : 'Add on arrival',
  };
}

export const QuickAccessGrid: React.FC<Props> = ({ trip }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const mStyles = getModalStyles(colors);
  const [tiles, setTiles] = useState<Tile[]>(() => buildTilesFromTrip(trip));
  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [draft, setDraft] = useState('');
  const hints = useMemo(() => buildHints(trip), [trip]);

  // Sync tiles when trip data changes
  React.useEffect(() => {
    setTiles(buildTilesFromTrip(trip));
  }, [trip?.checkIn, trip?.checkOut, trip?.wifiSsid, trip?.doorCode]);

  const openEdit = (tile: Tile) => {
    Haptics.selectionAsync();
    setDraft(
      tile.value === 'Not set' || tile.value === '\u2014' ? '' : tile.value,
    );
    setEditingTile(tile);
  };

  const saveEdit = async () => {
    if (!editingTile) return;
    const newValue = draft.trim() || (editingTile.id === 'door' ? '\u2014' : 'Not set');
    const next = tiles.map((t) =>
      t.id === editingTile.id ? { ...t, value: newValue } : t,
    );
    setTiles(next);
    setEditingTile(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Persist to trip in Supabase
    const tripKey = TILE_TO_TRIP_KEY[editingTile.id];
    if (tripKey && trip?.id && newValue !== 'Not set' && newValue !== '\u2014') {
      updateTripProperty(trip.id, tripKey, newValue).catch(() => {});
    }
  };

  const showValue = (t: Tile) => {
    if (t.id === 'door' && t.value && t.value !== '\u2014') return '\u2022\u2022\u2022\u2022';
    return t.value;
  };

  const isMuted = (t: Tile) =>
    t.value === 'Not set' || t.value === '\u2014';

  // If all tiles are blank, show a compact prompt
  const allBlank = tiles.every(isMuted);
  if (allBlank) {
    return (
      <View style={styles.section}>
        <View style={styles.blankCard}>
          <Text style={styles.blankTitle}>Stay details</Text>
          <Text style={styles.blankSub}>
            Check-in time, WiFi, and door code will appear here once added.
          </Text>
          <TouchableOpacity style={styles.blankBtn} onPress={() => openEdit(tiles[0])} activeOpacity={0.7}>
            <Text style={styles.blankBtnText}>Add check-in time</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <AnimatedPressable
            key={tile.id}
            style={styles.tile}
            onPress={() => openEdit(tile)}
            onLongPress={() => {
              if (tile.id === 'door') {
                Alert.alert(
                  'Door code',
                  tile.value === '\u2014' ? 'Not set' : tile.value,
                );
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`${tile.label}: ${showValue(tile)}`}
          >
            <Text style={styles.tileLabel}>{tile.label.toUpperCase()}</Text>
            <Text
              style={[
                styles.tileValue,
                isMuted(tile) && { color: colors.text3 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {showValue(tile)}
            </Text>
            <Text style={styles.tileHint}>{hints[tile.id] ?? ''}</Text>
          </AnimatedPressable>
        ))}
      </View>

      <Modal visible={!!editingTile} transparent animationType="fade">
        <View style={mStyles.backdrop}>
          <View style={mStyles.card}>
            <Text style={mStyles.title}>{editingTile?.label}</Text>
            <TextInput
              style={mStyles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                editingTile?.id === 'wifi'
                  ? 'Network name'
                  : editingTile?.id === 'door'
                    ? 'Door code (kept private)'
                    : editingTile?.id === 'checkin'
                      ? '3:00 PM'
                      : '12:00 PM'
              }
              placeholderTextColor={colors.text3}
              autoFocus
              secureTextEntry={editingTile?.id === 'door'}
            />
            <View style={mStyles.actions}>
              <TouchableOpacity onPress={() => setEditingTile(null)}>
                <Text style={mStyles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit}>
                <Text style={mStyles.save}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingTile?.id === 'door' && (
              <Text style={mStyles.hint}>
                Long-press the tile to view the code later
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    section: {
      marginHorizontal: 16,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    tile: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingTop: 14,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },
    tileLabel: {
      color: colors.text3,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.12 * 10,
      textTransform: 'uppercase',
    },
    tileValue: {
      fontFamily: 'SpaceMono',
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: 0.02 * 17,
      marginTop: 6,
    },
    tileHint: {
      color: colors.text3,
      fontSize: 10.5,
      marginTop: 2,
    },
    blankCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      alignItems: 'center',
      gap: 6,
    },
    blankTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    blankSub: {
      fontSize: 12,
      color: colors.text3,
      textAlign: 'center',
      lineHeight: 17,
    },
    blankBtn: {
      marginTop: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      backgroundColor: colors.accentBg,
    },
    blankBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
  });

const getModalStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.bg2,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 16,
    },
    input: {
      backgroundColor: colors.card,
      color: colors.text,
      fontSize: 15,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 20,
      marginTop: 16,
    },
    cancel: { color: colors.text2, fontSize: 14, fontWeight: '500' },
    save: { color: colors.accent, fontSize: 14, fontWeight: '700' },
    hint: {
      color: colors.text3,
      fontSize: 11,
      fontStyle: 'italic',
      marginTop: 8,
      textAlign: 'center',
    },
  });
