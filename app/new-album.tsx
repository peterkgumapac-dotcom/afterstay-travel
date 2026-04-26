import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { getGroupMembers, createAlbum } from '@/lib/supabase';
import type { GroupMember, AlbumMemberRole } from '@/lib/types';

const PEOPLE_COLORS = ['#a64d1e', '#b8892b', '#c66a36', '#7f3712', '#9a7d52'];

type MemberState = 'in' | 'out' | 'surprise';

export default function NewAlbumScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const s = useMemo(() => getStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberStates, setMemberStates] = useState<Record<string, MemberState>>({});
  const [hideFromMosaic, setHideFromMosaic] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getGroupMembers().then((m) => {
      setMembers(m);
      // Default: all members are "in" except current user (who is always owner)
      const states: Record<string, MemberState> = {};
      m.forEach((member) => {
        if (member.userId === user?.id) states[member.userId!] = 'in';
        else if (member.userId) states[member.userId] = 'in';
      });
      setMemberStates(states);
    }).catch(() => {});
  }, [user]);

  const hasSurprise = Object.values(memberStates).some((s) => s === 'surprise');

  const toggleMember = useCallback((userId: string) => {
    setMemberStates((prev) => ({
      ...prev,
      [userId]: prev[userId] === 'in' ? 'out' : 'in',
    }));
  }, []);

  const toggleSurprise = useCallback((userId: string) => {
    setMemberStates((prev) => ({
      ...prev,
      [userId]: prev[userId] === 'surprise' ? 'out' : 'surprise',
    }));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your album a name.');
      return;
    }
    setCreating(true);
    try {
      const albumMembers: { userId: string; role: AlbumMemberRole }[] = [];
      Object.entries(memberStates).forEach(([userId, state]) => {
        if (userId === user?.id) return; // Owner added automatically
        if (state === 'in') albumMembers.push({ userId, role: 'contributor' });
        else if (state === 'surprise') albumMembers.push({ userId, role: 'surprise' });
      });

      await createAlbum({
        name: name.trim(),
        members: albumMembers,
        hideFromMosaic,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Could not create album. Try again.');
    } finally {
      setCreating(false);
    }
  }, [name, memberStates, hideFromMosaic, user, router]);

  const otherMembers = members.filter((m) => m.userId && m.userId !== user?.id);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Top bar */}
        <View style={s.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={[s.cancelText, { color: colors.text2 }]}>Cancel</Text>
          </Pressable>
          <Text style={[s.topTitle, { color: colors.text }]}>New album</Text>
          <Pressable onPress={handleCreate} disabled={creating}>
            <Text style={[s.createText, { color: colors.accent, opacity: creating ? 0.5 : 1 }]}>Create</Text>
          </Pressable>
        </View>

        {/* Album title */}
        <View style={s.field}>
          <Text style={[s.label, { color: colors.text3 }]}>Album title</Text>
          <View style={[s.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[s.titleInput, { color: colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Aaron's birthday"
              placeholderTextColor={colors.text3}
              autoFocus
            />
          </View>
        </View>

        {/* Contributors */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <Text style={[s.label, { color: colors.text3 }]}>Contributors</Text>
            <Text style={[s.labelSub, { color: colors.text3 }]}>Can add + view</Text>
          </View>
          <View style={{ gap: 6 }}>
            {/* Current user (owner, always in) */}
            <View style={[s.memberRow, { borderColor: colors.accent, backgroundColor: colors.accentBg }]}>
              <View style={[s.memberAvatar, { backgroundColor: PEOPLE_COLORS[0] }]}>
                <Text style={s.memberAvatarText}>{user?.user_metadata?.name?.charAt(0)?.toUpperCase() || 'Y'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.memberName, { color: colors.text }]}>You (owner)</Text>
                <Text style={[s.memberSub, { color: colors.text3 }]}>Can edit album</Text>
              </View>
              <View style={[s.checkCircle, { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                <Check size={10} color={colors.onBlack} strokeWidth={3} />
              </View>
            </View>

            {/* Other members */}
            {otherMembers.map((m, i) => {
              const state = memberStates[m.userId!] ?? 'out';
              const isIn = state === 'in';
              const isSurprise = state === 'surprise';
              return (
                <View
                  key={m.userId}
                  style={[
                    s.memberRow,
                    {
                      borderColor: isIn ? colors.accent : isSurprise ? colors.warn : colors.border,
                      backgroundColor: isSurprise ? 'rgba(217,164,65,0.08)' : isIn ? colors.accentBg : colors.card,
                    },
                  ]}
                >
                  <View style={[s.memberAvatar, { backgroundColor: PEOPLE_COLORS[(i + 1) % PEOPLE_COLORS.length], opacity: isSurprise ? 0.7 : 1 }]}>
                    <Text style={s.memberAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.memberName, { color: colors.text }]}>{m.name}</Text>
                    {isSurprise && (
                      <Text style={[s.memberSub, { color: '#8e5f14' }]}>Surprise recipient</Text>
                    )}
                    {isIn && (
                      <Text style={[s.memberSub, { color: colors.text3 }]}>Can see + add photos</Text>
                    )}
                    {!isIn && !isSurprise && (
                      <Text style={[s.memberSub, { color: colors.text3 }]}>Not in this album</Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => toggleMember(m.userId!)}
                    style={[
                      s.actionPill,
                      isIn ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border2 },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isIn ? colors.onBlack : colors.text2 }}>
                      {isIn ? '+ In' : 'Add'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSurprise(m.userId!)}
                    style={[
                      s.actionPill,
                      isSurprise ? { backgroundColor: '#d9a441', borderColor: '#d9a441' } : { borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isSurprise ? '#fff' : colors.text3 }}>
                      Surprise
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* Toggles */}
        <View style={s.field}>
          <View style={[s.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleTitle, { color: colors.text }]}>Hide from main mosaic</Text>
              <Text style={[s.toggleSub, { color: colors.text3 }]}>Photos here won't appear in the shared feed.</Text>
            </View>
            <Switch
              value={hideFromMosaic}
              onValueChange={setHideFromMosaic}
              trackColor={{ false: colors.border2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={[s.toggleRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: hasSurprise ? 1 : 0.5 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleTitle, { color: colors.text }]}>
                {autoReveal ? 'Reveal to surprise recipients' : 'Reveal date'}
              </Text>
              <Text style={[s.toggleSub, { color: colors.text3 }]}>
                {hasSurprise ? 'Hidden until you choose to reveal.' : 'Mark someone as a surprise to enable.'}
              </Text>
            </View>
            <Switch
              value={autoReveal}
              onValueChange={setAutoReveal}
              disabled={!hasSurprise}
              trackColor={{ false: colors.border2, true: colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 100, gap: 24 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
    },
    cancelText: { fontSize: 13, fontWeight: '500' },
    topTitle: { fontSize: 14, fontWeight: '600' },
    createText: { fontSize: 13, fontWeight: '600' },
    field: { gap: 8 },
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    labelSub: { fontSize: 11, fontWeight: '500' },
    inputBox: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: 14,
    },
    titleInput: {
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderWidth: 1.5,
      borderRadius: 14,
    },
    memberAvatar: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberAvatarText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    memberName: { fontSize: 14, fontWeight: '600' },
    memberSub: { fontSize: 11, marginTop: 2 },
    checkCircle: {
      width: 20,
      height: 20,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderRadius: 14,
    },
    toggleTitle: { fontSize: 13.5, fontWeight: '600' },
    toggleSub: { fontSize: 11, marginTop: 2 },
  });
