import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileType?: string;
}

type FileKind = 'image' | 'pdf' | 'web' | 'other';

const detectKind = (url: string, name: string): FileKind => {
  const s = (url + ' ' + name).toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp)($|\?)/i.test(s)) return 'image';
  if (/\.pdf($|\?)/i.test(s)) return 'pdf';
  if (s.startsWith('http://') || s.startsWith('https://')) return 'web';
  return 'other';
};

const isLocalFile = (url: string) => url.startsWith('file://');

export const FilePreviewSheet: React.FC<Props> = ({
  visible, onClose, fileUrl, fileName, fileType,
}) => {
  const [imgError, setImgError] = useState(false);
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const kind = detectKind(fileUrl, fileName);

  useEffect(() => {
    if (!visible) return;
    setImgError(false);
    if (isLocalFile(fileUrl)) {
      FileSystem.getInfoAsync(fileUrl)
        .then((info) => {
          setFileExists(info.exists);
          setFileSize(info.exists ? (info as any).size || 0 : 0);
        })
        .catch(() => setFileExists(false));
    } else {
      setFileExists(true);
    }
  }, [visible, fileUrl]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openFile = async () => {
    Haptics.selectionAsync();
    setLoading(true);
    try {
      if (isLocalFile(fileUrl)) {
        if (!(await Sharing.isAvailableAsync())) {
          Alert.alert('Cannot open', 'Sharing unavailable on this device');
          return;
        }
        await Sharing.shareAsync(fileUrl, {
          mimeType: kind === 'pdf' ? 'application/pdf' : undefined,
          dialogTitle: fileName,
          UTI: kind === 'pdf' ? 'com.adobe.pdf' : undefined,
        });
      } else {
        await WebBrowser.openBrowserAsync(fileUrl, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      }
    } catch (e: any) {
      console.error('Open error:', e);
      Alert.alert('Error', e.message || 'Could not open');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (fileExists === false) {
      return (
        <View style={styles.missing}>
          <Text style={styles.missingIcon}>⚠️</Text>
          <Text style={styles.missingTitle}>File no longer available</Text>
          <Text style={styles.missingText}>
            This file was in the Expo Go cache which has been cleared.
            Re-upload it to restore.
          </Text>
        </View>
      );
    }

    if (kind === 'image') {
      return (
        <View style={styles.imageWrap}>
          {!imgError ? (
            <Image
              source={{ uri: fileUrl }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={{ fontSize: 48 }}>🖼️</Text>
              <Text style={{ color: '#8b95a5', marginTop: 12 }}>
                Image could not be loaded
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (kind === 'pdf') {
      return (
        <View style={styles.docCard}>
          <Text style={styles.docIcon}>📄</Text>
          <Text style={styles.docTitle} numberOfLines={2}>{fileName}</Text>
          <View style={styles.docMeta}>
            {fileType && <Text style={styles.docMetaText}>{fileType}</Text>}
            {fileSize > 0 && (
              <>
                {fileType && <Text style={styles.docMetaText}> · </Text>}
                <Text style={styles.docMetaText}>{formatBytes(fileSize)}</Text>
              </>
            )}
          </View>
          <Text style={styles.docHint}>
            Opens in your PDF reader (Google Drive, Adobe, etc.)
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.docCard}>
        <Text style={styles.docIcon}>{kind === 'web' ? '🌐' : '📎'}</Text>
        <Text style={styles.docTitle} numberOfLines={2}>{fileName}</Text>
        {fileType && <Text style={styles.docMetaText}>{fileType}</Text>}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{fileName}</Text>
              {fileType && <Text style={styles.subtitle}>{fileType}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={{ color: '#fff', fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewArea}>{renderPreview()}</View>

          {fileExists !== false && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={openFile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {kind === 'image' ? 'Share / Save' :
                   kind === 'pdf' ? 'Open in PDF Reader' :
                   kind === 'web' ? 'Open in Browser' : 'Open with...'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f1318',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 16,
    maxHeight: '92%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f27',
    marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#8b95a5', fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1f27',
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  imageWrap: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { alignItems: 'center' },
  docCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1f27',
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a3040',
  },
  docIcon: { fontSize: 56, marginBottom: 16 },
  docTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  docMeta: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  docMetaText: { color: '#8b95a5', fontSize: 12 },
  docHint: {
    color: '#5a6577',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  missing: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    width: '100%',
  },
  missingIcon: { fontSize: 40, marginBottom: 12 },
  missingTitle: { color: '#ef4444', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  missingText: { color: '#8b95a5', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  primaryBtn: {
    backgroundColor: '#2dd4a0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
