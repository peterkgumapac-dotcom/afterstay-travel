import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Share2 } from 'lucide-react-native';
import WrappedCard, { CARD_WIDTH, CARD_HEIGHT } from './WrappedCard';
import { formatDatePHT } from '@/lib/utils';

interface ShareCardProps {
  destination: string;
  startDate: string;
  endDate: string;
  nights: number;
  momentCount: number;
  placesCount: number;
  totalSpent: number;
  currency: string;
  memberCount: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '\u20B1',
  USD: '$',
  EUR: '\u20AC',
  JPY: '\u00A5',
  GBP: '\u00A3',
};

export default function ShareCard({
  destination,
  startDate,
  endDate,
  nights,
  momentCount,
  placesCount,
  totalSpent,
  currency,
  memberCount,
}: ShareCardProps) {
  const insets = useSafeAreaInsets();
  const compositeRef = useRef<ViewShot>(null);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const dateRange = `${formatDatePHT(startDate)} \u2013 ${formatDatePHT(endDate)}`;

  const handleShare = useCallback(async () => {
    try {
      const uri = await captureRef(compositeRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch {
      // User cancelled or share unavailable
    }
  }, []);

  return (
    <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <ViewShot
        ref={compositeRef}
        style={[styles.card, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        options={{ format: 'png', quality: 1 }}
      >
        {/* Summary composite for sharing */}
        <View style={styles.content}>
          <Text style={styles.brand}>afterStay</Text>
          <Text style={styles.destination}>{destination}</Text>
          <Text style={styles.dates}>{dateRange}</Text>

          <View style={styles.statsGrid}>
            <StatBox value={String(nights)} label={nights === 1 ? 'night' : 'nights'} />
            <StatBox value={String(momentCount)} label="moments" />
            <StatBox value={String(placesCount)} label="places" />
            <StatBox value={`${symbol}${Math.round(totalSpent).toLocaleString()}`} label="spent" />
          </View>

          <Text style={styles.crew}>
            {memberCount} {memberCount === 1 ? 'traveler' : 'travelers'}
          </Text>
        </View>
      </ViewShot>

      {/* Share CTA */}
      <View style={[styles.ctaContainer, { bottom: insets.bottom + 32 }]}>
        <Pressable
          style={styles.ctaBtn}
          onPress={handleShare}
          accessibilityLabel="Share your trip recap"
          accessibilityRole="button"
        >
          <Share2 size={20} color="#0a0806" />
          <Text style={styles.ctaText}>Share Your Trip</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#0e0c0a',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: '#d8ab7a',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  destination: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f1ebe2',
    letterSpacing: -1,
    textAlign: 'center',
  },
  dates: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(241,235,226,0.6)',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  statBox: {
    width: '44%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1ebe2',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(241,235,226,0.45)',
    marginTop: 4,
  },
  crew: {
    fontSize: 14,
    color: 'rgba(241,235,226,0.5)',
    marginTop: 12,
  },
  ctaContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#d8ab7a',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0806',
  },
});
