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
import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';
import { addGroupMember } from '@/lib/supabase';

export default function AddMemberScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name is required');
    setSubmitting(true);
    try {
      await addGroupMember({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert('Failed to add member', e?.message ?? 'Unknown error');
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
        <Text style={styles.title}>Add Member</Text>
        <Text style={styles.subtitle}>Add someone to your trip group</Text>

        <FormField
          label="Name"
          placeholder="e.g. Jane Doe"
          value={name}
          onChangeText={setName}
          autoFocus
        />
        <FormField
          label="Email (optional)"
          placeholder="jane@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <FormField
          label="Phone (optional)"
          placeholder="+63 912 345 6789"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={save}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.saveText}>Add member</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 13, color: colors.text3, marginTop: -spacing.sm },
    saveBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    saveText: { fontWeight: '700', fontSize: 15, color: colors.ink },
    cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
    cancelText: { fontSize: 14, color: colors.text2 },
  });
