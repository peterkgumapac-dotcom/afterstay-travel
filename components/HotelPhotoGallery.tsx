import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';

interface Props {
  photos: string[];
}

export default function HotelPhotoGallery({ photos }: Props) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (photos.length === 0) {
    return null;
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
      >
        {photos.map((uri, index) => (
          <Pressable key={`${uri}-${index}`} onPress={() => setSelectedPhoto(uri)}>
            <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={() => setSelectedPhoto(null)}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.sm,
  },
  thumbnail: {
    width: 120,
    height: 90,
    borderRadius: radius.md,
    backgroundColor: colors.bg3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.xxxl + spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    backgroundColor: colors.bg3,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  closeText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
