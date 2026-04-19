import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  Eye,
  EyeOff,
  Hash,
  Key,
  Phone,
  Plus,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { updateTripProperty } from '@/lib/supabase';
import type { Trip } from '@/lib/types';
import { mask } from '@/lib/utils';

interface CustomTile {
  label: string;
  value: string;
  icon: string;
}

interface EditableTileConfig {
  readonly label: string;
  readonly notionKey: string;
  readonly tripField: keyof Trip;
}

const EDITABLE_TILES: Record<string, EditableTileConfig> = {
  wifiSsid: { label: 'WiFi Network', notionKey: 'WiFi Network', tripField: 'wifiSsid' },
  wifiPassword: { label: 'WiFi Password', notionKey: 'WiFi Password', tripField: 'wifiPassword' },
  doorCode: { label: 'Door Code', notionKey: 'Door Code', tripField: 'doorCode' },
  checkIn: { label: 'Check-in Time', notionKey: 'Check-in Time', tripField: 'checkIn' },
  checkOut: { label: 'Check-out Time', notionKey: 'Check-out Time', tripField: 'checkOut' },
  hotelPhone: { label: 'Hotel Phone', notionKey: 'Hotel Phone', tripField: 'hotelPhone' },
  bookingRef: { label: 'Booking Ref', notionKey: 'Booking Ref', tripField: 'bookingRef' },
} as const;

interface Props {
  trip: Trip;
  onTripUpdate?: (key: string, value: string) => void;
}

