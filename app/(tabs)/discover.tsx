import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { CategoryGrid, type CategoryItem } from '@/components/discover/CategoryGrid';
import {
  DiscoverPlaceCard,
  type DiscoverPlace,
} from '@/components/discover/DiscoverPlaceCard';
import { SuggestionList } from '@/components/discover/SuggestionList';
import { TrendingCard, type TrendingItem } from '@/components/discover/TrendingCard';
import { useTheme } from '@/constants/ThemeContext';

type ThemeColors = ReturnType<typeof useTheme>['colors'];
type TabId = 'planner' | 'places' | 'saved';
type FilterState = {
  minRating: number;
  openNow: boolean;
  nearby: boolean;
  maxPrice: number;
};

// ── Data ────────────────────────────────────────────────────────────────

const CATEGORIES: readonly CategoryItem[] = [
  { id: 'beach', label: 'Beaches', emoji: '\uD83C\uDFDD\uFE0F', color: '#7ac4d6' },
  { id: 'food', label: 'Food', emoji: '\uD83C\uDF5C', color: '#e8a860' },
  { id: 'activity', label: 'Activities', emoji: '\uD83C\uDF0A', color: '#5a8fb5' },
  { id: 'nightlife', label: 'Nightlife', emoji: '\uD83C\uDF79', color: '#b66a8a' },
  { id: 'photo', label: 'Photo spots', emoji: '\uD83D\uDCF8', color: '#8b6f5a' },
  { id: 'wellness', label: 'Wellness', emoji: '\uD83E\uDDD8', color: '#7ba88a' },
] as const;

const CATEGORY_SUGGESTIONS: Record<string, readonly string[]> = {
  beach: [
    'Puka Shell Beach',
    'White Beach Station 1',
    'Diniwid cove',
    'Ilig-Iligan',
    'Bulabog wind beach',
  ],
  food: [
    'Best local eats',
    'Fresh seafood grills',
    'Late-night ihaw-ihaw',
    'Coffee & brunch',
    'Must-try halo-halo',
  ],
  activity: [
    'Island hopping',
    'Parasailing',
    'Snorkeling reefs',
    'Helmet diving',
    'Kite-surfing Bulabog',
  ],
  nightlife: [
    'Beachfront sundowners',
    'Live music bars',
    'Fire dancers',
    'Sky bar rooftop',
    'Late-night clubs',
  ],
  photo: [
    "Willy's Rock at sunset",
    'Drone-friendly viewpoints',
    'Puka sunset',
    'Mt Luho overlook',
    'Pastel caf\u00E9s',
  ],
  wellness: [
    'Beachside massage',
    'Yoga at sunrise',
    'Spa day',
    'Wellness retreats',
    'Juice & smoothie bars',
  ],
};

const ITINERARY_STYLES = [
  { id: 'relaxed', label: 'Relaxed', sub: 'Slow mornings, spa, sunsets' },
  { id: 'adventure', label: 'Adventure', sub: 'Water sports, trails, reefs' },
  { id: 'foodie', label: 'Foodie', sub: 'Local eats, markets, bars' },
  { id: 'family', label: 'Family', sub: 'Kid-safe, easy access' },
  { id: 'culture', label: 'Culture', sub: 'History, markets, locals' },
] as const;

const PLACES: readonly DiscoverPlace[] = [
  {
    n: 'Puka Shell Beach',
    t: 'Beach',
    r: 4.7,
    rv: '3.2k',
    d: '4.2 km',
    dn: 4.2,
    price: 0,
    openNow: true,
    img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80',
  },
  {
    n: "D'Mall",
    t: 'Shopping',
    r: 4.3,
    rv: '1.8k',
    d: '1.6 km',
    dn: 1.6,
    price: 2,
    openNow: true,
    img: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&q=80',
  },
  {
    n: "Willy's Rock",
    t: 'Landmark',
    r: 4.5,
    rv: '2.1k',
    d: '900 m',
    dn: 0.9,
    price: 0,
    openNow: true,
    img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
  },
  {
    n: "Jonah's Fruit Shake",
    t: 'Restaurant',
    r: 4.6,
    rv: '890',
    d: '1.2 km',
    dn: 1.2,
    price: 1,
    openNow: false,
    img: 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?w=800&q=80',
  },
];

