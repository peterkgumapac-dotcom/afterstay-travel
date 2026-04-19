import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import type { MomentTag } from '@/lib/types';

const ALL_TAGS: readonly MomentTag[] = [
  'Beach',
  'Food',
  'Sunset',
  'Group',
  'Activity',
  'Hotel',
  'Scenery',
  'Night',
] as const;

interface Props {
  photoUri: string;
  onSave: (data: {
    caption: string;
    location: string;
    tags: MomentTag[];
    takenBy: string;
    date: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function MomentForm({ photoUri, onSave, onCancel }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const todayStr = new Date().toISOString().slice(0, 10);

  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<MomentTag[]>([]);
  const [takenBy, setTakenBy] = useState('');
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: MomentTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ caption, location, tags, takenBy, date });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />

      <View style={styles.field}>
        <Text style={styles.label}>Caption</Text>
        <TextInput
          style={styles.input}
          value={caption}
          onChangeText={setCaption}
          placeholder="What's happening?"
          placeholderTextColor={colors.text3}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Where was this?"
          placeholderTextColor={colors.text3}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Tags</Text>
        <View style={styles.tagRow}>
          {ALL_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[
                  styles.tagPill,
                  active && styles.tagPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    active && styles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Taken By</Text>
        <TextInput
          style={styles.input}
          value={takenBy}
          onChangeText={setTakenBy}
          placeholder="Who took this?"
          placeholderTextColor={colors.text3}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text3}
        />
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveText}>Save Moment</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.bg3,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tagPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagPillActive: {
    backgroundColor: colors.green + '22',
    borderColor: colors.green2 + '40',
  },
  tagText: {
    color: colors.text2,
    fontSize: 12,
    fontWeight: '600',
  },
  tagTextActive: {
    color: colors.green2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bg3,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text2,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
} as const);
