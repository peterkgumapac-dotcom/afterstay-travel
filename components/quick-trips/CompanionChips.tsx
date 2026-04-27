import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import type { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export interface CompanionInput {
  displayName: string;
  userId?: string;
  avatarUrl?: string;
}

interface CompanionChipsProps {
  companions: CompanionInput[];
  onAdd: (companion: CompanionInput) => void;
  onRemove: (index: number) => void;
  colors: ThemeColors;
}

export default function CompanionChips({ companions, onAdd, onRemove, colors }: CompanionChipsProps) {
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ displayName: trimmed });
    setName('');
    setAdding(false);
  };

  return (
    <View style={styles.container}>
      {companions.map((c, i) => (
        <View key={`${c.displayName}-${i}`} style={styles.chip}>
          <Text style={styles.initial}>{c.displayName[0]?.toUpperCase()}</Text>
          <Text style={styles.name} numberOfLines={1}>{c.displayName}</Text>
          <TouchableOpacity onPress={() => onRemove(i)} hitSlop={8}>
            <X size={12} color={colors.text3} />
          </TouchableOpacity>
        </View>
      ))}

      {adding ? (
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={colors.text3}
            autoFocus
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            onBlur={() => { if (!name.trim()) setAdding(false); }}
          />
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)} activeOpacity={0.7}>
          <Plus size={14} color={colors.accent} />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 4,
      paddingRight: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    initial: {
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: colors.accentDim,
      textAlign: 'center',
      lineHeight: 24,
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
      overflow: 'hidden',
    },
    name: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
      maxWidth: 100,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.accentBorder,
      borderStyle: 'dashed',
    },
    addText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    inputWrap: {
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minWidth: 120,
    },
    input: {
      fontSize: 13,
      color: colors.text,
      paddingVertical: 4,
    },
  });
