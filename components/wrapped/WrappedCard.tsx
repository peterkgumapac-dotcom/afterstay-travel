import { useCallback, useRef, useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Share2 } from 'lucide-react-native';
import { useTheme } from '@/constants/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type ThemeColors = ReturnType<typeof useTheme>['colors'];

interface WrappedCardProps {
  /** Background color for the card */
  bg?: string;
  children: React.ReactNode;
  /** Hide the share button (e.g. for the final share card) */
  hideShare?: boolean;
}

export const CARD_WIDTH = SCREEN_W;
export const CARD_HEIGHT = SCREEN_H;

export default function WrappedCard({
  bg,
  children,
  hideShare = false,
}: WrappedCardProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<ViewShot>(null);
  const styles = useMemo(() => getStyles(colors), [colors]);

  const handleShare = useCallback(async () => {
    try {
      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      // Silently fail — user cancelled or share unavailable
    }
  }, []);

  return (
    <View style={[styles.outer, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
      <ViewShot
        ref={viewShotRef}
        style={[
          styles.card,
          { backgroundColor: bg ?? colors.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
        ]}
        options={{ format: 'png', quality: 1 }}
      >
        {children}

        {/* afterStay watermark */}
        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>afterStay</Text>
        </View>
      </ViewShot>

      {/* Share button — overlay on top of ViewShot (not captured) */}
      {!hideShare && (
        <Pressable
          style={[styles.shareBtn, { bottom: insets.bottom + 24 }]}
          onPress={handleShare}
          accessibilityLabel="Share this card"
          accessibilityRole="button"
          hitSlop={12}
        >
          <Share2 size={20} color="rgba(255,255,255,0.9)" />
        </Pressable>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outer: {
      position: 'relative',
    },
    card: {
      flex: 1,
      paddingHorizontal: 24,
      justifyContent: 'center',
    },
    watermark: {
      position: 'absolute',
      bottom: 16,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    watermarkText: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.4,
      color: 'rgba(255,255,255,0.3)',
      textTransform: 'uppercase',
    },
    shareBtn: {
      position: 'absolute',
      right: 24,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
