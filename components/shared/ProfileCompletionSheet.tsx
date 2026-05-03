import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AtSign, CheckCircle, XCircle } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius } from '@/constants/theme';
import { isHandleAvailable, updateProfile } from '@/lib/supabase';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const HANDLE_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      }, (error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

interface Props {
  visible: boolean;
  userId: string;
  displayName: string;
  onComplete: () => void;
}

export function ProfileCompletionSheet({ visible, userId, displayName, onComplete }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [handle, setHandle] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const checkSeq = useRef(0);

  const suggestedHandle = useMemo(() => {
    const base = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 15);
    return base.length >= 3 ? base : '';
  }, [displayName]);

  const validateAndCheck = useCallback(async (value: string) => {
    const seq = ++checkSeq.current;
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setHandle(cleaned);
    setError('');
    setAvailable(null);
    setChecking(false);

    if (cleaned.length < 3) return;
    if (!HANDLE_REGEX.test(cleaned)) {
      setError('Letters, numbers, underscores only. Start with a letter.');
      return;
    }

    setChecking(true);
    try {
      const ok = await withTimeout(
        isHandleAvailable(cleaned, userId),
        8_000,
        'Handle check took too long. Try again.',
      );
      if (seq === checkSeq.current) setAvailable(ok);
    } catch (e: unknown) {
      if (seq === checkSeq.current) {
        setAvailable(null);
        setError(e instanceof Error ? e.message : 'Could not check handle. Try again.');
      }
    } finally {
      if (seq === checkSeq.current) setChecking(false);
    }
  }, [userId]);

  const handleSave = useCallback(async () => {
    if (!handle || !HANDLE_REGEX.test(handle) || !available) return;
    setSaving(true);
    setError('');
    try {
      await withTimeout(
        updateProfile(userId, { fullName: displayName, handle }),
        12_000,
        'Saving your handle took too long. Please try again.',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [handle, available, userId, displayName, onComplete]);

  const canSave = handle.length >= 3 && HANDLE_REGEX.test(handle) && available === true && !saving;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[s.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.content}>
          {/* Header */}
          <View style={s.iconWrap}>
            <AtSign size={28} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text style={s.title}>Choose your handle</Text>
          <Text style={s.subtitle}>
            This is how other travelers will find you on AfterStay. You can change it later in settings.
          </Text>

          {/* Input */}
          <View style={s.inputWrap}>
            <Text style={s.atPrefix}>@</Text>
            <TextInput
              style={s.input}
              value={handle}
              onChangeText={validateAndCheck}
              placeholder={suggestedHandle || 'yourhandle'}
              placeholderTextColor={colors.text3}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
            />
            {checking && <ActivityIndicator size="small" color={colors.text3} />}
            {!checking && available === true && handle.length >= 3 && (
              <CheckCircle size={18} color={colors.success} strokeWidth={2} />
            )}
            {!checking && available === false && (
              <XCircle size={18} color={colors.danger} strokeWidth={2} />
            )}
          </View>

          {/* Status */}
          {available === true && handle.length >= 3 && (
            <Text style={s.statusGood}>@{handle} is available</Text>
          )}
          {available === false && (
            <Text style={s.statusBad}>@{handle} is already taken</Text>
          )}
          {error ? <Text style={s.statusBad}>{error}</Text> : null}

          {/* Suggestion */}
          {suggestedHandle && handle.length === 0 && (
            <TouchableOpacity
              style={s.suggestionBtn}
              onPress={() => validateAndCheck(suggestedHandle)}
              activeOpacity={0.7}
            >
              <Text style={s.suggestionText}>Use @{suggestedHandle}</Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />

          {/* Save */}
          <TouchableOpacity
            style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.7}
          >
            <Text style={[s.saveBtnText, !canSave && { opacity: 0.5 }]}>
              {saving ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: c.accentBg, borderWidth: 1, borderColor: c.accentBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: c.text3, lineHeight: 20, marginBottom: 28 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  atPrefix: { fontSize: 18, fontWeight: '600', color: c.text3 },
  input: { flex: 1, fontSize: 18, fontWeight: '600', color: c.text, marginLeft: 2, padding: 0 },
  statusGood: { fontSize: 12, fontWeight: '600', color: c.success, marginTop: 8 },
  statusBad: { fontSize: 12, fontWeight: '600', color: c.danger, marginTop: 8 },
  suggestionBtn: {
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: c.accentBg, borderRadius: 10, borderWidth: 1, borderColor: c.accentBorder,
    alignSelf: 'flex-start',
  },
  suggestionText: { fontSize: 13, fontWeight: '600', color: c.accent },
  saveBtn: {
    backgroundColor: c.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