export default function QuickAccess({ trip, onTripUpdate }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [revealDoor, setRevealDoor] = useState(false);
  const [editingTile, setEditingTile] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<TextInput>(null);

  const startEditing = (tileKey: string) => {
    const config = EDITABLE_TILES[tileKey];
    if (!config) return;
    const current = (trip[config.tripField] as string) ?? '';
    setEditValue(current);
    setEditingTile(tileKey);
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const saveEdit = async () => {
    if (!editingTile) return;
    const config = EDITABLE_TILES[editingTile];
    if (!config) return;
    const trimmed = editValue.trim();
    setEditingTile(null);
    setEditValue('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTripUpdate?.(config.tripField, trimmed);
    await updateTripProperty(trip.id, config.notionKey, trimmed);
  };

  const cancelEdit = () => {
    setEditingTile(null);
    setEditValue('');
  };

  const customTiles = useMemo((): CustomTile[] => {
    if (!trip.customQuickAccess) return [];
    try {
      const parsed = JSON.parse(trip.customQuickAccess);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (t: any) => t && typeof t.label === 'string' && typeof t.value === 'string'
      );
    } catch {
      return [];
    }
  }, [trip.customQuickAccess]);

  const copyToClipboard = async (label: string, value: string) => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const callHotel = () => {
    if (!trip.hotelPhone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${trip.hotelPhone.replace(/[^+\d]/g, '')}`);
  };

  const saveCustomTiles = useCallback(
    async (tiles: CustomTile[]) => {
      await updateTripProperty(
        trip.id,
        'Custom Quick Access',
        JSON.stringify(tiles)
      );
    },
    [trip.id]
  );

  const promptAddTile = () => {
    Alert.prompt('New Tile \u2014 Label', 'Enter a label (e.g. "Parking")', (label) => {
      if (!label?.trim()) return;
      Alert.prompt('New Tile \u2014 Value', `Value for "${label.trim()}"`, (value) => {
        if (!value?.trim()) return;
        Alert.prompt(
          'New Tile \u2014 Icon',
          'Enter an emoji icon (e.g. \uD83C\uDD7F\uFE0F)',
          (icon) => {
            const newTile: CustomTile = {
              label: label.trim(),
              value: value.trim(),
              icon: icon?.trim() || '\uD83D\uDCCC',
            };
            const updated = [...customTiles, newTile];
            saveCustomTiles(updated);
          },
          'plain-text',
          '\uD83D\uDCCC'
        );
      });
    });
  };

  const handleLongPressCustom = (index: number, tile: CustomTile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(tile.label, 'What would you like to do?', [
      {
        text: 'Edit',
        onPress: () => promptEditTile(index, tile),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updated = customTiles.filter((_, i) => i !== index);
          saveCustomTiles(updated);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const promptEditTile = (index: number, tile: CustomTile) => {
    Alert.prompt('Edit Label', undefined, (label) => {
      if (!label?.trim()) return;
      Alert.prompt('Edit Value', undefined, (value) => {
        if (!value?.trim()) return;
        Alert.prompt(
          'Edit Icon',
          'Enter an emoji icon',
          (icon) => {
            const updated = customTiles.map((t, i) =>
              i === index
                ? { label: label.trim(), value: value.trim(), icon: icon?.trim() || tile.icon }
                : t
            );
            saveCustomTiles(updated);
          },
          'plain-text',
          tile.icon
        );
      }, 'plain-text', tile.value);
    }, 'plain-text', tile.label);
  };

  return (
    <View style={styles.grid}>
      {/* Inline edit bar */}
      {editingTile && (
        <View style={styles.editBar}>
          <Text style={styles.editBarLabel}>
            {EDITABLE_TILES[editingTile]?.label}
          </Text>
          <TextInput
            ref={editInputRef}
            style={styles.editInput}
            value={editValue}
            onChangeText={setEditValue}
            onSubmitEditing={saveEdit}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            placeholderTextColor={colors.text3}
            placeholder="Enter value..."
          />
          <View style={styles.editActions}>
            <Pressable onPress={cancelEdit} style={styles.editBtn}>
              <Text style={styles.editBtnCancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveEdit} style={styles.editBtn}>
              <Text style={styles.editBtnSave}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Tile
        Icon={Wifi}
        label="WiFi"
        value={trip.wifiSsid || 'Not set'}
        sub={trip.wifiPassword ? `PW: ${trip.wifiPassword}` : undefined}
        onPress={() => startEditing('wifiSsid')}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert('WiFi', 'What would you like to do?', [
            {
              text: 'Edit Network Name',
              onPress: () => startEditing('wifiSsid'),
            },
            {
              text: 'Edit Password',
              onPress: () => startEditing('wifiPassword'),
            },
            ...(trip.wifiPassword
              ? [{
                  text: 'Copy Password',
                  onPress: () => copyToClipboard('WiFi password', trip.wifiPassword!),
                }]
              : []),
            { text: 'Cancel', style: 'cancel' as const },
          ]);
        }}
        colors={colors}
      />
      <Tile
        Icon={revealDoor ? Eye : EyeOff}
        label="Door Code"
        value={trip.doorCode ? (revealDoor ? trip.doorCode : mask(trip.doorCode)) : 'TBD'}
        onPress={() => startEditing('doorCode')}
        onLongPress={() => {
          if (trip.doorCode) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRevealDoor(r => !r);
          }
        }}
        mono
        colors={colors}
      />
      <Tile
        Icon={Calendar}
        label="Check-in"
        value={trip.checkIn || 'TBD'}
        onPress={() => startEditing('checkIn')}
        onLongPress={
          trip.checkIn
            ? () => copyToClipboard('Check-in', trip.checkIn!)
            : undefined
        }
        colors={colors}
      />
      <Tile
        Icon={Calendar}
        label="Check-out"
        value={trip.checkOut || 'TBD'}
        onPress={() => startEditing('checkOut')}
        onLongPress={
          trip.checkOut
            ? () => copyToClipboard('Check-out', trip.checkOut!)
            : undefined
        }
        colors={colors}
      />
      <Tile
        Icon={Phone}
        label="Hotel Phone"
        value={trip.hotelPhone || 'N/A'}
        onPress={() => startEditing('hotelPhone')}
        onLongPress={trip.hotelPhone ? callHotel : undefined}
        colors={colors}
      />
      <Tile
        Icon={Hash}
        label="Booking Ref"
        value={trip.bookingRef || 'N/A'}
        onPress={() => startEditing('bookingRef')}
        onLongPress={
          trip.bookingRef
            ? () => copyToClipboard('Booking ref', trip.bookingRef!)
            : undefined
        }
        mono
        colors={colors}
      />

      {/* Custom tiles from Notion */}
      {customTiles.map((tile, index) => (
        <EmojiTile
          key={`custom-${index}-${tile.label}`}
          emoji={tile.icon}
          label={tile.label}
          value={tile.value}
          onPress={() => copyToClipboard(tile.label, tile.value)}
          onLongPress={() => handleLongPressCustom(index, tile)}
          colors={colors}
        />
      ))}

      {/* Add tile button */}
      <Pressable
        style={({ pressed }) => [
          styles.tile,
          styles.addTile,
          pressed ? styles.tilePressed : null,
        ]}
        onPress={promptAddTile}
      >
        <Plus size={20} color={colors.green2} />
        <Text style={styles.addLabel}>Add Tile</Text>
      </Pressable>
    </View>
  );
}

function Tile({
  Icon,
  label,
  value,
  sub,
  onPress,
  onLongPress,
  mono,
  colors,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  mono?: boolean;
  colors: any;
}) {
  const styles = getStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        pressed ? styles.tilePressed : null,
      ]}
    >
      <Icon size={16} color={colors.green2} />
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, mono ? styles.mono : null]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
    </Pressable>
  );
}

function EmojiTile({
  emoji,
  label,
  value,
  onPress,
  onLongPress,
  colors,
}: {
  emoji: string;
  label: string;
  value: string;
  onPress?: () => void;
  onLongPress?: () => void;
  colors: any;
}) {
  const styles = getStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        pressed ? styles.tilePressed : null,
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    minHeight: 88,
  },
  tilePressed: {
    borderColor: colors.green,
    opacity: 0.9,
  },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderColor: colors.border2,
  },
  addLabel: {
    color: colors.green2,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  label: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  value: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sub: {
    color: colors.text2,
    fontSize: 11,
  },
  mono: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
  },
  emoji: {
    fontSize: 16,
  },
  editBar: {
    flexBasis: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  editBarLabel: {
    color: colors.text3,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  editInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  editBtnCancel: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '600',
  },
  editBtnSave: {
    color: colors.green2,
    fontSize: 13,
    fontWeight: '700',
  },
});
