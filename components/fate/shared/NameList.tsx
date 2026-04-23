import * as Haptics from 'expo-haptics';
import { Plus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colorForName, fateColors, fateLayout } from '@/constants/fateTheme';

interface NameListProps {
  names: string[];
  onChange: (names: string[]) => void;
  minNames: number;
  maxNames: number;
}

export default function NameList({ names, onChange, minNames, maxNames }: NameListProps) {
  const [draft, setDraft] = useState('');

  const addName = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > 20) return;
    if (names.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return;
    if (names.length >= maxNames) return;

    Haptics.selectionAsync();
    onChange([...names, trimmed]);
    setDraft('');
  };

  const removeName = (index: number) => {
    if (names.length <= minNames) return;
    Haptics.selectionAsync();
    onChange(names.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {names.map((name, i) => (
          <View
            key={`${name}-${i}`}
            style={[styles.chip, { borderColor: colorForName(name, i) }]}
          >
            <View style={[styles.chipDot, { backgroundColor: colorForName(name, i) }]} />
            <Text style={styles.chipText}>{name}</Text>
            {names.length > minNames && (
              <Pressable
                onPress={() => removeName(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name}`}
              >
                <X size={14} color={fateColors.textMuted} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {names.length < maxNames && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a name..."
            placeholderTextColor={fateColors.textMuted}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={addName}
          />
          <Pressable
            onPress={addName}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Add name"
            style={[styles.addButton, !draft.trim() && styles.addButtonDisabled]}
          >
            <Plus size={18} color={fateColors.buttonPrimaryText} strokeWidth={2.5} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: fateLayout.buttonRadius,
    borderWidth: 1.5,
    backgroundColor: fateColors.surface,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: fateColors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: fateColors.dividerStrong,
    borderRadius: fateLayout.buttonRadius,
    paddingHorizontal: 14,
    fontSize: 14,
    color: fateColors.textPrimary,
    backgroundColor: fateColors.surface,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: fateLayout.buttonRadius,
    backgroundColor: fateColors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.3 },
});
