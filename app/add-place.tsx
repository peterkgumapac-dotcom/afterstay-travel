import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import FormField from '@/components/FormField';
import Select from '@/components/Select';
import { colors, radius, spacing } from '@/constants/theme';
import { addPlace } from '@/lib/notion';
import type { PlaceCategory } from '@/lib/types';

const CATEGORIES: PlaceCategory[] = [
  'Eat',
  'Do',
  'Nature',
  'Essentials',
  'Nightlife',
  'Wellness',
  'Culture',
];

export default function AddPlaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>('Eat');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a name for this place.');
      return;
    }
    setSubmitting(true);
    try {
      await addPlace({
        name: name.trim(),
        category,
        distance: distance.trim() || undefined,
        notes: notes.trim() || undefined,
        source: 'Manual',
        vote: 'Pending',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="Name"
          placeholder="e.g. Sunny Side Café"
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Select<PlaceCategory>
          label="Category"
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
        />

        <FormField
          label="Distance"
          placeholder="e.g. 400m, 1.2 km"
          value={distance}
          onChangeText={setDistance}
        />

        <FormField
          label="Notes"
          placeholder="Why is this worth saving?"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed ? { opacity: 0.8 } : null]}
          onPress={save}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveText}>Save place</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  saveBtn: {
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { color: colors.text2, fontSize: 14 },
});