const TRENDING: readonly TrendingItem[] = [
  {
    n: 'Island hopping tour',
    pr: '\u20B11,800',
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  },
  {
    n: 'Parasailing',
    pr: '\u20B11,200',
    img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80',
  },
  {
    n: 'Sunset sail',
    pr: '\u20B11,500',
    img: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400&q=80',
  },
];

const PLACE_CATEGORY_CHIPS = [
  'All',
  'Beach',
  'Food',
  'Activity',
  'Shopping',
  'Landmark',
] as const;

const DEFAULT_FILTERS: FilterState = {
  minRating: 0,
  openNow: false,
  nearby: false,
  maxPrice: 3,
};

// ── Helpers ─────────────────────────────────────────────────────────────

function countActiveFilters(f: FilterState): number {
  return (
    (f.minRating > 0 ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.nearby ? 1 : 0) +
    (f.maxPrice < 3 ? 1 : 0)
  );
}

function applyPlaceFilters(
  list: readonly DiscoverPlace[],
  f: FilterState,
): DiscoverPlace[] {
  return list.filter((p) => {
    if (f.minRating && p.r < f.minRating) return false;
    if (f.openNow && !p.openNow) return false;
    if (f.nearby && p.dn > 2) return false;
    if (f.maxPrice < 3 && p.price > f.maxPrice) return false;
    return true;
  });
}

// ── Sub-components ──────────────────────────────────────────────────────

function FilterChip({
  active,
  onPress,
  children,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 11,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accentBg : colors.card,
      }}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text
        style={{
          fontSize: 11.5,
          fontWeight: '600',
          color: active ? colors.accent : colors.text,
        }}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}

function FilterRow({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1.4, // 0.14em * 10
          textTransform: 'uppercase',
          color: colors.text3,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {children}
      </View>
    </View>
  );
}

