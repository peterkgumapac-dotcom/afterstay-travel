import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, ExternalLink, Search, Sparkles, Star, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, ThemeColors } from '@/constants/ThemeContext';
import { getCuratedList, getActiveTrip, type CuratedItem } from '@/lib/supabase';

const QUICK_SEARCHES = [
  'cafes',
  'restaurants',
  'beaches',
  'nightlife',
  'activities',
  'coffee shops',
  'street food',
  'sunset spots',
  'snorkeling',
  'massage & spa',
];

export default function TripPlannerModal() {
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState('');
  const [hotelName, setHotelName] = useState('');
  const [results, setResults] = useState<CuratedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    getActiveTrip().then((t) => {
      if (t?.destination) setDestination(t.destination);
      if (t?.accommodation) setHotelName(t.accommodation);
    }).catch(() => {});
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !destination) return;
    setLoading(true);
    setError(undefined);
    setSearched(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await getCuratedList({
        destination,
        category: q.trim(),
        hotelName: hotelName || undefined,
      });
      setResults(result.items);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to search');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [destination, hotelName]);

  const handleQuickSearch = (term: string) => {
    setQuery(term);
    search(term);
  };

  const handleSubmit = () => {
    if (query.trim()) search(query.trim());
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Explore</Text>
          {destination ? <Text style={s.subtitle}>{destination}</Text> : null}
        </View>
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={16} color={colors.text3} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={`Search "top 5 cafes", "best beaches"...`}
            placeholderTextColor={colors.text3}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setSearched(false); setResults([]); }} hitSlop={8}>
              <X size={16} color={colors.text3} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.searchBtn} onPress={handleSubmit} activeOpacity={0.7}>
          <Sparkles size={16} color={colors.bg} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick search chips */}
        {!searched && (
          <>
            <Text style={s.sectionLabel}>POPULAR SEARCHES</Text>
            <View style={s.chipGrid}>
              {QUICK_SEARCHES.map((term) => (
                <TouchableOpacity
                  key={term}
                  style={s.chip}
                  onPress={() => handleQuickSearch(term)}
                  activeOpacity={0.7}
                >
                  <Text style={s.chipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.helpCard}>
              <Sparkles size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.helpTitle}>AI-powered search</Text>
                <Text style={s.helpText}>
                  Results sourced from Reddit, TripAdvisor, Google, and travel blogs. Try "best sunset dinner spots" or "hidden gem beaches".
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Loading */}
        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={s.loadingText}>Searching the web for real recommendations...</Text>
            <Text style={s.loadingSub}>This may take 10-15 seconds</Text>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={s.errorWrap}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleSubmit} style={s.retryBtn}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {!loading && searched && results.length > 0 && (
          <>
            <Text style={s.sectionLabel}>
              TOP {results.length} · {query.toUpperCase()}
            </Text>
            {results.map((item, i) => (
              <TouchableOpacity
                key={`${item.name}-${i}`}
                style={s.resultCard}
                activeOpacity={item.source_url ? 0.7 : 1}
                onPress={() => item.source_url && Linking.openURL(item.source_url).catch(() => {})}
              >
                <Text style={s.rank}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <View style={s.resultTop}>
                    <Text style={s.resultName}>{item.name}</Text>
                    {item.rating && (
                      <View style={s.ratingBadge}>
                        <Star size={10} color={colors.accent} fill={colors.accent} />
                        <Text style={s.ratingText}>{item.rating}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.resultReason} numberOfLines={3}>{item.reason}</Text>
                  <View style={s.resultMeta}>
                    {item.price && <Text style={s.priceText}>{item.price}</Text>}
                    {item.source_url && (
                      <View style={s.sourceBadge}>
                        <ExternalLink size={10} color={colors.text3} />
                        <Text style={s.sourceText}>
                          {item.source_url.includes('reddit') ? 'Reddit'
                            : item.source_url.includes('tripadvisor') ? 'TripAdvisor'
                            : item.source_url.includes('google') ? 'Google'
                            : 'Web'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && !error && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No results found. Try a different search.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (c: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.5, color: c.text },
  subtitle: { fontSize: 10, color: c.text3, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '600', marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text },
  searchBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    color: c.text3, marginBottom: 10, marginTop: 8,
  },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
    borderRadius: 99,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: c.text },

  helpCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, backgroundColor: c.accentBg, borderWidth: 1,
    borderColor: c.accentBorder, borderRadius: 16,
  },
  helpTitle: { fontSize: 14, fontWeight: '600', color: c.text },
  helpText: { fontSize: 12, color: c.text2, marginTop: 4, lineHeight: 18 },

  loadingWrap: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  loadingText: { fontSize: 14, fontWeight: '600', color: c.text },
  loadingSub: { fontSize: 12, color: c.text3 },

  errorWrap: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  errorText: { fontSize: 13, color: c.danger, textAlign: 'center' },
  retryBtn: {
    paddingVertical: 8, paddingHorizontal: 20,
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12,
  },
  retryText: { fontSize: 13, fontWeight: '600', color: c.accent },

  resultCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, backgroundColor: c.card, borderWidth: 1,
    borderColor: c.border, borderRadius: 16, marginBottom: 10,
  },
  rank: {
    fontSize: 22, fontWeight: '700', color: c.accent,
    width: 28, textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  resultName: { fontSize: 15, fontWeight: '600', color: c.text, flex: 1 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    backgroundColor: c.accentBg, borderRadius: 8,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: c.accent },
  resultReason: { fontSize: 12.5, color: c.text2, marginTop: 4, lineHeight: 18 },
  resultMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8,
  },
  priceText: { fontSize: 11, color: c.text3, fontWeight: '600' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sourceText: { fontSize: 10, color: c.text3 },

  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: c.text3 },
});
