import { Platform, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { CONFIG } from '@/lib/config';
import type { DiscoverPlace } from '@/components/discover/DiscoverPlaceCard';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

let MapView: any = null;
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
} catch {
  // Maps not available (web or missing native module)
}

interface MapSectionProps {
  places: DiscoverPlace[];
  colors: ThemeColors;
  onMarkerPress?: (place: DiscoverPlace) => void;
}

export function MapSection({ places, colors, onMarkerPress }: MapSectionProps) {
  const styles = getStyles(colors);

  if (!MapView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>
          Map is not available on this platform.
        </Text>
      </View>
    );
  }

  const placesWithCoords = places.filter((p) => p.lat && p.lng);

  if (placesWithCoords.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>Map</Text>
          <Text style={styles.sectionTitle}>Nearby places</Text>
        </View>
      </View>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: CONFIG.HOTEL_COORDS.lat,
            longitude: CONFIG.HOTEL_COORDS.lng,
            latitudeDelta: 0.025,
            longitudeDelta: 0.025,
          }}
          scrollEnabled={false}
          zoomEnabled={true}
          pitchEnabled={false}
        >
          {/* Hotel pin */}
          <Marker
            coordinate={{
              latitude: CONFIG.HOTEL_COORDS.lat,
              longitude: CONFIG.HOTEL_COORDS.lng,
            }}
            title="Your Hotel"
            pinColor={colors.accent}
          />
          {/* Place pins */}
          {placesWithCoords.map((p) => (
            <Marker
              key={p.n}
              coordinate={{ latitude: p.lat!, longitude: p.lng! }}
              title={p.n}
              description={`${p.t} \u00B7 ${p.d}`}
              onCalloutPress={() => onMarkerPress?.(p)}
            />
          ))}
        </MapView>
      </View>
    </>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.text3,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: -0.48,
      color: colors.text,
      marginTop: 2,
    },
    mapContainer: {
      marginHorizontal: 16,
      height: 220,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    map: {
      width: '100%',
      height: '100%',
    },
    fallback: {
      marginHorizontal: 16,
      height: 120,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    fallbackText: {
      fontSize: 12,
      color: colors.text3,
    },
  });
