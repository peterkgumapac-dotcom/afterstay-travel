import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Download, ExternalLink, Share2, X } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/constants/ThemeContext';
import { getTripFilePreviewUrl } from '@/lib/supabase';
import type { TripFile } from '@/lib/types';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface FileViewerSheetProps {
  visible: boolean;
  file: TripFile | null;
  onClose: () => void;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];

function getExtension(url: string): string {
  const cleaned = url.split('?')[0] ?? url;
  const dot = cleaned.lastIndexOf('.');
  return dot >= 0 ? cleaned.slice(dot + 1).toLowerCase() : '';
}

function isImage(url: string, contentType?: string): boolean {
  return (contentType ?? '').startsWith('image/') || IMAGE_EXTENSIONS.includes(getExtension(url));
}

export default function FileViewerSheet({ visible, file, onClose }: FileViewerSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [downloading, setDownloading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState('');
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fileUrl = resolvedUrl || file?.fileUrl || '';
  const isImg = fileUrl ? isImage(fileUrl, file?.contentType) : false;

  const resolvePreviewUrl = useCallback(async () => {
    if (!file?.storagePath) {
      setPreviewError(file?.previewError ?? null);
      return;
    }
    setResolvingUrl(true);
    setPreviewError(null);
    try {
      const signedUrl = await getTripFilePreviewUrl(file.storagePath);
      setResolvedUrl(signedUrl);
    } catch (err) {
      setResolvedUrl('');
      setPreviewError(err instanceof Error ? err.message : 'Preview link could not be created.');
    } finally {
      setResolvingUrl(false);
    }
  }, [file?.previewError, file?.storagePath]);

  useEffect(() => {
    setImageLoading(true);
    setResolvedUrl('');
    setPreviewError(file?.previewError ?? null);
    if (visible && file?.storagePath) {
      resolvePreviewUrl();
    }
  }, [file?.fileUrl, file?.id, file?.previewError, file?.storagePath, resolvePreviewUrl, visible]);

  const handleDownload = useCallback(async () => {
    if (!fileUrl) return;
    setDownloading(true);
    try {
      const ext = getExtension(fileUrl) || 'pdf';
      const safeName = (file?.fileName ?? 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const outputName = safeName.toLowerCase().endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`;
      const localUri = `${FileSystem.documentDirectory}${outputName}`;

      const { uri } = await FileSystem.downloadAsync(fileUrl, localUri);
      Alert.alert('Downloaded', `Saved to device as ${outputName}`, [
        { text: 'OK' },
        {
          text: 'Open',
          onPress: () => Sharing.shareAsync(uri).catch(() => {}),
        },
      ]);
    } catch {
      Alert.alert('Download failed', 'Could not download this file.');
    } finally {
      setDownloading(false);
    }
  }, [fileUrl, file?.fileName]);

  const handleShare = useCallback(async () => {
    if (!fileUrl) return;
    try {
      // Download first, then share
      const ext = getExtension(fileUrl) || 'pdf';
      const safeName = (file?.fileName ?? 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const outputName = safeName.toLowerCase().endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`;
      const localUri = `${FileSystem.cacheDirectory}${outputName}`;

      await FileSystem.downloadAsync(fileUrl, localUri);
      await Sharing.shareAsync(localUri);
    } catch {
      // Fallback: open in browser
      WebBrowser.openBrowserAsync(fileUrl).catch(() => {});
    }
  }, [fileUrl, file?.fileName]);

  const handleOpenExternal = useCallback(() => {
    if (fileUrl) WebBrowser.openBrowserAsync(fileUrl).catch(() => {});
  }, [fileUrl]);

  if (!file) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <Text style={styles.fileName} numberOfLines={1}>{file.fileName}</Text>
              <Text style={styles.fileType}>{file.type}{file.notes ? ` \u00B7 ${file.notes}` : ''}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.text2} />
            </Pressable>
          </View>

          {/* Preview area */}
          <View style={styles.previewArea}>
            {isImg && fileUrl ? (
              <View style={styles.imageContainer}>
                {imageLoading && (
                  <ActivityIndicator style={styles.imageLoader} color={colors.accent} size="large" />
                )}
                <Image
                  source={{ uri: fileUrl }}
                  style={styles.previewImage}
                  resizeMode="contain"
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </View>
            ) : (
              <View style={styles.noPreview}>
                {resolvingUrl ? (
                  <ActivityIndicator color={colors.accent} size="large" />
                ) : (
                  <Text style={styles.noPreviewTitle}>
                    {(getExtension(fileUrl) || file.contentType?.split('/').pop() || 'FILE').toUpperCase()}
                  </Text>
                )}
                <Text style={styles.noPreviewSub}>
                  {previewError
                    ? `Preview unavailable: ${previewError}`
                    : fileUrl
                      ? 'Tap "Open" to view this document'
                      : resolvingUrl
                        ? 'Preparing private preview link...'
                        : 'Preview link is still being prepared'}
                </Text>
                {!fileUrl && file.storagePath && !resolvingUrl ? (
                  <TouchableOpacity style={styles.retryBtn} onPress={resolvePreviewUrl} activeOpacity={0.75}>
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, (!fileUrl || downloading || resolvingUrl) && styles.actionBtnDisabled]}
              onPress={handleDownload}
              activeOpacity={0.7}
              disabled={!fileUrl || downloading || resolvingUrl}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Download size={18} color={colors.accent} />
              )}
              <Text style={styles.actionText}>Download</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, (!fileUrl || resolvingUrl) && styles.actionBtnDisabled]}
              onPress={handleShare}
              activeOpacity={0.7}
              disabled={!fileUrl || resolvingUrl}
            >
              <Share2 size={18} color={colors.accent} />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, (!fileUrl || resolvingUrl) && styles.actionBtnDisabled]}
              onPress={handleOpenExternal}
              activeOpacity={0.7}
              disabled={!fileUrl || resolvingUrl}
            >
              <ExternalLink size={18} color={colors.accent} />
              <Text style={styles.actionText}>Open</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '85%',
      backgroundColor: colors.canvas,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    headerInfo: {
      flex: 1,
      marginRight: 16,
    },
    fileName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    fileType: {
      fontSize: 12,
      color: colors.text3,
      marginTop: 2,
    },
    previewArea: {
      minHeight: 300,
      marginHorizontal: 16,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageContainer: {
      width: '100%',
      minHeight: 300,
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageLoader: {
      position: 'absolute',
    },
    previewImage: {
      width: '100%',
      height: 300,
    },
    noPreview: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 8,
    },
    noPreviewTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text3,
      letterSpacing: 2,
    },
    noPreviewSub: {
      fontSize: 13,
      color: colors.text3,
      textAlign: 'center',
      paddingHorizontal: 18,
      lineHeight: 18,
    },
    retryBtn: {
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
    },
    retryText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionBtnDisabled: {
      opacity: 0.45,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
  });
