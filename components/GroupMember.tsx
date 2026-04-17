import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { GroupMember } from '@/lib/types';
import { updateMemberEmail } from '@/lib/notion';
import Pill from './Pill';

interface Props {
  member: GroupMember;
  onPhotoUpdate?: (id: string, uri: string) => void;
  onEmailUpdate?: (id: string, email: string) => void;
}

const AVATAR_COLORS = [
  '#e74c3c', '#8e44ad', '#2980b9', '#16a085',
  '#d35400', '#c0392b', '#2c3e50', '#7f8c8d',
  '#27ae60', '#f39c12',
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function avatarColor(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

export default function GroupMemberCard({ member, onPhotoUpdate, onEmailUpdate }: Props) {
  const firstLetter = member.name.charAt(0).toUpperCase();
  const bgColor = avatarColor(member.name);
  const hasPhoto = Boolean(member.profilePhoto);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      onPhotoUpdate?.(member.id, result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      onPhotoUpdate?.(member.id, result.assets[0].uri);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert('Update Profile Photo', 'Choose a source', [
      { text: 'Choose from Gallery', onPress: pickFromGallery },
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAddEmail = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Add Email',
        `Enter email address for ${member.name}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (email?: string) => {
              const trimmed = email?.trim();
              if (!trimmed) return;
              try {
                await updateMemberEmail(member.id, trimmed);
                onEmailUpdate?.(member.id, trimmed);
              } catch (e: any) {
                Alert.alert('Failed to save email', e?.message ?? 'Unknown error');
              }
            },
          },
        ],
        'plain-text',
        '',
        'email-address',
      );
    } else {
      setEmailInput('');
      setEditingEmail(true);
    }
  };

  const handleSaveEmailAndroid = async () => {
    const trimmed = emailInput.trim();
    setEditingEmail(false);
    if (!trimmed) return;
    try {
      await updateMemberEmail(member.id, trimmed);
      onEmailUpdate?.(member.id, trimmed);
    } catch (e: any) {
      Alert.alert('Failed to save email', e?.message ?? 'Unknown error');
    }
  };

  const avatar = hasPhoto ? (
    <Image
      source={{ uri: member.profilePhoto }}
      style={styles.avatarImage}
    />
  ) : (
    <View style={[styles.avatarFallback, { backgroundColor: bgColor + '33', borderColor: bgColor }]}>
      <Text style={[styles.avatarText, { color: bgColor }]}>{firstLetter}</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <Pressable onPress={handleAvatarPress} style={({ pressed }) => [pressed && { opacity: 0.7 }]} accessibilityLabel={`Update profile photo for ${member.name}`} accessibilityRole="button">
        {avatar}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{member.name}</Text>
        <Pill
          label={member.role}
          tone={member.role === 'Primary' ? 'green' : 'default'}
        />
        {member.phone ? (
          <Text style={styles.phone}>{member.phone}</Text>
        ) : null}
        {member.email && !editingEmail ? (
          <Pressable onPress={() => {
            setEmailInput(member.email!);
            setEditingEmail(true);
          }}>
            <Text style={styles.email}>{member.email}</Text>
          </Pressable>
        ) : editingEmail ? (
          <View style={styles.emailInputRow}>
            <TextInput
              style={styles.emailInput}
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
              placeholder="email@example.com"
              placeholderTextColor={colors.text3}
              onSubmitEditing={handleSaveEmailAndroid}
              onBlur={handleSaveEmailAndroid}
              returnKeyType="done"
            />
          </View>
        ) : (
          <Pressable onPress={handleAddEmail} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Text style={styles.addEmail}>Add Email</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', fontSize: 16 },
  name: { color: colors.text, fontWeight: '600', fontSize: 14 },
  phone: { color: colors.text2, fontSize: 12, marginTop: 2 },
  email: { color: colors.text2, fontSize: 12, marginTop: 2 },
  addEmail: { color: colors.green2, fontSize: 12, marginTop: 4, fontWeight: '600' },
  emailInputRow: { marginTop: 4 },
  emailInput: {
    color: colors.text,
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.green2,
    minWidth: 160,
  },
});