function SegBtn({
  active,
  onPress,
  children,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: active ? colors.black : colors.border,
        backgroundColor: active ? colors.black : colors.card,
      }}
      activeOpacity={0.7}
    >
      <Text
        style={{
          fontSize: 11.5,
          fontWeight: '600',
          color: active ? colors.onBlack : colors.text,
        }}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [tab, setTab] = useState<TabId>('planner');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('relaxed');
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [recommended, setRecommended] = useState<Set<string>>(() => new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ ...DEFAULT_FILTERS });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);

  const toggleSave = useCallback((name: string) => {
    setSaved((s) => {
      const next = new Set(s);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const toggleRecommend = useCallback((name: string) => {
    setRecommended((s) => {
      const next = new Set(s);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const activeFilterCount = countActiveFilters(filters);
  const filteredPlaces = applyPlaceFilters(PLACES, filters);

  const selectedCategory = cat
    ? CATEGORIES.find((c) => c.id === cat)
    : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>Boracay</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Filters">
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.text}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 6h18M6 12h12M10 18h4" />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Segmented control */}
      <View style={styles.segWrapper}>
        <View style={styles.seg}>
          {(['planner', 'places', 'saved'] as const).map((id) => (
            <TouchableOpacity
              key={id}
              style={[styles.segBtn, tab === id && styles.segBtnActive]}
              onPress={() => setTab(id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segText, tab === id && styles.segTextActive]}>
                {id === 'planner'
                  ? 'Planner'
                  : id === 'places'
                    ? 'Places'
                    : `Saved${saved.size ? ` \u00B7 ${saved.size}` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══════ PLANNER TAB ═══════ */}
        {tab === 'planner' && (
          <>
            {/* AI prompt card */}
            <View style={styles.promptCard}>
              {/* Glow */}
              <View style={styles.promptGlow} />
              <View style={styles.promptInner}>
                {/* Header row */}
                <View style={styles.promptHeaderRow}>
                  <View style={styles.promptIconBox}>
                    <Svg
                      width={15}
                      height={15}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
                    </Svg>
                  </View>
                  <View>
                    <Text style={styles.promptTitle}>Trip Planner</Text>
                    <Text style={styles.promptSub}>
                      AI-generated day-by-day for Boracay
                    </Text>
                  </View>
                </View>

                {/* Text input */}
                <View style={styles.promptInputBox}>
                  <TextInput
                    value={prompt}
                    onChangeText={setPrompt}
                    placeholder="What do you want to do on this trip?"
                    placeholderTextColor={colors.text3}
                    style={styles.promptInput}
                    multiline
                  />
                </View>

                {/* Generate button */}
                <TouchableOpacity
                  style={styles.generateBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Generate Itinerary"
                >
                  <Svg
                    width={16}
                    height={16}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.onBlack}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
                  </Svg>
                  <Text style={styles.generateBtnText}>Generate Itinerary</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick suggestions header */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.eyebrow}>Quick suggestions</Text>
                <Text style={styles.sectionTitle}>
                  {cat && selectedCategory ? selectedCategory.label : 'Pick a vibe'}
                </Text>
              </View>
              {cat && (
                <TouchableOpacity onPress={() => setCat(null)} activeOpacity={0.7}>
                  <Text style={styles.backLink}>{'\u2190'} Categories</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category grid or suggestions */}
            {!cat ? (
              <CategoryGrid categories={CATEGORIES} onSelect={(id) => setCat(id)} />
            ) : (
              <SuggestionList
                suggestions={CATEGORY_SUGGESTIONS[cat] ?? []}
                emoji={selectedCategory?.emoji ?? ''}
                onSelect={(s) => setPrompt(s)}
              />
            )}

            {/* Itinerary styles */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.eyebrow}>Style</Text>
                <Text style={styles.sectionTitle}>Pick your pace</Text>
              </View>
            </View>
            <View style={styles.styleList}>
              {ITINERARY_STYLES.map((s) => {
                const active = style === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.styleCard, active && styles.styleCardActive]}
                    onPress={() => setStyle(s.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.styleRadio,
                        active && styles.styleRadioActive,
                      ]}
                    >
                      {active && <View style={styles.styleRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.styleLabel}>{s.label}</Text>
                      <Text style={styles.styleSub}>{s.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Trending */}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.eyebrow}>Trending in Boracay</Text>
                <Text style={styles.sectionTitle}>
                  What everyone{'\u2019'}s doing
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.backLink}>All {'\u2192'}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingRow}
            >
              {TRENDING.map((t) => (
                <TrendingCard key={t.n} item={t} />
              ))}
            </ScrollView>
          </>
        )}

        {/* ═══════ PLACES TAB ═══════ */}
        {tab === 'places' && (
          <>
            {/* Search */}
            <View style={styles.searchBox}>
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.text3}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Circle cx={11} cy={11} r={8} />
                <Line x1={21} y1={21} x2={16.6} y2={16.6} />
              </Svg>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search restaurants, beaches, activities\u2026"
                placeholderTextColor={colors.text3}
                style={styles.searchInput}
              />
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {PLACE_CATEGORY_CHIPS.map((c, i) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, i === 0 && styles.chipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, i === 0 && styles.chipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Filter bar */}
            <View style={styles.filterBar}>
              <TouchableOpacity
                onPress={() => setShowFilters((s) => !s)}
                style={[
                  styles.filterBtn,
                  activeFilterCount > 0 && styles.filterBtnActive,
                ]}
                activeOpacity={0.7}
              >
                <Svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M3 4h18l-7 9v6l-4 2v-8z" />
                </Svg>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '600',
                    color: activeFilterCount > 0 ? colors.accent : colors.text,
                  }}
                >
                  Filters{activeFilterCount > 0 ? ` \u00B7 ${activeFilterCount}` : ''}
                </Text>
              </TouchableOpacity>
              <FilterChip
                active={filters.openNow}
                onPress={() =>
                  setFilters((f) => ({ ...f, openNow: !f.openNow }))
                }
                colors={colors}
              >
                Open now
              </FilterChip>
              <FilterChip
                active={filters.nearby}
                onPress={() =>
                  setFilters((f) => ({ ...f, nearby: !f.nearby }))
                }
                colors={colors}
              >
                Nearby
              </FilterChip>
              <FilterChip
                active={filters.minRating >= 4.5}
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    minRating: f.minRating >= 4.5 ? 0 : 4.5,
                  }))
                }
                colors={colors}
              >
                {'\u2605'} 4.5+
              </FilterChip>
            </View>

            {/* Expanded filters panel */}
            {showFilters && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={styles.filterPanel}
              >
                <FilterRow label="Minimum rating" colors={colors}>
                  {[0, 4.0, 4.5].map((v) => (
                    <SegBtn
                      key={v}
                      active={filters.minRating === v}
                      onPress={() =>
                        setFilters((f) => ({ ...f, minRating: v }))
                      }
                      colors={colors}
                    >
                      {v === 0 ? 'Any' : `\u2605 ${v.toFixed(1)}+`}
                    </SegBtn>
                  ))}
                </FilterRow>
                <FilterRow label="Price" colors={colors}>
                  {['Free', '$', '$$', '$$$'].map((lbl, i) => (
                    <SegBtn
                      key={lbl}
                      active={filters.maxPrice === i}
                      onPress={() =>
                        setFilters((f) => ({ ...f, maxPrice: i }))
                      }
                      colors={colors}
                    >
                      {lbl}
                      {i < 3 ? ' or less' : ''}
                    </SegBtn>
                  ))}
                </FilterRow>
                <FilterRow label="Distance" colors={colors}>
                  <SegBtn
                    active={!filters.nearby}
                    onPress={() =>
                      setFilters((f) => ({ ...f, nearby: false }))
                    }
                    colors={colors}
                  >
                    Any
                  </SegBtn>
                  <SegBtn
                    active={filters.nearby}
                    onPress={() =>
                      setFilters((f) => ({ ...f, nearby: true }))
                    }
                    colors={colors}
                  >
                    {'\u2264'} 2 km
                  </SegBtn>
                </FilterRow>
                <FilterRow label="Availability" colors={colors}>
                  <SegBtn
                    active={!filters.openNow}
                    onPress={() =>
                      setFilters((f) => ({ ...f, openNow: false }))
                    }
                    colors={colors}
                  >
                    All
                  </SegBtn>
                  <SegBtn
                    active={filters.openNow}
                    onPress={() =>
                      setFilters((f) => ({ ...f, openNow: true }))
                    }
                    colors={colors}
                  >
                    Open now
                  </SegBtn>
                </FilterRow>

                {/* Footer */}
                <View style={styles.filterFooter}>
                  <TouchableOpacity
                    onPress={() => setFilters({ ...DEFAULT_FILTERS })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterResetText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.filterShowBtn}
                    onPress={() => setShowFilters(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.filterShowBtnText}>Show results</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* Place cards */}
            <View style={styles.placeList}>
              {filteredPlaces.length === 0 ? (
                <View style={styles.emptyPlaces}>
                  <Text style={styles.emptyText}>
                    No places match these filters.
                  </Text>
                </View>
              ) : (
                filteredPlaces.map((p) => (
                  <DiscoverPlaceCard
                    key={p.n}
                    place={p}
                    isSaved={saved.has(p.n)}
                    isRecommended={recommended.has(p.n)}
                    onSave={() => toggleSave(p.n)}
                    onRecommend={() => toggleRecommend(p.n)}
                  />
                ))
              )}
            </View>
          </>
        )}

        {/* ═══════ SAVED TAB ═══════ */}
        {tab === 'saved' && (
          <View style={styles.placeList}>
            {saved.size === 0 ? (
              <View style={styles.emptyCard}>
                <Svg
                  width={28}
                  height={28}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={colors.text3}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.6}
                >
                  <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                </Svg>
                <Text style={styles.emptyCardTitle}>No saved places yet</Text>
                <Text style={styles.emptyCardBody}>
                  Tap the bookmark on a place to save it here.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.savedHeaderRow}>
                  <Text style={styles.savedCount}>
                    {saved.size} saved {'\u00B7'} {recommended.size} recommended
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setSaved(new Set());
                      setRecommended(new Set());
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.clearAllText}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                {PLACES.filter((p) => saved.has(p.n)).map((p) => (
                  <DiscoverPlaceCard
                    key={p.n}
                    place={p}
                    isSaved={true}
                    isRecommended={recommended.has(p.n)}
                    onSave={() => toggleSave(p.n)}
                    onRecommend={() => toggleRecommend(p.n)}
                  />
                ))}
              </>
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },

    // Top bar
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.66, // -0.03em
      color: colors.text,
    },
    subtitle: {
      fontSize: 11,
      color: colors.text3,
      letterSpacing: 1.76, // 0.16em
      textTransform: 'uppercase',
      fontWeight: '600',
      marginTop: 2,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Segmented control
    segWrapper: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    seg: {
      flexDirection: 'row',
      padding: 3,
      backgroundColor: colors.card2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 2,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 9,
      alignItems: 'center',
    },
    segBtnActive: {
      backgroundColor: colors.card,
    },
    segText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
      letterSpacing: -0.12, // -0.01em
    },
    segTextActive: {
      color: colors.text,
    },

    // Prompt card
    promptCard: {
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    promptGlow: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 140,
      height: 140,
      borderRadius: 999,
      backgroundColor: 'rgba(217, 164, 65, 0.28)',
    },
    promptInner: {
      position: 'relative',
    },
    promptHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    promptIconBox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promptTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    promptSub: {
      fontSize: 10.5,
      color: colors.text3,
    },
    promptInputBox: {
      backgroundColor: colors.canvas,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    promptInput: {
      minHeight: 56,
      color: colors.text,
      fontSize: 13,
    },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 999,
      backgroundColor: colors.black,
    },
    generateBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onBlack,
    },

    // Section headers
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
      letterSpacing: 1.6, // 0.16em
      textTransform: 'uppercase',
      color: colors.text3,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
      letterSpacing: -0.48, // -0.03em
      color: colors.text,
      marginTop: 2,
    },
    backLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      padding: 4,
    },

    // Style cards
    styleList: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      gap: 8,
    },
    styleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    styleCardActive: {
      backgroundColor: colors.accentBg,
      borderColor: colors.accentBorder,
    },
    styleRadio: {
      width: 20,
      height: 20,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: colors.border2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    styleRadioActive: {
      borderColor: colors.accent,
    },
    styleRadioDot: {
      width: 9,
      height: 9,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    styleLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    styleSub: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 2,
    },

    // Trending
    trendingRow: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 10,
    },

    // Search
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 14,
      paddingVertical: 11,
      paddingHorizontal: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
    },

    // Chips
    chipRow: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 6,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.black,
      borderColor: colors.black,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text2,
    },
    chipTextActive: {
      color: colors.onBlack,
    },

    // Filter bar
    filterBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterBtnActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBg,
    },

    // Filter panel
    filterPanel: {
      marginHorizontal: 16,
      marginBottom: 14,
      padding: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      gap: 14,
    },
    filterFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    filterResetText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
      padding: 4,
    },
    filterShowBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: colors.black,
    },
    filterShowBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onBlack,
    },

    // Place list
    placeList: {
      paddingHorizontal: 16,
      gap: 12,
    },
    emptyPlaces: {
      paddingVertical: 28,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: colors.text3,
    },

    // Saved empty state
    emptyCard: {
      paddingVertical: 36,
      paddingHorizontal: 20,
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 16,
    },
    emptyCardTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      marginTop: 8,
      marginBottom: 4,
    },
    emptyCardBody: {
      fontSize: 12,
      color: colors.text3,
    },

    // Saved header
    savedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    savedCount: {
      fontSize: 12,
      color: colors.text3,
    },
    clearAllText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text3,
    },
  });
