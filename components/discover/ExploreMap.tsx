import React from 'react';
import type { DiscoverPlace } from './DiscoverPlaceCard';

// In-app map removed — "Explore on Map" opens Google Maps in browser instead.
export const MAP_AVAILABLE = false;

interface ExploreMapProps {
  visible: boolean;
  places: readonly DiscoverPlace[];
  savedNames: Set<string>;
  recommendedNames: Set<string>;
  travelMode: 'walk' | 'car';
  distanceOrigin: 'hotel' | 'me';
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onTravelModeChange: (m: 'walk' | 'car') => void;
  onAnchorChange: (a: 'hotel' | 'me') => void;
  onSaveToggle: (name: string) => void;
  getDistanceKm: (lat?: number, lng?: number) => number;
}

function ExploreMap(_props: ExploreMapProps) {
  return null;
}

export default React.memo(ExploreMap);
