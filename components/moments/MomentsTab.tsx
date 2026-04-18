import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { CONFIG } from '../../lib/config';
import { colors, spacing, radius } from '@/constants/theme';
import { SlideshowModal } from './SlideshowModal';

const { width: SCREEN_W } = Dimensions.get('window');
const TILE_SIZE = (SCREEN_W - 48) / 3;

interface Moment {
  id: string;
  photoUrl: string;
  caption: string;
  location: string;
  date: string;
}

export const MomentsTab = () => {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useEffect(() => { loadMoments(); }, []);

  const loadMoments = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://api.notion.com/v1/databases/${CONFIG.NOTION_DBS.MOMENTS}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              property: 'Trip',
              relation: { contains: CONFIG.TRIP_PAGE_ID },
            },
            sorts: [{ property: 'Date', direction: 'descending' }],
          }),
        }
      );
      const data = await res.json();
      const mapped: Moment[] = (data.results || []).map((r: any) => ({
        id: r.id,
        photoUrl: r.properties.Photo?.url || '',
        caption: r.properties.Caption?.rich_text?.[0]?.plain_text || '',
        location: r.properties.Location?.rich_text?.[0]?.plain_text || '',
        date: r.properties.Date?.date?.start || '',
      })).filter((m: Moment) => m.photoUrl);
      setMoments(mapped);
    } catch (e) {
      console.error('Load moments error:', e);
    } finally {
      setLoading(false);
    }
  };

  const addMoment = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const asset = result.assets[0];

      await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parent: { database_id: CONFIG.NOTION_DBS.MOMENTS },
          properties: {
            'Title': { title: [{ text: { content: `Moment ${new Date().toLocaleDateString()}` } }] },
            'Photo': { url: asset.uri },
            'Date': { date: { start: new Date().toISOString().split('T')[0] } },
            'Trip': { relation: [{ id: CONFIG.TRIP_PAGE_ID }] },
          },
        }),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadMoments();
    } catch (e: any) {
      console.error('Add moment error:', e);
      Alert.alert('Error', e.message);
    } finally {
      setUploading(false);
    }
  };

  const openSlideshow = () => {
    if (moments.length === 0) {
      Alert.alert('No moments yet', 'Add some photos first');
      return;
    }
    Haptics.selectionAsync();
    setViewerIndex(0);
    setSlideshowOpen(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Moments</Text>
          <Text style={styles.subtitle}>
            {moments.length} {moments.length === 1 ? 'memory' : 'memories'} from Boracay
          </Text>
        </View>
        <TouchableOpacity onPress={openSlideshow} style={styles.slideshowBtn}>
          <Text style={styles.slideshowText}>▶ Slideshow</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={addMoment}
        style={styles.addBtn}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Add Photo</Text>
          </>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : moments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyText}>
            No moments yet. Start capturing your Boracay memories!
          </Text>
        </View>
      ) : (
        <FlatList
          data={moments}
          keyExtractor={(m) => m.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              onPress={() => {
                setViewerIndex(index);
                setSlideshowOpen(true);
              }}
              style={styles.tile}
            >
              <Image
                source={{ uri: item.photoUrl }}
                style={styles.tileImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        />
      )}

      {slideshowOpen && (
        <SlideshowModal
          visible={slideshowOpen}
          moments={moments}
          startIndex={viewerIndex}
          onClose={() => setSlideshowOpen(false)}
          onRefresh={loadMoments}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.text2, fontSize: 13, marginTop: 4 },
  slideshowBtn: {
    backgroundColor: colors.accentBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  slideshowText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 14,
    marginHorizontal: spacing.lg,
    marginVertical: 10,
    gap: spacing.sm,
  },
  addIcon: { color: colors.accent, fontSize: 20, fontWeight: '300' },
  addText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  grid: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 100 },
  tile: { width: TILE_SIZE, height: TILE_SIZE, margin: 4 },
  tileImage: { width: '100%', height: '100%', borderRadius: radius.xs, backgroundColor: colors.card },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { color: colors.text2, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
