import * as Haptics from 'expo-haptics';
import { Share2 } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import type { MomentDisplay } from '../types';
import { generateTripRecap, type DayRecap } from './generateRecap';
import { MinimalTemplate } from './MinimalTemplate';
import { PolaroidTemplate } from './PolaroidTemplate';

type TemplateName = 'minimal' | 'polaroid';

const TEMPLATES: { key: TemplateName; label: string }[] = [
  { key: 'minimal', label: 'Minimal' },
  { key: 'polaroid', label: 'Polaroid' },
];

interface RecapsLayoutProps {
  items: MomentDisplay[];
  destination: string;
  tripStartDate: string;
}

export function RecapsLayout({ items, destination, tripStartDate }: RecapsLayoutProps) {
  const { colors } = useTheme();
  const [template, setTemplate] = useState<TemplateName>('minimal');
  const cardRefs = useRef<Map<string, View>>(new Map());

  const recap = useMemo(
    () => generateTripRecap(items as any, destination, tripStartDate),
    [items, destination, tripStartDate],
  );

  const handleShare = useCallback(async (day: string) => {
    const ref = cardRefs.current.get(day);
    if (!ref) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Share', 'Share feature coming soon — being polished for next update.');
    } catch {
      // ignore
    }
  }, []);

  if (recap.days.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.text3 }]}>
          No moments yet — add photos to see your day recaps
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Template picker */}
      <View style={styles.templateRow}>
        <Text style={[styles.templateLabel, { color: colors.text3 }]}>TEMPLATE</Text>
        <View style={styles.templatePicker}>
          {TEMPLATES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => { Haptics.selectionAsync(); setTemplate(t.key); }}
              style={[
                styles.templateBtn,
                {
                  backgroundColor: template === t.key ? colors.accent : colors.card,
                  borderColor: template === t.key ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[
                styles.templateBtnText,
                { color: template === t.key ? '#fff' : colors.text2 },
              ]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Trip summary */}
      <View style={[styles.summaryRow, { borderColor: colors.border }]}>
        <Text style={[styles.summaryText, { color: colors.text }]}>
          {recap.totalDays} days · {recap.totalMoments} moments · {recap.totalPlaces} places
        </Text>
      </View>

      {/* Day recap cards */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {recap.days.map((day) => (
          <View key={day.day} style={styles.cardWrapper}>
            <View
              ref={(r) => { if (r) cardRefs.current.set(day.day, r); }}
              collapsable={false}
            >
              {template === 'minimal' ? (
                <MinimalTemplate recap={day} />
              ) : (
                <PolaroidTemplate recap={day} />
              )}
            </View>

            {/* Share button */}
            <Pressable
              onPress={() => handleShare(day.day)}
              style={[styles.shareBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Share2 size={14} color={colors.accent} strokeWidth={2} />
              <Text style={[styles.shareBtnText, { color: colors.accent }]}>Share</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center' },

  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  templateLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  templatePicker: {
    flexDirection: 'row',
    gap: 6,
  },
  templateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  summaryRow: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
  },

  cards: {
    gap: 24,
    paddingBottom: 120,
  },
  cardWrapper: {
    gap: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
