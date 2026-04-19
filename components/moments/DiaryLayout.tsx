import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { spacing, radius } from '@/constants/theme';
import { MosaicTile } from './MosaicTile';
import { VoiceNote } from './VoiceNote';
import type { MomentDisplay } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiaryLayoutProps {
  items: MomentDisplay[];
  onOpen: (moment: MomentDisplay) => void;
  people: Record<string, { name: string; color: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reactionScore(m: MomentDisplay): number {
  return Object.values(m.reactions || {}).reduce((a, b) => a + b, 0);
}

/**
 * Pick up to 3 most-distinct place names from a day's moments.
 * Shortens names by dropping ", Station X" suffixes, "Hotels", etc.
 * Joins with " \u00b7 ".
 */
function dayOneLiner(ms: MomentDisplay[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const m of ms) {
    if (!m.place) continue;
    const p = m.place
      .split(/[,\u2014]/)[0]
      .trim()
      .replace(/^Canyon Hotels/, 'Canyon')
      .replace(/\s+Viewpoint$/, '');
    if (seen.has(p)) continue;
    seen.add(p);
    parts.push(p);
    if (parts.length >= 3) break;
  }

  return parts.join(' \u00b7 ');
}

// ---------------------------------------------------------------------------
// Avatar stack (inline, small)
// ---------------------------------------------------------------------------

function AvatarStack({
  keys,
  people,
}: {
  keys: string[];
  people: Record<string, { name: string; color: string }>;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row' }}>
      {keys.map((k, i) => {
        const person = people[k];
        if (!person) return null;
        return (
          <View
            key={k}
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              backgroundColor: person.color,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: i === 0 ? 0 : -6,
              borderWidth: 2,
              borderColor: colors.card,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: '600',
                color: colors.onBlack,
              }}
            >
              {k}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiaryLayout({ items, onOpen, people }: DiaryLayoutProps) {
  const { colors } = useTheme();

  // Group by day, preserving order.
  const dayGroups = useMemo(() => {
    const days: Record<string, MomentDisplay[]> = {};
    const dayKeys: string[] = [];

    items.forEach((m) => {
      if (!days[m.date]) {
        days[m.date] = [];
        dayKeys.push(m.date);
      }
      days[m.date].push(m);
    });

    return dayKeys.map((d) => ({ day: d, items: days[d] }));
  }, [items]);

  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: 26 }}>
      {dayGroups.map((grp, idx) => {
        const ms = grp.items;
        const weather = ms[0].weather;
        const totalExp = ms.reduce(
          (acc, m) =>
            acc +
            (m.expense
              ? parseInt(m.expense.amt.replace(/[^\d]/g, ''), 10)
              : 0),
          0,
        );
        const peopleKeys = [...new Set(ms.map((x) => x.authorKey || ''))].filter(Boolean);
        const oneLiner = dayOneLiner(ms);
        const voiceMoment = ms.find((m) => m.voice);

        // First moment is hero; next 3 are supporting.
        const hero = ms[0];
        const supporting = ms.slice(1, 4);

        // Pull-quote: use the first moment's caption & author.
        const quoteAuthorKey = hero.authorKey || '';
        const quoteAuthor = people[quoteAuthorKey];
        const quoteColor = quoteAuthor?.color || colors.accent;

        // Time range
        const firstTime = ms[0].time || '';
        const lastTime = ms[ms.length - 1].time || '';

        return (
          <View key={grp.day}>
            {/* ---- Day header ---- */}
            <View style={{ marginBottom: spacing.md }}>
              {/* Eyebrow row */}
              <View style={styles.eyebrowRow}>
                <Text
                  style={[
                    styles.eyebrowText,
                    { color: colors.text3 },
                  ]}
                >
                  Day {idx + 1} {'\u00b7'} {grp.day}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {peopleKeys.length > 0 && (
                    <AvatarStack keys={peopleKeys} people={people} />
                  )}
                  {weather ? (
                    <View
                      style={[
                        styles.weatherChip,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.weatherText, { color: colors.text3 }]}>
                        {weather}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Auto one-liner headline */}
              <Text
                style={{
                  fontSize: 19,
                  fontWeight: '500',
                  lineHeight: 19 * 1.2,
                  color: colors.text,
                  letterSpacing: -0.01 * 19,
                }}
              >
                {oneLiner}
              </Text>

              {/* Quiet meta row */}
              <View style={[styles.metaRow, { marginTop: 4 }]}>
                <Text style={[styles.metaText, { color: colors.text3 }]}>
                  {ms.length} {ms.length === 1 ? 'moment' : 'moments'}
                </Text>
                <Text style={[styles.metaDot, { color: colors.border2 }]}>{'\u00b7'}</Text>
                <Text style={[styles.metaText, { color: colors.text3 }]}>
                  {firstTime} {'\u2014'} {lastTime}
                </Text>
                {totalExp > 0 && (
                  <>
                    <Text style={[styles.metaDot, { color: colors.border2 }]}>{'\u00b7'}</Text>
                    <Text
                      style={[
                        styles.metaText,
                        {
                          color: colors.accent,
                          fontWeight: '600',
                          fontFamily: 'SpaceMono',
                        },
                      ]}
                    >
                      {'\u20b1'}{totalExp.toLocaleString()}
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* ---- Hero photo ---- */}
            <MosaicTile
              moment={hero}
              onOpen={onOpen}
              aspect={16 / 10}
              people={people}
            />

            {/* ---- Supporting row ---- */}
            {supporting.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  marginTop: 6,
                }}
              >
                {supporting.map((m) => (
                  <View key={m.id} style={{ flex: 1 }}>
                    <MosaicTile
                      moment={m}
                      onOpen={onOpen}
                      aspect={1}
                      people={people}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* ---- Voice note ---- */}
            {voiceMoment && voiceMoment.voice && voiceMoment.authorKey && (
              <View style={{ marginTop: spacing.sm }}>
                <VoiceNote
                  duration={voiceMoment.voice.duration}
                  authorColor={people[voiceMoment.authorKey]?.color || colors.accent}
                />
              </View>
            )}

            {/* ---- Pull-quote caption card ---- */}
            <View
              style={[
                styles.quoteCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderLeftColor: quoteColor,
                },
              ]}
            >
              <Text style={{ fontSize: 12, color: colors.text2, lineHeight: 12 * 1.45 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {'\u201c'}{hero.caption}{'\u201d'}
                </Text>
                <Text style={{ color: colors.text3 }}>
                  {' '}{'\u2014'} {quoteAuthor?.name || quoteAuthorKey}
                </Text>
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  weatherChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  weatherText: {
    fontSize: 10,
    fontWeight: '550',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    fontSize: 10.5,
  },
  metaDot: {
    fontSize: 10.5,
  },
  quoteCard: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
});
