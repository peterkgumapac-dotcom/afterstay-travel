import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lightColors, useTheme } from '@/constants/ThemeContext';
import { updateProfile, uploadProfileCoverPhoto, uploadProfilePhoto, type Profile } from '@/lib/supabase';

interface ProfileCustomizeSheetProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProfileCustomizeSheet({ visible, profile, onClose, onSaved }: ProfileCustomizeSheetProps) {
  useTheme();
  const colors = lightColors;
  const insets = useSafeAreaInsets();
  const s = getStyles(colors);
  const [fullName, setFullName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [homeBase, setHomeBase] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [publicStatsEnabled, setPublicStatsEnabled] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile || !visible) return;
    setFullName(profile.fullName ?? '');
    setHandle(profile.handle ?? '');
    setBio(profile.bio ?? '');
    setHomeBase(profile.homeBase ?? '');
    setInstagram(profile.socials?.instagram ?? '');
    setTiktok(profile.socials?.tiktok ?? '');
    setPublicStatsEnabled(!!profile.publicStatsEnabled);
    setAvatarUrl(profile.avatarUrl);
    setCoverUrl(profile.coverPhotoUrl);
  }, [profile, visible]);

  const pickAvatar = async () => {
    if (!profile || saving) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setSaving(true);
    try {
      const url = await uploadProfilePhoto(profile.id, result.assets[0].uri);
      setAvatarUrl(url);
      onSaved();
    } catch (error) {
      Alert.alert(
        'Photo update failed',
        error instanceof Error ? error.message : 'Could not upload your profile photo. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const pickCover = async () => {
    if (!profile || saving) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.82,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;
    setSaving(true);
    try {
      const url = await uploadProfileCoverPhoto(profile.id, result.assets[0].uri);
      setCoverUrl(url);
      onSaved();
    } catch (error) {
      Alert.alert(
        'Cover update failed',
        error instanceof Error ? error.message : 'Could not upload your cover photo. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        fullName: fullName.trim(),
        handle: handle.trim().toLowerCase().replace(/^@/, ''),
        bio: bio.trim(),
        homeBase: homeBase.trim(),
        publicStatsEnabled,
        socials: {
          ...(instagram.trim() ? { instagram: instagram.trim().replace(/^@/, '') } : {}),
          ...(tiktok.trim() ? { tiktok: tiktok.trim().replace(/^@/, '') } : {}),
        },
      });
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        'Profile update failed',
        error instanceof Error ? error.message : 'Could not save your profile. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <Text style={s.title}>Customize profile</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={22} color={colors.text3} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.photoEditor}>
            <TouchableOpacity style={s.coverWrap} onPress={pickCover} activeOpacity={0.82} disabled={saving}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={s.coverImage} contentFit="cover" />
              ) : (
                <View style={s.coverFallback}>
                  <ImageIcon size={26} color={colors.accent} strokeWidth={1.7} />
                  <Text style={s.coverFallbackText}>Choose a cover photo</Text>
                </View>
              )}
              <View style={s.coverBadge}>
                <Camera size={15} color={colors.canvas} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar} activeOpacity={0.8} disabled={saving}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatar} contentFit="cover" />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{(fullName || 'A').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={s.cameraBadge}>
                <Camera size={16} color={colors.canvas} />
              </View>
            </TouchableOpacity>

            <View style={s.photoActions}>
              <TouchableOpacity style={s.photoAction} onPress={pickCover} activeOpacity={0.75} disabled={saving}>
                <Text style={s.photoActionText}>Change cover</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoAction} onPress={pickAvatar} activeOpacity={0.75} disabled={saving}>
                <Text style={s.photoActionText}>Change profile photo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Field label="Name" value={fullName} onChangeText={setFullName} colors={colors} />
          <Field label="Handle" value={handle} onChangeText={setHandle} colors={colors} autoCapitalize="none" prefix="@" />
          <Field label="Bio" value={bio} onChangeText={setBio} colors={colors} multiline maxLength={140} />
          <Field label="Home base" value={homeBase} onChangeText={setHomeBase} colors={colors} />
          <Field label="Instagram" value={instagram} onChangeText={setInstagram} colors={colors} autoCapitalize="none" prefix="@" />
          <Field label="TikTok" value={tiktok} onChangeText={setTiktok} colors={colors} autoCapitalize="none" prefix="@" />

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Show stats publicly</Text>
              <Text style={s.switchSub}>Companions can still see shared-trip sections when allowed.</Text>
            </View>
            <Switch
              value={publicStatsEnabled}
              onValueChange={setPublicStatsEnabled}
              trackColor={{ false: colors.border2, true: colors.accentBorder }}
              thumbColor={publicStatsEnabled ? colors.accent : colors.text3}
            />
          </View>
        </ScrollView>

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color={colors.canvas} /> : <Text style={s.saveText}>Save Profile</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  colors,
  multiline,
  maxLength,
  autoCapitalize,
  prefix,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  multiline?: boolean;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  prefix?: string;
}) {
  const s = getStyles(colors);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, multiline && { minHeight: 96, alignItems: 'flex-start' }]}>
        {prefix ? <Text style={s.prefix}>{prefix}</Text> : null}
        <TextInput
          style={[s.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.text3}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  photoEditor: {
    marginTop: 8,
    marginBottom: 12,
  },
  coverWrap: {
    height: 168,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
  },
  coverFallbackText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '700',
  },
  coverBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: -48,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  photoAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  photoActionText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  field: {
    marginTop: 14,
  },
  label: {
    color: colors.text3,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  inputWrap: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  switchRow: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  switchSub: {
    color: colors.text3,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  saveBtn: {
    marginHorizontal: 20,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: colors.canvas,
    fontSize: 16,
    fontWeight: '800',
  },
});
