import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import { Wifi, Lock, LogIn, LogOut } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/theme';

type LucideIcon = typeof Wifi;

interface Tile {
  id: string;
  iconName: string;
  label: string;
  value: string;
}

interface Props {
  tiles?: Tile[];
}

const ICON_MAP: Record<string, LucideIcon> = {
  wifi: Wifi,
  door: Lock,
  checkin: LogIn,
  checkout: LogOut,
};

const DEFAULT_TILES: Tile[] = [
  { id: 'wifi', iconName: 'wifi', label: 'WiFi', value: 'Not set' },
  { id: 'door', iconName: 'door', label: 'Door Code', value: '\u2014' },
  { id: 'checkin', iconName: 'checkin', label: 'Check-in', value: '3:00 PM' },
  { id: 'checkout', iconName: 'checkout', label: 'Checkout', value: '12:00 PM' },
];

const QUICK_ACCESS_KEY = 'quickAccess_v1';

export const QuickAccessGrid: React.FC<Props> = ({ tiles: initialTiles }) => {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles ?? DEFAULT_TILES);
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
      if (!saved) setTiles(initialTiles ?? DEFAULT_TILES);
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
        {tiles.map((tile) => {
          const TileIcon = ICON_MAP[tile.id] ?? Wifi;
          return (
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
              <View style={styles.tileIconWrap}>
                <TileIcon color={colors.accent} size={22} strokeWidth={2} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>{tile.label}</Text>
              <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
                {showValue(tile)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={!!editingTile} transparent animationType="fade">
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.card}>
            <Text style={modalStyles.title}>
              {editingTile?.label}
            </Text>
            <TextInput
              style={modalStyles.input}
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
            <View style={modalStyles.actions}>
              <TouchableOpacity onPress={() => setEditingTile(null)}>
                <Text style={modalStyles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit}>
                <Text style={modalStyles.save}>Save</Text>
              </TouchableOpacity>
            </View>
            {editingTile?.id === 'door' && (
              <Text style={modalStyles.hint}>
                Long-press the tile to view the code later
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
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
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.bg2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 100,
  },
  tileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileLabel: {
    color: colors.text3,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  tileValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

const modalStyles = StyleSheet.create({
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
