import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import type { TripFile, TripFileType } from '@/lib/types';
import Pill from './Pill';
import { FilePreviewSheet } from './shared/FilePreviewSheet';

const TYPE_EMOJI: Record<TripFileType, string> = {
  'Boarding Pass': '\uD83C\uDFAB',
  'Hotel Confirmation': '🏨',
  Itinerary: '📋',
  Insurance: '🛡️',
  'ID/Passport': '🪪',
  Receipt: '🧾',
  Other: '📄',
};

const TYPE_TONE: Record<TripFileType, 'blue' | 'amber' | 'green' | 'purple' | 'red' | 'default'> = {
  'Boarding Pass': 'blue',
  'Hotel Confirmation': 'amber',
  Itinerary: 'green',
  Insurance: 'purple',
  'ID/Passport': 'red',
  Receipt: 'default',
  Other: 'default',
};

interface Props {
  file: TripFile;
}

export default function TripFileRow({ file }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const emoji = TYPE_EMOJI[file.type] ?? '📄';
  const tone = TYPE_TONE[file.type] ?? 'default';

  const handlePress = () => {
    if (!file.fileUrl) {
      Alert.alert('No file', 'This entry has no file attached.');
      return;
    }
    setPreviewOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          file.printRequired && styles.cardPrintRequired,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>

        <View style={styles.info}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file.fileName}
          </Text>
          {file.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {file.notes}
            </Text>
          ) : null}
        </View>

        <View style={styles.trailing}>
          <Pill label={file.type} tone={tone} />
          {file.printRequired && <Text style={styles.printBadge}>🖨️</Text>}
        </View>
      </Pressable>

      {previewOpen && file.fileUrl && (
        <FilePreviewSheet
          visible={previewOpen}
          onClose={() => setPreviewOpen(false)}
          fileUrl={file.fileUrl}
          fileName={file.fileName}
          fileType={file.type}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardPrintRequired: {
    borderColor: colors.amber + '60',
    backgroundColor: colors.amber + '08',
  },
  emoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  notes: {
    color: colors.text2,
    fontSize: 12,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  printBadge: {
    fontSize: 14,
  },
});
