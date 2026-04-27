import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import FormField from '@/components/FormField';
import Select from '@/components/Select';
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { getPlaceLocation, placeAutocomplete } from '@/lib/google-places';
import { addExpense, getGroupMembers, notifyExpenseAdded, updateExpense } from '@/lib/supabase';
import { addQuickTripExpense } from '@/lib/quickTrips';
import { useAuth } from '@/lib/auth';
import type { Expense } from '@/lib/types';

const CATEGORY_EMOJI: Record<Expense['category'], string> = {
  Food: '🍽',
  Transport: '🚗',
  Activity: '🎯',
  Accommodation: '🏨',
  Shopping: '🛍',
  Other: '📦',
};

const CATEGORIES: Expense['category'][] = [
  'Food',
  'Transport',
  'Activity',
  'Accommodation',
  'Shopping',
  'Other',
];

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY'] as const;

const SPLIT_TYPES: NonNullable<Expense['splitType']>[] = ['Equal', 'Custom', 'Individual'];

export default function AddExpenseScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    editId?: string;
    target?: 'trip' | 'quick-trip' | 'standalone';
    quickTripId?: string;
    description?: string;
    amount?: string;
    currency?: string;
    category?: string;
    placeName?: string;
    notes?: string;
    photoUri?: string;
    date?: string;
    paidBy?: string;
    splitType?: string;
  }>();

  const isEditing = !!params.editId;

  const [description, setDescription] = useState(params.description ?? '');
  const [amount, setAmount] = useState(params.amount ?? '');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>(
    (CURRENCIES as readonly string[]).includes(params.currency ?? '') ? (params.currency as any) : 'PHP'
  );
  const [category, setCategory] = useState<Expense['category']>(
    CATEGORIES.includes(params.category as any) ? (params.category as Expense['category']) : 'Food'
  );
  const [paidBy, setPaidBy] = useState<string>(params.paidBy ?? '');
  const [placeName, setPlaceName] = useState(params.placeName ?? '');
  const [placeLatitude, setPlaceLatitude] = useState<number | undefined>();
  const [placeLongitude, setPlaceLongitude] = useState<number | undefined>();
  const [placeSuggestions, setPlaceSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [splitType, setSplitType] = useState<NonNullable<Expense['splitType']>>(
    SPLIT_TYPES.includes(params.splitType as any) ? (params.splitType as NonNullable<Expense['splitType']>) : 'Equal'
  );
  const [notes, setNotes] = useState(params.notes ?? '');
  const [photoUri, setPhotoUri] = useState(params.photoUri ?? '');
  const [expenseDate] = useState(params.date ?? new Date().toISOString().slice(0, 10));
  const [members, setMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getGroupMembers()
      .then(ms => {
        const names = ms.map(m => m.name);
        setMembers(names);
        if (!paidBy && names[0]) setPaidBy(names[0]);
      })
      .catch(() => {});
  }, []);

  const pickPhoto = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Photo Library Access',
          'Please enable photo library access in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          ],
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission required', 'Please allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const scanReceipt = () => {
    router.push('/scan-receipt');
  };

  const attachPhoto = () => {
    Alert.alert('Attach Photo', 'Choose a source', [
      { text: 'Scan Receipt (AI)', onPress: scanReceipt },
      { text: 'Camera', onPress: takePhoto },
      { text: 'Photo Library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    const n = Number(amount);
    if (!description.trim()) return Alert.alert('Description required');
    if (!Number.isFinite(n) || n <= 0) return Alert.alert('Amount must be a positive number');

    setSubmitting(true);
    try {
      const expenseData = {
        description: description.trim(),
        amount: n,
        currency,
        category,
        date: expenseDate,
        paidBy: paidBy || undefined,
        placeName: placeName.trim() || undefined,
        placeLatitude: placeLatitude ?? undefined,
        placeLongitude: placeLongitude ?? undefined,
        splitType,
        notes: notes.trim() || undefined,
        photo: photoUri || undefined,
      };
      if (isEditing) {
        await updateExpense(params.editId!, expenseData);
      } else if (params.target === 'quick-trip' && params.quickTripId) {
        await addQuickTripExpense({
          quickTripId: params.quickTripId,
          amount: n,
          currency,
          description: description.trim(),
          occurredAt: expenseDate,
          receiptPhotoUrl: photoUri || undefined,
        });
      } else if (params.target === 'standalone') {
        await addExpense({ ...expenseData, standalone: true });
      } else {
        await addExpense(expenseData);
        // Notify group members about new expense (best-effort, non-blocking)
        if (user?.id && members.length >= 2) {
          notifyExpenseAdded(
            '', // empty tripId resolves from cache inside the function
            { description: description.trim(), amount: parseFloat(amount), paidBy, currency },
            user.id,
          ).catch(() => {});
        }
      }
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
      style={[styles.safe, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="Description"
          placeholder="e.g. Dinner at D'Talipapa"
          value={description}
          onChangeText={setDescription}
          autoFocus
        />
        <FormField
          label="Amount"
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Select
          label="Currency"
          options={CURRENCIES}
          value={currency}
          onChange={setCurrency}
        />

        {/* Category — pill buttons with emojis */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.text3 }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {CATEGORIES.map(cat => {
              const active = cat === category;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={({ pressed }) => [
                    styles.catPill,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    active ? { backgroundColor: colors.green + '22', borderColor: colors.green } : null,
                    pressed ? { opacity: 0.7 } : null,
                  ]}
                >
                  <Text style={styles.catEmoji}>{CATEGORY_EMOJI[cat]}</Text>
                  <Text style={[styles.catText, { color: colors.text2 }, active ? { color: colors.green2 } : null]}>{cat}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {members.length > 0 && params.target !== 'standalone' && params.target !== 'quick-trip' ? (
          <Select
            label="Paid by"
            options={members}
            value={paidBy}
            onChange={setPaidBy}
          />
        ) : null}

        <View>
          <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs }}>Place Name</Text>
          <TextInput
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: 14 }}
            value={placeName}
            onChangeText={(text) => {
              setPlaceName(text);
              if (placeTimer.current) clearTimeout(placeTimer.current);
              if (!text.trim()) { setPlaceSuggestions([]); return; }
              placeTimer.current = setTimeout(async () => {
                const results = await placeAutocomplete(text);
                setPlaceSuggestions(results.slice(0, 4));
              }, 300);
            }}
            placeholder="e.g. Jollibee, SM Mall"
            placeholderTextColor={colors.text3}
          />
          {placeSuggestions.length > 0 && (
            <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, marginTop: 4 }}>
              {placeSuggestions.map((s) => (
                <Pressable
                  key={s.placeId}
                  style={{ paddingVertical: 10, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={async () => {
                    setPlaceName(s.description.split(',')[0]);
                    setPlaceSuggestions([]);
                    const loc = await getPlaceLocation(s.placeId);
                    if (loc) {
                      setPlaceLatitude(loc.lat);
                      setPlaceLongitude(loc.lng);
                    }
                  }}
                >
                  <Text style={{ fontSize: 13, color: colors.text }} numberOfLines={1}>{s.description}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {params.target !== 'standalone' && params.target !== 'quick-trip' && (
          <Select<NonNullable<Expense['splitType']>>
            label="Split Type"
            options={SPLIT_TYPES}
            value={splitType}
            onChange={setSplitType}
          />
        )}

        <View>
          <Text style={[styles.sectionLabel, { color: colors.text3 }]}>NOTES</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Any extra details..."
            placeholderTextColor={colors.text3}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Attach Photo */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.text3 }]}>RECEIPT PHOTO</Text>
          {photoUri ? (
            <View style={styles.photoPreviewRow}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Pressable
                  onPress={attachPhoto}
                  style={({ pressed }) => [styles.photoBtn, pressed ? { opacity: 0.7 } : null]}
                >
                  <Camera size={16} color={colors.green2} />
                  <Text style={[styles.photoBtnText, { color: colors.green2 }]}>Change Photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPhotoUri('')}
                  style={({ pressed }) => [styles.photoBtn, pressed ? { opacity: 0.7 } : null]}
                >
                  <Text style={[styles.photoBtnText, { color: colors.red }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={attachPhoto}
              style={({ pressed }) => [styles.attachBtn, { borderColor: colors.green + '40' }, pressed ? { opacity: 0.7 } : null]}
            >
              <Camera size={18} color={colors.green2} />
              <Text style={[styles.attachBtnText, { color: colors.green2 }]}>Attach Photo</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.green }, pressed ? { opacity: 0.8 } : null]}
          onPress={save}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.saveText, { color: colors.white }]}>{isEditing ? 'Update expense' : 'Save expense'}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.text2 }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  catRow: { gap: spacing.sm },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 13, fontWeight: '600' },
  notesInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    minHeight: 80,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveText: { fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontSize: 14 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  attachBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreviewRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
