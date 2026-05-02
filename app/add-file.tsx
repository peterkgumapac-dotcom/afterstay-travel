import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { addTripFile, uploadTripFile } from '@/lib/supabase';
import type { TripFileType } from '@/lib/types';

const FILE_TYPES: TripFileType[] = [
  'Boarding Pass',
  'Hotel Confirmation',
  'Itinerary',
  'Insurance',
  'ID/Passport',
  'Receipt',
  'Other',
];

export default function AddFileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<TripFileType>('Other');
  const [fileUrl, setFileUrl] = useState('');
  const [localUri, setLocalUri] = useState('');
  const [contentType, setContentType] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [printRequired, setPrintRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', '*/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const name = asset.name ?? 'Untitled';
        if (!fileName.trim()) setFileName(name);
        setLocalUri(asset.uri);
        setContentType(asset.mimeType);
        setFileUrl(name);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not pick file. Try again.');
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Access',
          'Please enable camera access in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          ],
        );
        return;
      }
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets[0]) {
        if (!fileName.trim()) setFileName('Photo');
        setLocalUri(result.assets[0].uri);
        setContentType('image/jpeg');
        setFileUrl('Photo');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not take photo. Try again.');
    }
  };

  const save = async () => {
    if (!fileName.trim()) return Alert.alert('File name required');
    if (!localUri && !fileUrl.trim()) return Alert.alert('No file', 'Pick a document, take a photo, or paste a URL.');

    setSubmitting(true);
    try {
      if (localUri) {
        await uploadTripFile({
          tripId,
          fileName: fileName.trim(),
          type: fileType,
          localUri,
          contentType,
          notes: notes.trim() || undefined,
          printRequired,
        });
      } else {
        await addTripFile({
          tripId,
          fileName: fileName.trim(),
          type: fileType,
          fileUrl: fileUrl.trim(),
          notes: notes.trim() || undefined,
          printRequired,
        });
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
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FormField
          label="File Name"
          placeholder="e.g. Boarding Pass"
          value={fileName}
          onChangeText={setFileName}
          autoFocus
        />

        <Select<TripFileType>
          label="Type"
          options={FILE_TYPES}
          value={fileType}
          onChange={setFileType}
        />

        <View style={styles.pickerRow}>
          <Pressable
            onPress={pickDocument}
            style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pickerBtnText}>Pick Document</Text>
          </Pressable>
          <Pressable
            onPress={takePhoto}
            style={({ pressed }) => [styles.pickerBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.pickerBtnText}>Take Photo</Text>
          </Pressable>
        </View>

        <View>
          <Text style={styles.sectionLabel}>OR PASTE URL</Text>
          <FormField
            label="URL"
            placeholder="Paste a link to the file"
            value={fileUrl}
            onChangeText={(value) => {
              setFileUrl(value);
              setLocalUri('');
              setContentType(undefined);
            }}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View>
          <Text style={styles.sectionLabel}>NOTES</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any extra details..."
            placeholderTextColor={colors.text3}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          onPress={() => setPrintRequired(prev => !prev)}
          style={({ pressed }) => [
            styles.toggleRow,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={[styles.checkbox, printRequired && styles.checkboxActive]}>
            {printRequired && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
          <Text style={styles.toggleLabel}>Print required</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={save}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveText}>Save file</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  sectionLabel: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    minHeight: 80,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  checkmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
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
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pickerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.green + '40',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnText: {
    color: colors.green2,
    fontWeight: '600',
    fontSize: 14,
  },
});
