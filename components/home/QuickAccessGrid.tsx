import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';

interface Tile {
  id: string;
  iconName: string;
  label: string;
  value: string;
}

interface Props {
  tiles?: Tile[];
}

const DEFAULT_TILES: Tile[] = [
  { id: 'checkin', iconName: 'checkin', label: 'CHECK-IN', value: '3:00 PM' },
  { id: 'checkout', iconName: 'checkout', label: 'CHECKOUT', value: '12:00 PM' },
  { id: 'wifi', iconName: 'wifi', label: 'WIFI', value: 'Not set' },
  { id: 'door', iconName: 'door', label: 'DOOR CODE', value: '\u2014' },
];

const HINT_MAP: Record<string, string> = {
  checkin: 'Early check-in available',
  checkout: 'Late checkout on request',
  wifi: 'Ask front desk for password',
  door: 'Long-press to reveal',
};

const QUICK_ACCESS_KEY = 'quickAccess_v1';

export const QuickAccessGrid: React.FC<Props> = ({ tiles: initialTiles }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const mStyles = getModalStyles(colors);
  const [tiles, setTiles] = useState<Tile[]>(() => {
    if (!initialTiles) return DEFAULT_TILES;
    // Reorder to match 2x2: checkin, checkout, wifi, door
    const order = ['checkin', 'checkout', 'wifi', 'door'];
    return order.map(id => initialTiles.find(t => t.id === id) ?? DEFAULT_TILES.find(t => t.id === id)!);
  });
  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(QUICK_ACCESS_KEY).then(saved => {
      if (saved) {
        try { setTiles(JSON.parse(saved)); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    AsyncStorage.getItem(QUICK_ACCESS_KEY).then(saved => {
      if (!saved && initialTiles) {
        const order = ['checkin', 'checkout', 'wifi', 'door'];
        setTiles(order.map(id => initialTiles.find(t => t.id === id) ?? DEFAULT_TILES.find(t => t.id === id)!));
      }
    });
  }, [initialTiles, loaded]);

  const save = async (next: Tile[]) => {
    await AsyncStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(next));
    setTiles(next);
  };

  const openEdit = (tile: Tile) => {
    Haptics.selectionAsync();
    setDraft(tile.value === 'Not set' || tile.value === '\u2014' ? '' : tile.value);
    setEditingTile(tile);
  };

  const saveEdit = async () => {
    if (!editingTile) return;
    const next = tiles.map((t) =>
      t.id === editingTile.id
        ? { ...t, value: draft.trim() || (editingTile.id === 'door' ? '\u2014' : 'Not set') }
        : t
    );
    await save(next);
    setEditingTile(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const showValue = (t: Tile) => {
    if (t.id === 'door' && t.value && t.value !== '\u2014') return '\u2022\u2022\u2022\u2022';
    return t.value;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.header}>Quick Access</Text>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <TouchableOpacity
            key={tile.id}
            style={styles.tile}
            onPress={() => openEdit(tile)}
            onLongPress={() => {
              if (tile.id === 'door') {
                Alert.alert('Door code', tile.value === '\u2014' ? 'Not set' : tile.value);
                Haptics.selectionAsync();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
              {showValue(tile)}
            </Text>
            <Text style={styles.tileHint}>{HINT_MAP[tile.id] ?? ''}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={!!editingTile} transparent animationType="fade">
        <View style={mStyles.backdrop}>
          <View style={mStyles.card}>
            <Text style={mStyles.title}>
              {editingTile?.label}
            </Text>
            <TextInput
              style={mStyles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                editingTile?.id === 'wifi' ? 'Network name' :
                editingTile?.id === 'door' ? 'Door code (kept private)' :
                editingTile?.id === 'checkin' ? '3:00 PM' :
                '12:00 PM'
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

const getStyles = (colors: any) => StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  header: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '48.5%',
    backgroundColor: colors.bg2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 90,
  },
  tileLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tileValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  tileHint: {
    color: colors.text3,
    fontSize: 10,
    marginTop: 4,
  },
});

const getModalStyles = (colors: any) => StyleSheet.create({
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
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16 },
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
