import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Canvas,
  Image as SkiaImage,
  useImage,
  ColorMatrix,
} from '@shopify/react-native-skia';
import { useTheme } from '@/constants/ThemeContext';
import { FILM_FILTERS, type FilmFilter } from '@/hooks/useFilmFilters';

const THUMB_SIZE = 64;

interface FilmFilterStripProps {
  photoUri: string;
  activeFilterId: string;
  onSelect: (filter: FilmFilter) => void;
}

export function FilmFilterStrip({ photoUri, activeFilterId, onSelect }: FilmFilterStripProps) {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const skiaImage = useImage(photoUri);

  const renderItem = useCallback(
    ({ item }: { item: FilmFilter }) => {
      const isActive = item.id === activeFilterId;
      return (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onSelect(item);
          }}
          style={s.filterItem}
          accessibilityLabel={`${item.name} filter`}
          accessibilityRole="button"
        >
          <View style={[s.thumbWrap, isActive && s.thumbWrapActive]}>
            {skiaImage && (
              <Canvas style={s.thumbCanvas}>
                <SkiaImage
                  image={skiaImage}
                  fit="cover"
                  x={0}
                  y={0}
                  width={THUMB_SIZE}
                  height={THUMB_SIZE}
                >
                  <ColorMatrix matrix={item.matrix} />
                </SkiaImage>
              </Canvas>
            )}
          </View>
          <Text
            style={[s.filterName, isActive && s.filterNameActive]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={s.filterVibe} numberOfLines={1}>
            {item.vibe}
          </Text>
        </Pressable>
      );
    },
    [activeFilterId, skiaImage, onSelect, s],
  );

  return (
    <FlatList
      data={FILM_FILTERS as unknown as FilmFilter[]}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.list}
      ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
    />
  );
}

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    filterItem: {
      alignItems: 'center',
      width: THUMB_SIZE + 8,
    },
    thumbWrap: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    thumbWrapActive: {
      borderColor: colors.accent,
    },
    thumbCanvas: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
    },
    filterName: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text2,
      marginTop: 6,
      textAlign: 'center',
    },
    filterNameActive: {
      color: colors.accent,
    },
    filterVibe: {
      fontSize: 8.5,
      color: colors.text3,
      textAlign: 'center',
      marginTop: 1,
    },
  });
