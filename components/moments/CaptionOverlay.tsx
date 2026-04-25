import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MapPin, Type, X } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';
import { formatDatePHT } from '@/lib/utils';

export type CaptionMode = 'auto' | 'custom' | 'none';

interface CaptionOverlayProps {
  mode: CaptionMode;
  onModeChange: (mode: CaptionMode) => void;
  customText: string;
  onCustomTextChange: (text: string) => void;
  /** Location from the moment */
  location?: string;
  /** Date ISO string from the moment */
  date: string;
}

/** Renders caption text positioned at bottom of the photo preview */
export function CaptionOverlay({
  mode,
  onModeChange,
  customText,
  onCustomTextChange,
  location,
  date,
}: CaptionOverlayProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const autoCaption = useMemo(() => {
    const parts: string[] = [];
    if (location) parts.push(location);
    if (date) parts.push(formatDatePHT(date));
    return parts.join(' \u00B7 ') || formatDatePHT(date);
  }, [location, date]);

  const displayText = mode === 'auto' ? autoCaption : mode === 'custom' ? customText : '';

  return (
    <View style={s.container}>
      {/* Caption text on photo */}
      {mode !== 'none' && displayText.length > 0 && (
        <View style={s.captionBadge}>
          {mode === 'auto' && <MapPin size={11} color="#fff" strokeWidth={2} />}
          {mode === 'custom' && <Type size={11} color="#fff" strokeWidth={2} />}
          <Text style={s.captionText}>{displayText}</Text>
        </View>
      )}

      {/* Mode selector strip */}
      <View style={s.modeRow}>
        <ModeBtn
          label="Auto"
          active={mode === 'auto'}
          onPress={() => { Haptics.selectionAsync(); onModeChange('auto'); }}
          s={s}
          colors={colors}
        />
        <ModeBtn
          label="Custom"
          active={mode === 'custom'}
          onPress={() => { Haptics.selectionAsync(); onModeChange('custom'); }}
          s={s}
          colors={colors}
        />
        <ModeBtn
          label="None"
          active={mode === 'none'}
          onPress={() => { Haptics.selectionAsync(); onModeChange('none'); }}
          s={s}
          colors={colors}
        />
      </View>

      {/* Custom text input */}
      {mode === 'custom' && (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={customText}
            onChangeText={onCustomTextChange}
            placeholder="Type your caption..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={100}
            returnKeyType="done"
            autoFocus
          />
          {customText.length > 0 && (
            <Pressable onPress={() => onCustomTextChange('')} style={s.clearBtn}>
              <X size={14} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function ModeBtn({
  label,
  active,
  onPress,
  s,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  s: ReturnType<typeof getStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.modeBtn, active && s.modeBtnActive]}
      accessibilityRole="button"
      accessibilityLabel={`Caption mode: ${label}`}
    >
      <Text style={[s.modeBtnText, active && s.modeBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    captionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
    },
    captionText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#fff',
      letterSpacing: 0.2,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    modeRow: {
      flexDirection: 'row',
      alignSelf: 'center',
      gap: 6,
    },
    modeBtn: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    modeBtnActive: {
      backgroundColor: colors.accent,
    },
    modeBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.5)',
    },
    modeBtnTextActive: {
      color: '#000',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: '#fff',
      paddingVertical: 10,
    },
    clearBtn: {
      padding: 4,
    },
  });
