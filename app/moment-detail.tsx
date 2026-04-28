import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Share2, Heart, MapPin, Calendar } from 'lucide-react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/constants/ThemeContext';
import { getMoments } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { Moment } from '@/lib/types';

export default function MomentDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { momentId, tripId } = useLocalSearchParams<{ momentId: string; tripId?: string }>();

  const [moment, setMoment] = useState<Moment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    getMoments(tripId)
      .then((moments) => {
        const found = moments.find((m) => m.id === momentId);
        setMoment(found ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [momentId, tripId]);

  const handleShare = useCallback(() => {
    if (!moment?.photo) return;
    import('react-native').then(({ Share }) => {
      Share.share({
        message: [moment.caption, moment.location].filter(Boolean).join(' — '),
        url: moment.photo!,
      });
    });
  }, [moment]);

  const s = useMemo(() => getStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!moment) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <Text style={{ color: colors.text3 }}>Moment not found</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Close button */}
      <Pressable style={[s.closeBtn, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <X size={22} color="#fff" />
      </Pressable>

      {/* Share button */}
      <Pressable style={[s.shareBtn, { top: insets.top + 12 }]} onPress={handleShare}>
        <Share2 size={20} color="#fff" />
      </Pressable>

      {/* Photo viewer */}
      <Image
        source={moment.photo ? { uri: moment.photo } : null}
        style={{ flex: 1 }}
        contentFit="contain"
        transition={200}
        cachePolicy="memory-disk"
        onLoad={() => {
          if (__DEV__) console.log('✅ [MomentDetail] Image loaded:', moment.photo?.slice(0, 60));
        }}
        onError={(e) => {
          if (__DEV__) console.log('❌ [MomentDetail] Image error:', e, 'URI:', moment.photo?.slice(0, 60));
        }}
      />

      {/* Info overlay */}
      <View style={[s.infoOverlay, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}>
        {moment.caption && (
          <Text style={s.caption}>{moment.caption}</Text>
        )}
        <View style={s.metaRow}>
          {moment.location && (
            <View style={s.metaItem}>
              <MapPin size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.metaText}>{moment.location}</Text>
            </View>
          )}
          {moment.date && (
            <View style={s.metaItem}>
              <Calendar size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.metaText}>{formatDatePHT(moment.date)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ReturnType<typeof import('@/constants/ThemeContext').useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    closeBtn: {
      position: 'absolute',
      left: 16,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareBtn: {
      position: 'absolute',
      right: 16,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingTop: 40,
      backgroundColor: 'transparent',
    },
    caption: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 16,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: 12,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
  });
